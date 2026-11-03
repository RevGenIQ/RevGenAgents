/**
 * Rules-first account scoring, so every score can be explained:
 *   ICP match 30 (industry 12, geography 10, size 8)
 *   Signals 30 (categories covered and count)
 *   Data completeness 20 (Data_Confidence)
 *   Timing 20 (age of the newest signal)
 * The model may then move the total by at most ±10, and must say why.
 */

import type { CandidateCompany, EvidenceSignal, IcpContext } from "../types";
import { categorizeSignal } from "./signalCategories";
import { dataConfidence, type CompanyProfile } from "./types";

export const MAX_LLM_ADJUSTMENT = 10;

export interface RuleScore {
  icpMatch: number;
  signals: number;
  completeness: number;
  timing: number;
  total: number;
  notes: string[];
}

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
}

function overlaps(haystack: string, needles: string[]): boolean {
  const words = new Set(tokens(haystack));
  return needles.some((n) => {
    const t = tokens(n);
    return t.length > 0 && t.every((w) => words.has(w));
  });
}

/** Parses "50-200", "1,000+", "500" into [min, max]. */
export function parseBand(band: string): [number, number] | null {
  const nums = (band.match(/\d[\d,]*/g) || []).map((n) => Number(n.replace(/,/g, "")));
  if (nums.length === 0) return null;
  if (nums.length === 1) return band.includes("+") ? [nums[0], Number.POSITIVE_INFINITY] : [nums[0], nums[0]];
  return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
}

function employeeNumber(value: string | undefined): number | null {
  const band = value ? parseBand(value) : null;
  if (!band) return null;
  return Number.isFinite(band[1]) ? Math.round((band[0] + band[1]) / 2) : band[0];
}

function icpMatch(icp: IcpContext, candidate: CandidateCompany, profile: CompanyProfile, notes: string[]): number {
  const industryText = `${candidate.industry} ${profile.industry?.value || ""} ${profile.keywords?.value || ""} ${profile.description?.value || ""}`;
  const placeText = `${candidate.country} ${profile.country?.value || ""} ${profile.hqLocation?.value || ""} ${profile.city?.value || ""}`;

  const industry = icp.industries.length === 0 || overlaps(industryText, icp.industries) ? 12 : 0;
  const geo = icp.geographies.length === 0 || overlaps(placeText, icp.geographies) ? 10 : 0;

  const employees = employeeNumber(profile.employeeCount?.value);
  const bands = icp.employeeBands.map(parseBand).filter((b): b is [number, number] => !!b);
  const size =
    bands.length === 0 ? 8 : employees === null ? 4 : bands.some(([lo, hi]) => employees >= lo && employees <= hi) ? 8 : 0;

  if (industry === 0) notes.push("Industry does not match the ICP.");
  if (geo === 0) notes.push("Location is outside the ICP geographies.");
  if (size === 0) notes.push("Company size is outside the ICP bands.");
  if (size === 4) notes.push("Company size unknown.");
  return industry + geo + size;
}

function signalPoints(signals: EvidenceSignal[]): number {
  const categories = new Set(signals.map(categorizeSignal)).size;
  return Math.min(30, categories * 8 + Math.min(signals.length, 4) * 2);
}

function timingPoints(signals: EvidenceSignal[], now: Date): number {
  const newest = signals.map((s) => new Date(s.sourceDate).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];
  if (!newest) return 0;
  const days = (now.getTime() - newest) / 86_400_000;
  if (days <= 30) return 20;
  if (days <= 90) return 15;
  if (days <= 180) return 10;
  if (days <= 365) return 5;
  return 0;
}

export function ruleScore(
  icp: IcpContext,
  candidate: CandidateCompany,
  profile: CompanyProfile,
  signals: EvidenceSignal[],
  now: Date
): RuleScore {
  const notes: string[] = [];
  const parts = {
    icpMatch: icpMatch(icp, candidate, profile, notes),
    signals: signalPoints(signals),
    completeness: Math.round(dataConfidence(profile) / 5),
    timing: timingPoints(signals, now),
  };
  return { ...parts, total: parts.icpMatch + parts.signals + parts.completeness + parts.timing, notes };
}

/** Applies the model's adjustment, clamped to ±10 and to the 0-100 range. */
export function adjustedScore(rule: RuleScore, adjustment: number): number {
  const delta = Math.max(-MAX_LLM_ADJUSTMENT, Math.min(MAX_LLM_ADJUSTMENT, Math.round(adjustment || 0)));
  return Math.max(0, Math.min(100, rule.total + delta));
}

/** Priority from the final score: the same bands the dossier tiers use. */
export function priorityFor(score: number): "High" | "Medium" | "Low" {
  return score >= 75 ? "High" : score >= 55 ? "Medium" : "Low";
}
