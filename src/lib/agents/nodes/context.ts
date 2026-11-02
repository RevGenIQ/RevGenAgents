/**
 * loadContext and planQueries.
 * The search plan is derived only from the workspace's ICP brief (P0-1): there
 * are no seller-specific queries, industries or titles anywhere in this file.
 */

import { Overwrite } from "@langchain/langgraph";
import * as z from "zod";
import type { AgentDeps } from "../deps";
import type { ProspectingStateType, ProspectingUpdate } from "../state";
import type { IcpContext } from "../types";
import { normalizeDomain } from "./domains";
import { reportProgress } from "./guards";

function strings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,;\n]/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Merges workspaces.icp_brief (preferred) with the run's icp_input. */
export function buildIcpContext(
  brief: Record<string, unknown> | null,
  runInput: Record<string, unknown>
): IcpContext {
  const b = brief || {};
  const windowDays = Number(b.signalWindowDays);
  return {
    offering: text(b.offering) || text(runInput.offering),
    businessGoal: text(b.businessGoal),
    description: text(runInput.description) || text(b.businessGoal),
    industries: unique([...strings(b.targetIndustries), ...strings(runInput.industry)]),
    geographies: unique([...strings(b.geographies), ...strings(runInput.region)]),
    employeeBands: strings(b.employeeBands),
    buyerFunctions: strings(b.buyerFunctions),
    seniorityLevels: strings(b.seniorityLevels),
    targetTitles: unique(strings(runInput.targetTitles)),
    requiredSignals: unique([...strings(b.requiredSignals), ...strings(runInput.signals)]),
    signalWindowDays: Number.isFinite(windowDays) && windowDays > 0 ? Math.min(windowDays, 730) : 365,
  };
}

/** Domains from the workspace DNC list plus any DNC list sent with the run. */
export function buildDncList(dncEntries: unknown[], runInput: Record<string, unknown>): string[] {
  const fromWorkspace = dncEntries
    .map((e) => (e && typeof e === "object" ? (e as Record<string, unknown>).domain : e))
    .map((d) => normalizeDomain(String(d ?? "")));
  const fromRun = strings(runInput.dncList).map(normalizeDomain);
  return unique([...fromWorkspace, ...fromRun].filter(Boolean));
}

export function createLoadContext(deps: AgentDeps) {
  return async function loadContext(state: ProspectingStateType): Promise<ProspectingUpdate> {
    const run = await deps.repo.getRun(state.runId);
    if (!run) throw new Error(`Run ${state.runId} not found`);
    const workspace = await deps.repo.getWorkspace(run.workspaceId);
    if (!workspace) throw new Error(`Workspace ${run.workspaceId} not found`);

    const delivered = (await deps.repo.listDeliveredDomains(run.workspaceId)).map(normalizeDomain);
    const icp = buildIcpContext(workspace.icpBrief, run.icpInput);
    const targetCount = Math.max(1, Math.min(50, run.targetCount));

    await deps.repo.updateRun(run.id, {
      status: "running",
      started_at: deps.now().toISOString(),
      error_message: null,
      current_step: "Loading workspace ICP, DNC list and delivered accounts...",
      progress_percent: 5,
    });

    return {
      workspaceId: run.workspaceId,
      targetCount,
      minFitScore: deps.config.minFitScoreOverride ?? run.minIcpScore,
      icp,
      dnc: buildDncList(workspace.dncEntries, run.icpInput),
      deliveredDomains: unique(delivered.filter(Boolean)),
      budget: {
        maxCostUsd: Number((deps.config.budgetPerLeadUsd * targetCount).toFixed(2)),
        maxLlmCalls: deps.config.maxLlmCallsPerRun,
        maxSearches: deps.config.maxSearchesPerRun,
      },
      // A retried run reuses its thread: reset accumulated channels.
      accountResults: new Overwrite([]),
      usage: new Overwrite([]),
      errors: new Overwrite([]),
      candidates: [],
      decisions: [],
      publishedIds: [],
      stopped: false,
      stopReason: "",
    };
  };
}

// ---------------------------------------------------------------------------
// planQueries
// ---------------------------------------------------------------------------

const planSchema = z.object({
  queries: z.array(z.string().min(3).max(300)).min(1).max(30),
  personas: z.array(z.string().min(2).max(120)).max(20).default([]),
});

const GENERIC_WINDOW_TERMS = ["expansion", "funding", "launch", "acquisition", "hiring"];

function quoteOr(terms: string[]): string {
  return `(${terms.map((t) => `"${t}"`).join(" OR ")})`;
}

/** Deterministic, ICP-derived plan used when no LLM is available or it returns nothing usable. */
export function fallbackPlan(icp: IcpContext, maxQueries: number, year: number): { queries: string[]; personas: string[] } {
  const industries = icp.industries.length > 0 ? icp.industries : icp.description ? [icp.description.slice(0, 80)] : [];
  const geographies = icp.geographies.length > 0 ? icp.geographies : [""];
  const signalClause = quoteOr(icp.requiredSignals.length > 0 ? icp.requiredSignals.slice(0, 4) : GENERIC_WINDOW_TERMS);

  const queries = industries.flatMap((industry) =>
    geographies.map((geo) => [`"${industry}"`, "companies", geo, signalClause, String(year)].filter(Boolean).join(" "))
  );

  const combos = icp.seniorityLevels.flatMap((s) => icp.buyerFunctions.map((f) => `${s} ${f}`));
  const personas = unique([...icp.targetTitles, ...combos]).slice(0, 8);

  return { queries: unique(queries).slice(0, maxQueries), personas };
}

function mentionsIcp(query: string, icp: IcpContext): boolean {
  const terms = [...icp.industries, ...icp.geographies].map((t) => t.toLowerCase());
  if (terms.length === 0) return true;
  const q = query.toLowerCase();
  return terms.some((t) => q.includes(t));
}

export function createPlanQueries(deps: AgentDeps) {
  return async function planQueries(state: ProspectingStateType): Promise<ProspectingUpdate> {
    const { icp } = state;
    const max = deps.config.maxQueries;
    const year = deps.now().getFullYear();
    await reportProgress(deps, state.runId, "Planner: turning the ICP brief into search queries...", 10);

    const fallback = fallbackPlan(icp, max, year);
    if (fallback.queries.length === 0) {
      return {
        plannedQueries: [],
        personas: fallback.personas,
        errors: ["ICP brief has no industries or description; nothing to search for."],
      };
    }

    const result = await deps.tools.llm("planQueries", planSchema, {
      system:
        "You plan B2B account discovery web searches. Output JSON {\"queries\": string[], \"personas\": string[]}. " +
        "Each query must find COMPANIES (not people) that match the ICP and show a recent buying signal. " +
        "Every query must name at least one of the ICP industries and, when given, one of its geographies. " +
        "Never put job titles in queries. Personas are the job titles to contact, derived from the ICP.",
      user: `ICP:\n${JSON.stringify(icp)}\n\nReturn at most ${max} queries for the year ${year}.`,
    });

    if (!result.ok) {
      return {
        plannedQueries: fallback.queries,
        personas: fallback.personas,
        usage: result.usage,
        errors: [`planQueries fell back to the ICP template: ${result.error.code}`],
      };
    }

    const llmQueries = unique(result.value.queries.map((q) => q.trim())).filter((q) => mentionsIcp(q, icp));
    const queries = llmQueries.length >= 2 ? llmQueries.slice(0, max) : unique([...llmQueries, ...fallback.queries]).slice(0, max);
    const personas = unique([...icp.targetTitles, ...result.value.personas.map((p) => p.trim())]).slice(0, 8);

    return {
      plannedQueries: queries,
      personas: personas.length > 0 ? personas : fallback.personas,
      usage: result.usage,
    };
  };
}
