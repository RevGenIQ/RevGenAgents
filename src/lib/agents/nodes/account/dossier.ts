/**
 * writeDossier (Writer).
 * The dossier and opener may only cite the extracted signals. Any number in the
 * LLM output that does not appear in the evidence is treated as an invented
 * statistic: the output is rejected and a deterministic, evidence-only draft
 * built with adapters/llm.ts is used instead.
 */

import * as z from "zod";
import { generateOutreachOpener } from "../../../adapters/llm";
import type { AgentDeps } from "../../deps";
import type { AccountStateType, AccountUpdate } from "../../state";
import type { Dossier, EvidenceSignal } from "../../types";
import { finishTask, startTask } from "../guards";

const dossierSchema = z.object({
  summary: z.string().min(10).max(1200),
  opener: z.string().min(10).max(700),
  talkingPoints: z.array(z.string().min(3).max(300)).max(5),
  painPoint: z.string().max(300).default(""),
});

export function tierFor(score: number): { tier: Dossier["tier"]; windowDays: number } {
  if (score >= 88) return { tier: "P1", windowDays: 30 };
  if (score >= 75) return { tier: "P2", windowDays: 45 };
  return { tier: "P3", windowDays: 60 };
}

/** Numbers (e.g. "34%", "2,000", "2026") in `text` that are absent from the evidence. */
export function inventedNumbers(text: string, evidence: string): string[] {
  const normalise = (n: string) => n.replace(/[,\s]/g, "");
  const known = new Set((evidence.match(/\d[\d,.]*/g) || []).map(normalise));
  return (text.match(/\d[\d,.]*/g) || []).map(normalise).filter((n) => n.length > 0 && !known.has(n));
}

function evidenceText(state: AccountStateType): string {
  const { candidate, signals } = state;
  return [
    candidate.name,
    candidate.domain,
    ...signals.flatMap((s) => [s.title, s.quote, s.sourceDate, s.sourceUrl]),
  ].join(" \n ");
}

async function fallbackDossier(state: AccountStateType, tierInfo: { tier: Dossier["tier"]; windowDays: number }): Promise<Dossier> {
  const { candidate, signals, verified, score } = state;
  const primary: EvidenceSignal | undefined = signals[0];
  const contact = verified.find((c) => c.verified) || verified[0];
  const opener = await generateOutreachOpener(
    candidate.name,
    contact ? contact.firstName : "there",
    contact ? contact.title : "your team",
    primary ? primary.title : "a recent company update"
  );
  return {
    summary: `${candidate.name} (${candidate.domain}): ${score?.rationale || candidate.whyItMatches}`.trim(),
    opener,
    talkingPoints: signals.slice(0, 3).map((s) => `${s.title} (${s.sourceDate}, ${s.sourceUrl})`),
    painPoint: "",
    ...tierInfo,
  };
}

export function createWriteDossier(deps: AgentDeps) {
  return async function writeDossier(state: AccountStateType): Promise<AccountUpdate> {
    const { candidate, context, signals, verified, score } = state;
    const tierInfo = tierFor(score?.combined ?? 0);
    const taskId = await startTask(deps, {
      runId: context.runId,
      workspaceId: context.workspaceId,
      taskType: "Writer",
      companyName: candidate.name,
      companyDomain: candidate.domain,
      output: { signals: signals.length },
    });

    const contact = verified.find((c) => c.verified) || verified[0];
    const llm = await deps.tools.llm("writeDossier", dossierSchema, {
      system:
        'You write a short account dossier and a cold-email opener. Output JSON {"summary","opener","talkingPoints","painPoint"}. ' +
        "Use ONLY the facts in the signals provided and cite them by their date. Do not add statistics, percentages, " +
        "customer names, results or claims that are not in the signals. The opener is 2-3 sentences addressed to the contact.",
      user: `Seller offering: ${context.icp.offering || "not specified"}\nCompany: ${candidate.name} (${candidate.domain})\nContact: ${
        contact ? `${contact.firstName} ${contact.lastName}, ${contact.title}` : "unknown"
      }\nSignals:\n${JSON.stringify(signals)}`,
    });

    const evidence = evidenceText(state);
    const invented = llm.ok
      ? inventedNumbers([llm.value.summary, llm.value.opener, ...llm.value.talkingPoints, llm.value.painPoint].join(" "), evidence)
      : [];
    const useLlm = llm.ok && invented.length === 0;
    const dossier: Dossier = useLlm
      ? { ...llm.value, ...tierInfo }
      : await fallbackDossier(state, tierInfo);

    await finishTask(deps, taskId, "completed", {
      source: useLlm ? "llm" : "evidence_template",
      ...(llm.ok ? {} : { llmError: llm.error.code }),
      ...(invented.length > 0 ? { rejectedNumbers: invented.slice(0, 5) } : {}),
    });
    return { dossier, usage: llm.usage };
  };
}
