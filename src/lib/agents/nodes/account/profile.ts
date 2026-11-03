/**
 * profileCompany (Profiler): builds the company's firmographic profile with a
 * free-first waterfall (website and JSON-LD, tech signatures and MX, Wikidata,
 * then quote-checked LLM extraction), adds dated hiring / news / social
 * signals, and re-searches once for required fields that are still empty.
 */

import { collectHiring, collectNewsAndSocial, collectWebsite, collectWikidata, type SourceDoc } from "../../profile/collect";
import { EXTRACTABLE_FIELDS, extractionPrompt, extractionSchema, validateExtraction } from "../../profile/extract";
import { dataConfidence, mergeProfiles, missingRequired, type CompanyProfile } from "../../profile/types";
import type { AgentDeps } from "../../deps";
import type { AccountStateType, AccountUpdate } from "../../state";
import type { EvidenceSignal, UsageEntry } from "../../types";
import { finishTask, startTask } from "../guards";

const MAX_DOCS = 5;

async function extractFields(
  deps: AgentDeps,
  name: string,
  domain: string,
  docs: SourceDoc[],
  wanted: readonly string[]
): Promise<{ profile: CompanyProfile; usage: UsageEntry[]; ok: boolean }> {
  if (docs.length === 0 || wanted.length === 0) return { profile: {}, usage: [], ok: true };
  const llm = await deps.tools.llm("profileCompany", extractionSchema, extractionPrompt(name, domain, docs, wanted));
  if (!llm.ok) return { profile: {}, usage: llm.usage, ok: false };
  return { profile: validateExtraction(llm.value, docs, docs[0].url), usage: llm.usage, ok: true };
}

function dedupeSignals(existing: EvidenceSignal[], added: EvidenceSignal[]): EvidenceSignal[] {
  const seen = new Set(existing.map((s) => s.sourceUrl));
  return [...existing, ...added.filter((s) => !seen.has(s.sourceUrl) && seen.add(s.sourceUrl))];
}

export function createProfileCompany(deps: AgentDeps) {
  return async function profileCompany(state: AccountStateType): Promise<AccountUpdate> {
    const { candidate, context } = state;
    const now = deps.now();
    const taskId = await startTask(deps, {
      runId: context.runId,
      workspaceId: context.workspaceId,
      taskType: "Profiler",
      companyName: candidate.name,
      companyDomain: candidate.domain,
      output: {},
    });

    const [site, wiki, feeds] = await Promise.all([
      collectWebsite(deps.tools, candidate.domain),
      collectWikidata(deps.tools, candidate.name, candidate.domain),
      collectNewsAndSocial(deps.tools, candidate.name, context.icp.requiredSignals, context.icp.signalWindowDays, now),
    ]);
    const hiring = await collectHiring(deps.tools, site.html, context.icp.signalWindowDays, now);

    const sourceDocs: SourceDoc[] = [
      ...site.docs,
      ...candidate.sources.map((s) => ({ url: s.url, text: `${s.title}. ${s.content}`.slice(0, 1500) })),
    ].slice(0, MAX_DOCS);
    const usage: UsageEntry[] = [];
    const first = await extractFields(deps, candidate.name, candidate.domain, sourceDocs, EXTRACTABLE_FIELDS);
    usage.push(...first.usage);
    let profile = mergeProfiles(site.profile, wiki, first.profile);

    // Reflect once: search for required facts the site and registries did not state.
    const missing = missingRequired(profile).filter((f) => (EXTRACTABLE_FIELDS as readonly string[]).includes(f));
    let researched = false;
    if (missing.length > 0) {
      const search = await deps.tools.search(`"${candidate.name}" ${candidate.domain} headquarters employees founded funding`);
      usage.push(...search.usage);
      if (search.ok && search.value.length > 0) {
        researched = true;
        const docs = search.value.slice(0, MAX_DOCS).map((h) => ({ url: h.url, text: `${h.title}. ${h.content}`.slice(0, 1200) }));
        const second = await extractFields(deps, candidate.name, candidate.domain, docs, missing);
        usage.push(...second.usage);
        profile = mergeProfiles(profile, second.profile);
      }
    }

    const signals = dedupeSignals(state.signals, [...hiring, ...feeds]);
    const confidence = dataConfidence(profile);
    await finishTask(deps, taskId, "completed", {
      fieldsFound: Object.keys(profile).length,
      dataConfidence: confidence,
      sources: { website: site.docs.length > 0, wikidata: Object.keys(wiki).length > 0, hiring: hiring.length, news: feeds.length },
      researchedMissing: researched,
      missing: missingRequired(profile),
      ...(first.ok ? {} : { llm: "extraction unavailable" }),
    });
    return { profile, signals, usage };
  };
}
