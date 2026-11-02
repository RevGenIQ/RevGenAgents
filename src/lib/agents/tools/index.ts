/**
 * Live AgentTools: wraps web search, Tavily Extract, the JSON LLM caller and the
 * existing enrichment / verification adapters, and meters every call as a
 * UsageEntry so budgetGuard and usage_events see real spend.
 */

import { enrichDecisionMaker } from "../../adapters/enrichment";
import { verifyEmailAddress } from "../../adapters/verification";
import type { AgentConfig } from "../config";
import type { AgentTools, ToolOutcome } from "../deps";
import type { ContactCandidate, UsageEntry } from "../types";
import { llmJson } from "./llmJson";
import { tavilyExtract, webSearch } from "./webSearch";

function entry(provider: string, eventType: string, calls: number, costUsd: number, tokens = 0): UsageEntry {
  return { provider, eventType, calls, tokens, costUsd: Number(costUsd.toFixed(5)) };
}

export function createLiveTools(config: AgentConfig): AgentTools {
  const { costs } = config;

  return {
    async search(query) {
      const result = await webSearch(query);
      const usage: UsageEntry[] = (["brave", "tavily"] as const)
        .filter((p) => result.calls[p] > 0)
        .map((p) => entry(p, "web_search", result.calls[p], result.calls[p] * costs.searchUsd));
      if (!result.ok) return { ok: false, error: { code: result.code, message: result.message }, usage };
      return { ok: true, value: result.hits, usage };
    },

    async extract(urls) {
      const result = await tavilyExtract(urls);
      if (!result.ok) {
        const usage = result.code === "NO_PROVIDER" ? [] : [entry("tavily", "page_extract", 1, costs.extractUsd)];
        return { ok: false, error: { code: result.code, message: result.message }, usage };
      }
      return { ok: true, value: result.pages, usage: [entry("tavily", "page_extract", 1, costs.extractUsd)] };
    },

    async llm(task, schema, prompt) {
      const result = await llmJson(schema, { system: prompt.system, user: prompt.user });
      const usage = result.attempts.map((a) =>
        entry(a.provider, `llm_${task}`, 1, (a.tokens / 1000) * costs.llmPer1kTokensUsd, a.tokens)
      );
      if (!result.ok) return { ok: false, error: { code: result.error.code, message: result.error.message }, usage };
      return { ok: true, value: result.data, usage };
    },

    async findContact(companyName, domain, titles): Promise<ToolOutcome<ContactCandidate | null>> {
      const apollo = !!process.env.APOLLO_API_KEY;
      const serper = !!process.env.SERPER_API_KEY;
      const usage: UsageEntry[] = [
        ...(apollo ? [entry("apollo", "contact_enrichment", 1, costs.enrichUsd)] : []),
        ...(serper ? [entry("serper", "contact_search", 1, costs.searchUsd)] : []),
      ];
      if (!apollo && !serper) {
        return { ok: false, error: { code: "NO_PROVIDER", message: "Neither APOLLO_API_KEY nor SERPER_API_KEY is configured." }, usage };
      }
      const person = await enrichDecisionMaker(companyName, domain, titles);
      if (person.emailSource === "placeholder") return { ok: true, value: null, usage };
      return {
        ok: true,
        usage,
        value: {
          firstName: person.firstName,
          lastName: person.lastName,
          title: person.title,
          seniority: person.seniority,
          department: person.department,
          workEmail: person.workEmail.toLowerCase().trim(),
          linkedinUrl: person.personalLinkedin,
          phone: person.mobileNumber || person.directNumber || null,
          roleStartDate: person.roleStartDate || null,
          roleConfirmed: person.currentRoleConfirmed,
          emailSource: person.emailSource,
          evidenceNote: person.employmentEvidenceNote,
        },
      };
    },

    async verifyEmail(email) {
      const configured = !!process.env.ZEROBOUNCE_API_KEY;
      const result = await verifyEmailAddress(email);
      const usage = configured ? [entry("zerobounce", "email_verification", 1, costs.verifyUsd)] : [];
      return { ok: true, value: { status: result.status, reason: result.reason }, usage };
    },
  };
}
