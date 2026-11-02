/**
 * aggregate, humagentReview (interrupt), publishToClient, halt and finalize.
 * Nothing reaches the client until a Humagent or Admin approves it (P0-5).
 */

import { interrupt } from "@langchain/langgraph";
import type { AgentDeps } from "../deps";
import type { ProspectingStateType, ProspectingUpdate } from "../state";
import { reviewResumeSchema, type ReviewCard, type ReviewRequest } from "../types";
import { budgetExceededReason, errorMessage, reportProgress, stopRequested, summariseUsage, totalCost } from "./guards";

export function reviewCards(state: ProspectingStateType): ReviewCard[] {
  return state.accountResults
    .filter((r) => r.outcome === "persisted" && r.companyId)
    .map((r) => ({
      companyId: r.companyId as string,
      name: r.name,
      domain: r.domain,
      score: r.score,
      signals: r.signals,
      verifiedContacts: r.verifiedContacts,
      headline: r.headline,
      contactSummary: r.contactSummary,
    }));
}

function counts(state: ProspectingStateType): { found: number; verified: number } {
  const persisted = state.accountResults.filter((r) => r.outcome === "persisted");
  return { found: persisted.length, verified: persisted.filter((r) => r.verifiedContacts > 0).length };
}

export function createAggregate(deps: AgentDeps) {
  return async function aggregate(state: ProspectingStateType): Promise<ProspectingUpdate> {
    const { found, verified } = counts(state);
    const discarded = state.accountResults.filter((r) => r.outcome === "discarded").length;
    try {
      await deps.repo.updateRun(state.runId, {
        leads_found: found,
        leads_verified: verified,
        current_step: `Aggregated ${found} account cards (${verified} with verified contacts, ${discarded} discarded). Spend so far $${totalCost(
          state.usage
        ).toFixed(2)}.`,
        progress_percent: 85,
      });
    } catch (e) {
      deps.logger.warn("aggregate progress write failed", { runId: state.runId, error: errorMessage(e) });
    }
    return {};
  };
}

export function createHumagentReview(deps: AgentDeps) {
  return async function humagentReview(state: ProspectingStateType): Promise<ProspectingUpdate> {
    const cards = reviewCards(state);
    // This node re-runs from the top on resume, so everything before interrupt() is idempotent.
    await reportProgress(deps, state.runId, `Awaiting Humagent review of ${cards.length} account cards...`, 90);

    const request: ReviewRequest = { kind: "humagent_review", runId: state.runId, workspaceId: state.workspaceId, cards };
    const resume = interrupt<ReviewRequest, unknown>(request);

    const parsed = reviewResumeSchema.safeParse(resume);
    if (!parsed.success) {
      return { decisions: [], errors: ["Review resume payload was invalid; no cards were published."] };
    }
    const allowed = new Set(cards.map((c) => c.companyId));
    return { decisions: parsed.data.decisions.filter((d) => allowed.has(d.companyId)) };
  };
}

export function createPublishToClient(deps: AgentDeps) {
  return async function publishToClient(state: ProspectingStateType): Promise<ProspectingUpdate> {
    const approved = state.decisions.filter((d) => d.action === "approve").map((d) => d.companyId);
    const rejected = state.decisions.filter((d) => d.action === "reject").map((d) => d.companyId);

    const published = await deps.repo.publishCompanies(state.workspaceId, approved);
    const errors: string[] = [];

    if (published.length > 0) {
      try {
        await deps.repo.postSystemMessage(
          state.workspaceId,
          `Published ${published.length} verified account card${published.length === 1 ? "" : "s"}: ${published
            .map((p) => `${p.name} (${p.domain})`)
            .join(", ")}. Ready for review in Account Intelligence.`,
          { runId: state.runId, companyIds: published.map((p) => p.id) }
        );
      } catch (e) {
        errors.push(`Channel notification failed: ${errorMessage(e)}`);
        deps.logger.error("publishToClient message failed", e);
      }
    }

    try {
      await deps.repo.insertAuditLog({
        workspaceId: state.workspaceId,
        actorEmail: "system@revgeniq.os",
        action: "run_review_applied",
        targetType: "research_run",
        targetId: state.runId,
        details: { approved, rejected, published: published.map((p) => p.id) },
      });
    } catch (e) {
      errors.push(`Audit log failed: ${errorMessage(e)}`);
      deps.logger.error("publishToClient audit log failed", e);
    }

    await reportProgress(deps, state.runId, `Published ${published.length} cards to the client.`, 95);
    return { publishedIds: published.map((p) => p.id), errors };
  };
}

/** Entered from a stopGuard or budgetGuard edge: records why the run is ending early. */
export function createHalt(deps: AgentDeps) {
  return async function halt(state: ProspectingStateType): Promise<ProspectingUpdate> {
    const reason = (await stopRequested(deps, state.runId))
      ? "Stopped by user request."
      : budgetExceededReason(state.usage, state.budget) || "Run halted by a guard.";
    return { stopped: true, stopReason: reason };
  };
}

export function createFinalize(deps: AgentDeps) {
  return async function finalize(state: ProspectingStateType): Promise<ProspectingUpdate> {
    const { found, verified } = counts(state);
    const published = state.publishedIds.length;
    const step = state.stopped
      ? `${state.stopReason} Retained ${found} researched account cards.`
      : found === 0
      ? "No account met the evidence and fit bar in this run, so nothing was delivered."
      : `Run complete: ${published} of ${found} cards published after Humagent review (${verified} with verified contacts).`;

    await deps.repo.updateRun(state.runId, {
      status: state.stopped ? "stopped" : "completed",
      current_step: step,
      progress_percent: 100,
      leads_found: found,
      leads_verified: verified,
      completed_at: deps.now().toISOString(),
      error_message: state.stopped ? state.stopReason : null,
    });

    const usageRows = summariseUsage(state.usage).map((u) => ({
      workspaceId: state.workspaceId,
      runId: state.runId,
      provider: u.provider,
      eventType: u.eventType,
      tokensUsed: u.tokens,
      apiCalls: u.calls,
      costUsd: u.costUsd,
    }));
    try {
      await deps.repo.insertUsageEvents(usageRows);
    } catch (e) {
      deps.logger.error("finalize: usage_events insert failed", e);
    }

    try {
      await deps.repo.insertAuditLog({
        workspaceId: state.workspaceId,
        actorEmail: "system@revgeniq.os",
        action: state.stopped ? "run_stopped" : "run_completed",
        targetType: "research_run",
        targetId: state.runId,
        details: {
          engine: "langgraph",
          leads_found: found,
          leads_verified: verified,
          published,
          cost_usd: totalCost(state.usage),
          stop_reason: state.stopReason || null,
          errors: state.errors.slice(0, 20),
        },
      });
    } catch (e) {
      deps.logger.error("finalize: audit log insert failed", e);
    }
    return {};
  };
}
