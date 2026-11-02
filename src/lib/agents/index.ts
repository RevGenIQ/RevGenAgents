/**
 * Public entry points for the LangGraph prospecting engine.
 * Each call runs one invocation on thread_id = runId with a wall-clock budget
 * (AGENT_TIME_BUDGET_MS, default 240s). When the budget is hit the invocation is
 * aborted, the last checkpoint stays in Postgres, and the caller continues the
 * thread through POST /api/runs/[id]/continue (P0-7).
 */

import { Command } from "@langchain/langgraph";
import { logger } from "../security/logger";
import { createServerClient } from "../supabase/server";
import { getCheckpointer } from "./checkpointer";
import { loadAgentConfig, type AgentConfig } from "./config";
import type { AgentDeps } from "./deps";
import { buildProspectingGraph, type ProspectingGraph } from "./graphs/prospecting";
import { errorMessage } from "./nodes/guards";
import { createSupabaseRepo } from "./repo/supabaseRepo";
import { createLiveTools } from "./tools";
import type { ReviewRequest, ReviewResume } from "./types";

export type RunOutcome =
  | { kind: "completed" }
  | { kind: "awaiting_review"; request: ReviewRequest | null }
  | { kind: "continue" }
  | { kind: "noop"; reason: string }
  | { kind: "failed"; error: string };

interface Engine {
  graph: ProspectingGraph;
  deps: AgentDeps;
}

let enginePromise: Promise<Engine> | null = null;

function createLiveDeps(config: AgentConfig): AgentDeps {
  return {
    repo: createSupabaseRepo(createServerClient()),
    tools: createLiveTools(config),
    config,
    logger,
    now: () => new Date(),
  };
}

function getEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const deps = createLiveDeps(loadAgentConfig());
      const graph = buildProspectingGraph(deps, await getCheckpointer());
      return { graph, deps };
    })().catch((e) => {
      enginePromise = null;
      throw e;
    });
  }
  return enginePromise;
}

export function isLangGraphEngine(): boolean {
  return process.env.AGENT_ENGINE === "langgraph";
}

function threadConfig(runId: string) {
  return { configurable: { thread_id: runId } };
}

async function pendingInterrupts(graph: ProspectingGraph, runId: string): Promise<ReviewRequest[]> {
  const snapshot = await graph.getState(threadConfig(runId));
  return snapshot.tasks.flatMap((t) => t.interrupts || []).map((i) => i.value as ReviewRequest);
}

async function markFailed(deps: AgentDeps, runId: string, error: string): Promise<void> {
  try {
    await deps.repo.updateRun(runId, {
      status: "failed",
      error_message: error.slice(0, 500),
      current_step: "Agent run failed. It can be retried.",
    });
  } catch (e) {
    logger.error(`Could not mark run ${runId} as failed`, e);
  }
}

type GraphInput = Parameters<ProspectingGraph["invoke"]>[0];

async function invokeWithBudget(runId: string, input: GraphInput): Promise<RunOutcome> {
  const { graph, deps } = await getEngine();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.config.timeBudgetMs);

  try {
    await graph.invoke(input, {
      ...threadConfig(runId),
      signal: controller.signal,
      maxConcurrency: deps.config.maxConcurrency,
      recursionLimit: 50,
    });
    const interrupts = await pendingInterrupts(graph, runId);
    if (interrupts.length > 0) return { kind: "awaiting_review", request: interrupts[0] };
    return { kind: "completed" };
  } catch (e) {
    if (controller.signal.aborted) {
      try {
        await deps.repo.updateRun(runId, { current_step: "Time budget reached; continuing from the last checkpoint..." });
      } catch (writeErr) {
        logger.warn("Could not record continuation step", { runId, error: errorMessage(writeErr) });
      }
      return { kind: "continue" };
    }
    const error = errorMessage(e);
    logger.error(`Prospecting run ${runId} failed`, e);
    await markFailed(deps, runId, error);
    return { kind: "failed", error };
  } finally {
    clearTimeout(timer);
  }
}

/** Starts (or restarts, for a retry) the run from loadContext. */
export async function startProspectingRun(runId: string): Promise<RunOutcome> {
  return invokeWithBudget(runId, { runId });
}

/** Continues an unfinished thread from its last checkpoint. */
export async function continueProspectingRun(runId: string): Promise<RunOutcome> {
  const { graph } = await getEngine();
  const snapshot = await graph.getState(threadConfig(runId));
  if (snapshot.next.length === 0) return { kind: "noop", reason: "Run has no pending work." };
  const interrupts = snapshot.tasks.flatMap((t) => t.interrupts || []);
  if (interrupts.length > 0) {
    return { kind: "awaiting_review", request: interrupts[0].value as ReviewRequest };
  }
  return invokeWithBudget(runId, null);
}

/** Returns the review request the run is paused on, or null when it is not waiting for review. */
export async function getPendingReview(runId: string): Promise<ReviewRequest | null> {
  const { graph } = await getEngine();
  const interrupts = await pendingInterrupts(graph, runId);
  return interrupts[0] ?? null;
}

/** Resumes humagentReview with the reviewer's decisions. */
export async function resumeProspectingRun(runId: string, resume: ReviewResume): Promise<RunOutcome> {
  return invokeWithBudget(runId, new Command({ resume }));
}
