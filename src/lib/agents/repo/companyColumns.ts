/**
 * Maps a sourced CompanyProfile and categorised signals onto `companies`
 * columns. Numeric and date columns only receive values that parse cleanly;
 * the original text always survives in field_sources_json.
 */

import { groupSignals, SIGNAL_CATEGORIES } from "../profile/signalCategories";
import { dataConfidence, type CompanyProfile } from "../profile/types";
import type { EvidenceSignal } from "../types";

function text(profile: CompanyProfile, key: keyof CompanyProfile): string | null {
  const v = profile[key]?.value?.trim();
  return v ? v : null;
}

/** First whole number in a value such as "420", "1,200 employees" or "51-200" (lower bound). */
export function firstInteger(value: string | null): number | null {
  const m = value?.match(/\d[\d,]*/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

/** "2026-03-14" or "2026-03" -> a valid ISO date; anything else -> null. */
export function isoDateOrNull(value: string | null): string | null {
  const m = value?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] || "1")));
  return Number.isNaN(d.getTime()) || d.getUTCMonth() !== Number(m[2]) - 1 ? null : d.toISOString().slice(0, 10);
}

/** "$40M", "USD 1.2 billion", "40,000,000 USD" -> dollars; other currencies or vague text -> null. */
export function usdAmount(value: string | null): number | null {
  if (!value || !/(\$|usd|us dollars?)/i.test(value)) return null;
  const m = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|thousand|mn|million|m|bn|billion|b)?\b/i);
  if (!m) return null;
  const scale: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };
  const n = Number(m[1]) * (m[2] ? scale[m[2].toLowerCase()] : 1);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function profileColumns(profile: CompanyProfile, signals: EvidenceSignal[]): Record<string, unknown> {
  const employees = text(profile, "employeeCount");
  const founded = firstInteger(text(profile, "foundedYear"));
  const grouped = groupSignals(signals);
  const contact = [text(profile, "email"), text(profile, "phone")].filter(Boolean).join(" / ");
  const tech = text(profile, "techStack");

  return {
    linkedin_url: text(profile, "linkedinUrl"),
    company_linkedin: text(profile, "linkedinUrl"),
    facebook_url: text(profile, "facebookUrl"),
    twitter_url: text(profile, "twitterUrl"),
    company_email_phone: contact || null,
    employee_count: firstInteger(employees),
    employee_count_band: employees,
    company_type: text(profile, "companyType"),
    company_keywords: text(profile, "keywords"),
    tech_stack: tech ? tech.split(/\s*,\s*/).filter(Boolean) : [],
    founded_year: founded && founded > 1700 && founded <= new Date().getUTCFullYear() ? founded : null,
    sic_codes: text(profile, "sicCodes"),
    naics_codes: text(profile, "naicsCodes"),
    company_city: text(profile, "city"),
    company_state: text(profile, "state"),
    hq_location: text(profile, "hqLocation"),
    company_revenue: text(profile, "annualRevenue"),
    latest_funding: text(profile, "latestFundingRound"),
    latest_funding_amount: text(profile, "latestFundingAmount"),
    last_raised_at: isoDateOrNull(text(profile, "lastRaisedAt")),
    company_description: text(profile, "description"),
    data_confidence: dataConfidence(profile),
    total_targeted_signals: signals.length,
    signals_json: Object.fromEntries(
      SIGNAL_CATEGORIES.map((c) => [c, grouped[c].map((s) => ({ title: s.title, quote: s.quote, url: s.sourceUrl, date: s.sourceDate, type: s.signalType }))])
    ),
    field_sources_json: Object.fromEntries(
      Object.entries(profile).map(([k, f]) => [k, { value: f?.value, sourceUrl: f?.sourceUrl, method: f?.method }])
    ),
    total_funding_usd: usdAmount(text(profile, "totalFunding")),
  };
}
