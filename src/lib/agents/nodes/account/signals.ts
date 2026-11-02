/**
 * extractSignals (Analyst) and scoreFit.
 * A signal is kept only if it has a source URL that was actually retrieved, a
 * quote that appears in that page's text, and a date inside the ICP's signal
 * window (P0-3). Anything else is dropped, never stored.
 */

import * as z from "zod";
import type { AgentDeps } from "../../deps";
import type { AccountStateType, AccountUpdate } from "../../state";
import type { EvidenceSignal, SourceSnippet, UsageEntry } from "../../types";
import { isRejectedSource, isWithinWindow, parseDate } from "../../tools/webSearch";
import { finishTask, startTask } from "../guards";

const THIN_CONTENT_CHARS = 300;
const MIN_QUOTE_CHARS = 15;
const GENERIC_SIGNAL_TERMS = ["expansion", "funding", "launch", "acquisition", "partnership", "hiring"];

const signalSchema = z.object({
  signals: z
    .array(
      z.object({
        signalType: z.string().min(2).max(60),
        title: z.string().min(3).max(200),
        quote: z.string().min(1).max(600),
        sourceUrl: z.string().min(8).max(1000),
        sourceDate: z.string().max(40).nullable().default(null),
      })
    )
    .max(12),
});

const scoreSchema = z.object({
  fitScore: z.number().min(0).max(100),
  intentScore: z.number().min(0).max(100),
  rationale: z.string().min(3).max(600),
});

/** Lowercase, straight quotes, single spaces: makes quote matching tolerant of formatting only. */
export function normaliseText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Applies the evidence rules; returns only signals that pass every check. */
export function validateSignals(
  raw: z.infer<typeof signalSchema>["signals"],
  evidence: Map<string, SourceSnippet>,
  windowDays: number,
  now: Date
): EvidenceSignal[] {
  const seen = new Set<string>();
  return raw.flatMap((s) => {
    const source = evidence.get(s.sourceUrl.trim());
    if (!source || isRejectedSource(source.url, source.title)) return [];
    const quote = s.quote.trim();
    if (quote.length < MIN_QUOTE_CHARS) return [];
    if (!normaliseText(`${source.title} ${source.content}`).includes(normaliseText(quote))) return [];

    const date = parseDate(s.sourceDate) || parseDate(source.publishedDate);
    if (!date || !isWithinWindow(date.toISOString(), windowDays, now)) return [];

    const key = `${source.url}::${normaliseText(quote)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ signalType: s.signalType.trim(), title: s.title.trim(), quote, sourceUrl: source.url, sourceDate: toIsoDate(date) }];
  });
}

async function gatherEvidence(
  deps: AgentDeps,
  state: AccountStateType
): Promise<{ evidence: Map<string, SourceSnippet>; usage: UsageEntry[] }> {
  const { candidate, context } = state;
  const usage: UsageEntry[] = [];
  const terms = context.icp.requiredSignals.length > 0 ? context.icp.requiredSignals.slice(0, 4) : GENERIC_SIGNAL_TERMS;
  const query = `"${candidate.name}" (${terms.map((t) => `"${t}"`).join(" OR ")})`;

  const search = await deps.tools.search(query);
  usage.push(...search.usage);
  const lowerName = candidate.name.toLowerCase();
  const extra = search.ok
    ? search.value.filter((h) => `${h.title} ${h.content}`.toLowerCase().includes(lowerName))
    : [];

  const merged = new Map<string, SourceSnippet>();
  [...candidate.sources, ...extra].forEach((h) => {
    if (!merged.has(h.url)) merged.set(h.url, h);
  });

  const thin = [...merged.values()].filter((h) => h.content.length < THIN_CONTENT_CHARS).slice(0, 3);
  if (thin.length > 0) {
    const extracted = await deps.tools.extract(thin.map((h) => h.url));
    usage.push(...extracted.usage);
    if (extracted.ok) {
      extracted.value.forEach((page) => {
        const prev = merged.get(page.url);
        if (prev) merged.set(page.url, { ...prev, content: page.content });
      });
    }
  }
  return { evidence: merged, usage };
}

export function createExtractSignals(deps: AgentDeps) {
  return async function extractSignals(state: AccountStateType): Promise<AccountUpdate> {
    const { candidate, context } = state;
    const taskId = await startTask(deps, {
      runId: context.runId,
      workspaceId: context.workspaceId,
      taskType: "Analyst",
      companyName: candidate.name,
      companyDomain: candidate.domain,
      output: { sources: candidate.sources.length },
    });

    const { evidence, usage } = await gatherEvidence(deps, state);
    const pages = [...evidence.values()].slice(0, 12).map((h) => ({
      url: h.url,
      title: h.title,
      publishedDate: h.publishedDate,
      content: h.content.slice(0, 1500),
    }));

    const llm = await deps.tools.llm("extractSignals", signalSchema, {
      system:
        'You extract dated buying signals for one company. Output JSON {"signals":[{"signalType","title","quote","sourceUrl","sourceDate"}]}. ' +
        "quote must be copied word for word from the page content. sourceUrl must be one of the given URLs. " +
        "sourceDate is the event or publication date (YYYY-MM-DD) stated on the page, or null. Do not infer or invent anything.",
      user: `Company: ${candidate.name} (${candidate.domain})\nSignals the client cares about: ${JSON.stringify(
        context.icp.requiredSignals
      )}\nPages:\n${JSON.stringify(pages)}`,
    });
    usage.push(...llm.usage);

    const signals = llm.ok ? validateSignals(llm.value.signals, evidence, context.icp.signalWindowDays, deps.now()) : [];
    await finishTask(deps, taskId, llm.ok ? "completed" : "failed", {
      proposed: llm.ok ? llm.value.signals.length : 0,
      signalsKept: signals.length,
      ...(llm.ok ? {} : { error: llm.error.code }),
    });
    return { signals, usage };
  };
}

export function createScoreFit(deps: AgentDeps) {
  return async function scoreFit(state: AccountStateType): Promise<AccountUpdate> {
    const { candidate, context, signals } = state;
    if (signals.length === 0) {
      return { score: null, reason: "No evidence-backed buying signal (source URL, date and quote) was found." };
    }

    const llm = await deps.tools.llm("scoreFit", scoreSchema, {
      system:
        'You score a company against a B2B ICP. Output JSON {"fitScore":0-100,"intentScore":0-100,"rationale":string}. ' +
        "fitScore: how well the company matches the ICP industries, geographies and size. " +
        "intentScore: how strongly the cited signals indicate a current buying window. Use only the evidence given.",
      user: `ICP:\n${JSON.stringify(context.icp)}\n\nCompany: ${JSON.stringify({
        name: candidate.name,
        domain: candidate.domain,
        industry: candidate.industry,
        country: candidate.country,
      })}\nSignals:\n${JSON.stringify(signals)}`,
    });

    if (!llm.ok) {
      return { score: null, usage: llm.usage, reason: `Fit scoring unavailable (${llm.error.code}).` };
    }
    const fitScore = Math.round(llm.value.fitScore);
    const intentScore = Math.round(llm.value.intentScore);
    const combined = Math.round(fitScore * 0.6 + intentScore * 0.4);
    return {
      score: { fitScore, intentScore, combined, rationale: llm.value.rationale.trim() },
      usage: llm.usage,
    };
  };
}

/** Conditional-edge predicate: below threshold (or unscored) goes to discard. */
export function passesFitThreshold(state: AccountStateType): boolean {
  return !!state.score && state.score.combined >= state.context.minFitScore;
}
