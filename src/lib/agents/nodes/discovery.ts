/**
 * discoverCompanies (Scout) and dedupeFilter.
 * Companies are only accepted when the LLM's answer is grounded in the search
 * results: the name must appear in a cited hit and the cited URLs must be real hits.
 */

import * as z from "zod";
import type { AgentDeps } from "../deps";
import type { ProspectingStateType, ProspectingUpdate } from "../state";
import type { CandidateCompany, SourceSnippet, UsageEntry } from "../types";
import { isGenericHost, matchesDomain, normalizeDomain } from "./domains";
import { finishTask, reportProgress, startTask } from "./guards";

const MAX_HITS_FOR_LLM = 40;
const MAX_CANDIDATES = 25;

const discoverySchema = z.object({
  companies: z
    .array(
      z.object({
        name: z.string().min(2).max(160),
        domain: z.string().max(200).default(""),
        industry: z.string().max(160).default(""),
        country: z.string().max(120).default(""),
        whyItMatches: z.string().max(400).default(""),
        sourceUrls: z.array(z.string()).max(10).default([]),
      })
    )
    .max(50),
});

function groundCandidate(
  raw: z.infer<typeof discoverySchema>["companies"][number],
  hitsByUrl: Map<string, SourceSnippet>
): CandidateCompany | null {
  const name = raw.name.trim();
  const domain = normalizeDomain(raw.domain);
  if (!domain || isGenericHost(domain)) return null;

  const lowerName = name.toLowerCase();
  const sources = raw.sourceUrls
    .map((u) => hitsByUrl.get(u.trim()))
    .filter((h): h is SourceSnippet => !!h)
    .filter((h) => `${h.title} ${h.content}`.toLowerCase().includes(lowerName));
  if (sources.length === 0) return null;

  return {
    name,
    domain,
    industry: raw.industry.trim(),
    country: raw.country.trim(),
    whyItMatches: raw.whyItMatches.trim(),
    sources,
  };
}

export function createDiscoverCompanies(deps: AgentDeps) {
  return async function discoverCompanies(state: ProspectingStateType): Promise<ProspectingUpdate> {
    const { runId, workspaceId, plannedQueries, icp } = state;
    await reportProgress(deps, runId, `Scout: running ${plannedQueries.length} ICP search queries...`, 15);
    const taskId = await startTask(deps, {
      runId,
      workspaceId,
      taskType: "Scout",
      companyName: "Market Discovery",
      companyDomain: "",
      output: { queries: plannedQueries },
    });

    const usage: UsageEntry[] = [];
    const errors: string[] = [];
    const hits: SourceSnippet[] = [];
    for (const query of plannedQueries) {
      const result = await deps.tools.search(query);
      usage.push(...result.usage);
      if (result.ok) hits.push(...result.value);
      else errors.push(`search failed (${result.error.code}): ${result.error.message}`);
    }

    const hitsByUrl = new Map(hits.map((h) => [h.url, h] as const));
    if (hitsByUrl.size === 0) {
      await finishTask(deps, taskId, "completed", { candidatesDiscovered: 0, errors });
      return { candidates: [], usage, errors: [...errors, "Discovery returned no search results."] };
    }

    const evidence = [...hitsByUrl.values()].slice(0, MAX_HITS_FOR_LLM).map((h) => ({
      url: h.url,
      title: h.title,
      content: h.content.slice(0, 400),
      publishedDate: h.publishedDate,
    }));
    const wanted = Math.min(MAX_CANDIDATES, state.targetCount * 2);
    const llm = await deps.tools.llm("discoverCompanies", discoverySchema, {
      system:
        "You extract real companies from web search results for B2B prospecting. Output JSON " +
        '{"companies":[{"name","domain","industry","country","whyItMatches","sourceUrls"}]}. ' +
        "Only include companies named in the results that match the ICP. domain is the company's own website domain. " +
        "sourceUrls must be copied exactly from the results that mention the company. Never invent companies, domains or URLs. " +
        "Exclude publishers, directories, event organisers and the seller's competitors.",
      user: `ICP:\n${JSON.stringify(icp)}\n\nSearch results:\n${JSON.stringify(evidence)}\n\nReturn at most ${wanted} companies.`,
    });
    usage.push(...llm.usage);

    if (!llm.ok) {
      const message = `Company extraction failed (${llm.error.code}): ${llm.error.message}`;
      await finishTask(deps, taskId, "failed", { candidatesDiscovered: 0, error: message });
      return { candidates: [], usage, errors: [...errors, message] };
    }

    const candidates = llm.value.companies
      .map((c) => groundCandidate(c, hitsByUrl))
      .filter((c): c is CandidateCompany => !!c)
      .slice(0, wanted);

    await finishTask(deps, taskId, "completed", {
      searchHits: hitsByUrl.size,
      proposed: llm.value.companies.length,
      candidatesDiscovered: candidates.length,
    });
    return { candidates, usage, errors };
  };
}

export function createDedupeFilter(deps: AgentDeps) {
  return async function dedupeFilter(state: ProspectingStateType): Promise<ProspectingUpdate> {
    const seenDomains = new Set<string>();
    const seenNames = new Set<string>();
    const dropped: string[] = [];

    const kept = state.candidates.filter((c) => {
      const domain = normalizeDomain(c.domain);
      const nameKey = c.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const reason = !domain
        ? "invalid domain"
        : matchesDomain(domain, state.dnc)
        ? "on DNC list"
        : matchesDomain(domain, state.deliveredDomains)
        ? "already delivered"
        : seenDomains.has(domain) || seenNames.has(nameKey)
        ? "duplicate"
        : null;
      if (reason) {
        dropped.push(`${c.name} (${reason})`);
        return false;
      }
      seenDomains.add(domain);
      seenNames.add(nameKey);
      return true;
    });

    const capped = kept.slice(0, state.targetCount).map((c) => ({ ...c, domain: normalizeDomain(c.domain) }));
    await reportProgress(
      deps,
      state.runId,
      `Dedupe: ${capped.length} new accounts to research (${dropped.length} dropped by DNC, delivery history or duplicates).`,
      25
    );
    return { candidates: capped };
  };
}
