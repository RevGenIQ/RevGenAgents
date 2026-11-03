/**
 * LLM extraction of the firmographic fields that pages state in prose
 * (headcount, revenue, funding, HQ...). Each value must cite one of the given
 * pages and quote it; code keeps a value only when that quote is really on
 * that page. Industry codes must come from the official lists in codes.ts.
 */

import * as z from "zod";
import { normaliseText } from "../nodes/account/signals";
import { NAICS_SECTORS, SIC_DIVISIONS, codeListsForPrompt, naicsLabel, sicLabel } from "./codes";
import type { SourceDoc } from "./collect";
import type { CompanyProfile, ProfileFieldName } from "./types";

export const EXTRACTABLE_FIELDS = [
  "employeeCount",
  "industry",
  "companyType",
  "keywords",
  "foundedYear",
  "city",
  "state",
  "country",
  "hqLocation",
  "annualRevenue",
  "totalFunding",
  "latestFundingRound",
  "latestFundingAmount",
  "lastRaisedAt",
  "description",
] as const satisfies readonly ProfileFieldName[];

const sourced = z
  .object({ value: z.string().max(400), sourceUrl: z.string().max(1000), quote: z.string().max(400) })
  .nullable()
  .optional();

export const extractionSchema = z.object({
  fields: z.object(Object.fromEntries(EXTRACTABLE_FIELDS.map((f) => [f, sourced])) as Record<(typeof EXTRACTABLE_FIELDS)[number], typeof sourced>),
  naicsSector: z.string().max(10).nullable().optional(),
  sicDivision: z.string().max(12).nullable().optional(),
});

export type Extraction = z.infer<typeof extractionSchema>;

const MIN_QUOTE = 4;

export function extractionPrompt(companyName: string, domain: string, docs: SourceDoc[], wanted: readonly string[]): { system: string; user: string } {
  return {
    system:
      "You extract company facts for a B2B research file. Use ONLY the pages provided. For each requested field return " +
      '{"value","sourceUrl","quote"} where sourceUrl is one of the page URLs and quote is copied word for word from that page and contains the fact; ' +
      "return null when the pages do not state it. Never estimate or infer numbers. companyType is e.g. Private, Public, Subsidiary, Non-profit. " +
      "lastRaisedAt is YYYY-MM-DD or YYYY-MM. Then choose naicsSector and sicDivision ONLY from these lists (the key, e.g. \"54\" or \"I (70-89)\"), or null:\n" +
      codeListsForPrompt() +
      '\nOutput JSON {"fields":{...},"naicsSector":...,"sicDivision":...}.',
    user: `Company: ${companyName} (${domain})\nFields wanted: ${wanted.join(", ")}\nPages:\n${JSON.stringify(docs)}`,
  };
}

/** Keeps only values whose quote is on the cited page, plus codes that exist on the official lists. */
export function validateExtraction(raw: Extraction, docs: SourceDoc[], fallbackSource: string): CompanyProfile {
  const byUrl = new Map(docs.map((d) => [d.url, normaliseText(d.text)]));
  const kept = Object.entries(raw.fields).flatMap(([name, f]) => {
    if (!f || !f.value.trim()) return [];
    const page = byUrl.get(f.sourceUrl.trim());
    const quote = normaliseText(f.quote || "");
    if (!page || quote.length < MIN_QUOTE || !page.includes(quote)) return [];
    return [[name, { value: f.value.trim(), sourceUrl: f.sourceUrl.trim(), method: "ai_extracted" as const }]];
  });
  const naics = raw.naicsSector && NAICS_SECTORS[raw.naicsSector.trim()] ? naicsLabel(raw.naicsSector) : "";
  const sic = raw.sicDivision && SIC_DIVISIONS[raw.sicDivision.trim()] ? sicLabel(raw.sicDivision) : "";
  return {
    ...Object.fromEntries(kept),
    ...(naics ? { naicsCodes: { value: naics, sourceUrl: fallbackSource, method: "ai_extracted" as const } } : {}),
    ...(sic ? { sicCodes: { value: sic, sourceUrl: fallbackSource, method: "ai_extracted" as const } } : {}),
  };
}
