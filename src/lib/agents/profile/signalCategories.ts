/**
 * Groups evidence signals into the five targeted-signal columns of the
 * delivery CSV: ICP, Hiring, Funding/Partnership, News/Article and Social.
 */

import type { EvidenceSignal } from "../types";

export const SIGNAL_CATEGORIES = ["icp", "hiring", "funding_partnership", "news", "social"] as const;
export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];

export const SIGNAL_CATEGORY_LABEL: Record<SignalCategory, string> = {
  icp: "ICP signal",
  hiring: "Hiring signal",
  funding_partnership: "Funding / partnership signal",
  news: "News / article signal",
  social: "Social media signal",
};

const SOCIAL_HOSTS = /(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|reddit\.com|news\.ycombinator\.com|producthunt\.com)/i;

export function categorizeSignal(s: EvidenceSignal): SignalCategory {
  const text = `${s.signalType} ${s.title}`.toLowerCase();
  if (/hir(e|ing)|job|recruit|opening|headcount|talent/.test(text)) return "hiring";
  if (/fund|rais|series [a-f]|seed|invest|acqui|merger|partner|alliance|ipo|valuation/.test(text)) return "funding_partnership";
  if (SOCIAL_HOSTS.test(s.sourceUrl)) return "social";
  if (/launch|expan|new (plant|office|market|product)|news|announce|award|contract|order/.test(text)) return "news";
  return "icp";
}

export type CategorizedSignals = Record<SignalCategory, EvidenceSignal[]>;

/** Signals grouped by category, newest first within each group. */
export function groupSignals(signals: EvidenceSignal[]): CategorizedSignals {
  const empty: CategorizedSignals = { icp: [], hiring: [], funding_partnership: [], news: [], social: [] };
  const grouped = signals.reduce<CategorizedSignals>((acc, s) => {
    const c = categorizeSignal(s);
    return { ...acc, [c]: [...acc[c], s] };
  }, empty);
  return Object.fromEntries(
    Object.entries(grouped).map(([k, list]) => [k, [...list].sort((a, b) => b.sourceDate.localeCompare(a.sourceDate))])
  ) as CategorizedSignals;
}
