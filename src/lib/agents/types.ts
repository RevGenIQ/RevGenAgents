/**
 * Domain types shared by the prospecting graph, its nodes, tools and repository.
 */

import * as z from "zod";
import type { EmailStatus } from "../supabase/types";

/** Normalised ICP brief: built from workspaces.icp_brief, falling back to research_runs.icp_input. */
export interface IcpContext {
  offering: string;
  businessGoal: string;
  description: string;
  industries: string[];
  geographies: string[];
  employeeBands: string[];
  buyerFunctions: string[];
  seniorityLevels: string[];
  targetTitles: string[];
  requiredSignals: string[];
  signalWindowDays: number;
}

/** One search hit kept as evidence for a candidate company. */
export interface SourceSnippet {
  url: string;
  title: string;
  content: string;
  publishedDate: string | null;
}

export interface CandidateCompany {
  name: string;
  domain: string;
  industry: string;
  country: string;
  whyItMatches: string;
  sources: SourceSnippet[];
}

/** A buying signal that survived evidence checks: every field is required. */
export interface EvidenceSignal {
  signalType: string;
  title: string;
  quote: string;
  sourceUrl: string;
  sourceDate: string;
}

export interface FitScore {
  fitScore: number;
  intentScore: number;
  combined: number;
  rationale: string;
  /** Rules-first breakdown (ICP 30, signals 30, completeness 20, timing 20) before the model's adjustment. */
  breakdown?: { icpMatch: number; signals: number; completeness: number; timing: number; adjustment: number };
  whyIcpFit?: string;
  whatToPitch?: string;
}

export interface ContactCandidate {
  firstName: string;
  lastName: string;
  title: string;
  seniority: string;
  department: string;
  workEmail: string;
  linkedinUrl: string;
  phone: string | null;
  roleStartDate: string | null;
  roleConfirmed: boolean;
  emailSource: "provider" | "pattern_guess";
  evidenceNote: string;
}

export interface VerifiedContact extends ContactCandidate {
  emailStatus: EmailStatus;
  /** True only when a provider confirmed the role AND the email is deliverable. */
  verified: boolean;
  verificationReason: string;
}

export interface Dossier {
  summary: string;
  opener: string;
  talkingPoints: string[];
  painPoint: string;
  tier: "P1" | "P2" | "P3";
  windowDays: number;
}

export interface UsageEntry {
  provider: string;
  eventType: string;
  calls: number;
  tokens: number;
  costUsd: number;
}

export type AccountOutcome = "persisted" | "discarded" | "stopped" | "failed";

export interface AccountResult {
  name: string;
  domain: string;
  outcome: AccountOutcome;
  reason: string;
  companyId: string | null;
  score: number | null;
  signals: number;
  verifiedContacts: number;
  headline: string;
  contactSummary: string;
}

export interface RunBudget {
  maxCostUsd: number;
  maxLlmCalls: number;
  maxSearches: number;
}

/** The candidate card a Humagent reviews at the interrupt. */
export interface ReviewCard {
  companyId: string;
  name: string;
  domain: string;
  score: number | null;
  signals: number;
  verifiedContacts: number;
  headline: string;
  contactSummary: string;
}

export const reviewDecisionSchema = z.object({
  companyId: z.string().min(1).max(64),
  action: z.enum(["approve", "reject"]),
});

export const reviewResumeSchema = z.object({
  decisions: z.array(reviewDecisionSchema).max(200),
});

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type ReviewResume = z.infer<typeof reviewResumeSchema>;

/** `research_runs.current_step` prefix while a run is paused at humagentReview (the status column has no "awaiting" value). */
export const AWAITING_REVIEW_PREFIX = "Awaiting Humagent review";

/** Payload passed to interrupt() and returned to the review UI. */
export interface ReviewRequest {
  kind: "humagent_review";
  runId: string;
  workspaceId: string;
  cards: ReviewCard[];
}
