/**
 * Graph state definitions.
 * ProspectingState is the main graph (thread_id = research_runs.id).
 * AccountState is the per-company AccountPipeline subgraph.
 * List channels use concat reducers so parallel AccountPipeline branches merge;
 * loadContext resets them with Overwrite so a retried run starts clean.
 */

import { Annotation } from "@langchain/langgraph";
import type {
  AccountOutcome,
  AccountResult,
  CandidateCompany,
  ContactCandidate,
  Dossier,
  EvidenceSignal,
  FitScore,
  IcpContext,
  ReviewDecision,
  RunBudget,
  UsageEntry,
  VerifiedContact,
} from "./types";

function concat<T>(left: T[], right: T[]): T[] {
  return [...left, ...right];
}

export const EMPTY_ICP: IcpContext = {
  offering: "",
  businessGoal: "",
  description: "",
  industries: [],
  geographies: [],
  employeeBands: [],
  buyerFunctions: [],
  seniorityLevels: [],
  targetTitles: [],
  requiredSignals: [],
  signalWindowDays: 365,
};

export const ProspectingState = Annotation.Root({
  runId: Annotation<string>,
  workspaceId: Annotation<string>,
  targetCount: Annotation<number>,
  minFitScore: Annotation<number>,
  icp: Annotation<IcpContext>({ reducer: (_l, r) => r, default: () => EMPTY_ICP }),
  /** Normalised DNC domains. */
  dnc: Annotation<string[]>({ reducer: (_l, r) => r, default: () => [] }),
  deliveredDomains: Annotation<string[]>({ reducer: (_l, r) => r, default: () => [] }),
  plannedQueries: Annotation<string[]>({ reducer: (_l, r) => r, default: () => [] }),
  personas: Annotation<string[]>({ reducer: (_l, r) => r, default: () => [] }),
  candidates: Annotation<CandidateCompany[]>({ reducer: (_l, r) => r, default: () => [] }),
  accountResults: Annotation<AccountResult[]>({ reducer: concat, default: () => [] }),
  usage: Annotation<UsageEntry[]>({ reducer: concat, default: () => [] }),
  budget: Annotation<RunBudget>({
    reducer: (_l, r) => r,
    default: () => ({ maxCostUsd: 0, maxLlmCalls: 0, maxSearches: 0 }),
  }),
  decisions: Annotation<ReviewDecision[]>({ reducer: (_l, r) => r, default: () => [] }),
  publishedIds: Annotation<string[]>({ reducer: (_l, r) => r, default: () => [] }),
  stopped: Annotation<boolean>({ reducer: (_l, r) => r, default: () => false }),
  stopReason: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  errors: Annotation<string[]>({ reducer: concat, default: () => [] }),
});

export type ProspectingStateType = typeof ProspectingState.State;
export type ProspectingUpdate = typeof ProspectingState.Update;

/** Shared, read-only run context handed to every AccountPipeline branch. */
export interface AccountTaskContext {
  runId: string;
  workspaceId: string;
  icp: IcpContext;
  personas: string[];
  minFitScore: number;
}

/** Input schema of the fan-out node: Send() delivers one of these per company. */
export const AccountTaskInput = Annotation.Root({
  task: Annotation<{ context: AccountTaskContext; candidate: CandidateCompany }>,
});

export const AccountState = Annotation.Root({
  context: Annotation<AccountTaskContext>,
  candidate: Annotation<CandidateCompany>,
  signals: Annotation<EvidenceSignal[]>({ reducer: (_l, r) => r, default: () => [] }),
  score: Annotation<FitScore | null>({ reducer: (_l, r) => r, default: () => null }),
  contacts: Annotation<ContactCandidate[]>({ reducer: (_l, r) => r, default: () => [] }),
  verified: Annotation<VerifiedContact[]>({ reducer: (_l, r) => r, default: () => [] }),
  dossier: Annotation<Dossier | null>({ reducer: (_l, r) => r, default: () => null }),
  usage: Annotation<UsageEntry[]>({ reducer: concat, default: () => [] }),
  outcome: Annotation<AccountOutcome | null>({ reducer: (_l, r) => r, default: () => null }),
  reason: Annotation<string>({ reducer: (_l, r) => r, default: () => "" }),
  companyId: Annotation<string | null>({ reducer: (_l, r) => r, default: () => null }),
});

export type AccountStateType = typeof AccountState.State;
export type AccountUpdate = typeof AccountState.Update;
