/**
 * Dependency contracts for the agent graphs.
 * Nodes never import Supabase or call providers directly: they receive an
 * AgentRepo (persistence) and AgentTools (network) so tests can inject fakes.
 */

import type * as z from "zod";
import type { EmailStatus } from "../supabase/types";
import type { AgentConfig } from "./config";
import type { CompanyProfile } from "./profile/types";
import type {
  ContactCandidate,
  EvidenceSignal,
  SourceSnippet,
  UsageEntry,
} from "./types";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export interface ToolError {
  code: string;
  message: string;
}

/** Every tool call reports the usage it caused, whether it succeeded or not. */
export type ToolOutcome<T> =
  | { ok: true; value: T; usage: UsageEntry[] }
  | { ok: false; error: ToolError; usage: UsageEntry[] };

export type LlmTask =
  | "planQueries"
  | "discoverCompanies"
  | "extractSignals"
  | "profileCompany"
  | "scoreFit"
  | "writeDossier";

export interface LlmPrompt {
  system: string;
  user: string;
}

export interface ExtractedPage {
  url: string;
  content: string;
}

export interface EmailCheck {
  status: EmailStatus;
  reason: string;
}

export interface AgentTools {
  search(query: string): Promise<ToolOutcome<SourceSnippet[]>>;
  extract(urls: string[]): Promise<ToolOutcome<ExtractedPage[]>>;
  llm<T>(task: LlmTask, schema: z.ZodType<T>, prompt: LlmPrompt): Promise<ToolOutcome<T>>;
  /** Returns null when no named person was found (placeholders are never returned). */
  findContact(
    companyName: string,
    domain: string,
    titles: string[]
  ): Promise<ToolOutcome<ContactCandidate | null>>;
  verifyEmail(email: string): Promise<ToolOutcome<EmailCheck>>;
  /** Public page or JSON fetch (SSRF-checked, size and time limited). */
  fetchPage(url: string): Promise<ToolOutcome<FetchedDocument>>;
  /** MX exchange hosts for a domain (empty when none). */
  lookupMx(domain: string): Promise<string[]>;
}

export interface FetchedDocument {
  url: string;
  contentType: string;
  headers: Record<string, string>;
  body: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export interface RunRecord {
  id: string;
  workspaceId: string;
  status: string;
  targetCount: number;
  minIcpScore: number;
  icpInput: Record<string, unknown>;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  icpBrief: Record<string, unknown> | null;
  dncEntries: unknown[];
}

/** Column names match research_runs. */
export interface RunPatch {
  status?: "queued" | "running" | "completed" | "stopped" | "failed";
  current_step?: string;
  progress_percent?: number;
  leads_found?: number;
  leads_verified?: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string | null;
}

export type TaskType = "Scout" | "Analyst" | "Profiler" | "Matcher" | "Verifier" | "Writer" | "Reviewer";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TaskInput {
  runId: string;
  workspaceId: string;
  taskType: TaskType;
  companyName: string;
  companyDomain: string;
  status: TaskStatus;
  output: Record<string, unknown>;
}

export interface CompanyUpsert {
  workspaceId: string;
  domain: string;
  name: string;
  industry: string;
  country: string;
  overview: string;
  icpScore: number;
  fitReason: string;
  scoring: Record<string, unknown>;
  priorityBand: "High Priority" | "Medium Priority" | "Watchlist";
  signalHeadline: string;
  signalBody: string;
  painPoint: string;
  opener: string;
  contactsJson: Record<string, unknown>[];
  evidenceJson: Record<string, unknown>[];
  runId: string;
  profile: CompanyProfile;
  signals: EvidenceSignal[];
  whyIcpFit: string;
  whatToPitch: string;
}

export interface CompanyDraft {
  workspaceId: string;
  domain: string;
  name: string;
  runId: string;
}

export interface ContactUpsert {
  workspaceId: string;
  companyId: string;
  companyName: string;
  companyDomain: string;
  firstName: string;
  lastName: string;
  title: string;
  seniority: string;
  department: string;
  workEmail: string;
  linkedinUrl: string;
  phone: string | null;
  country: string;
  roleStartDate: string | null;
  verificationStatus: "verified_current" | "unverified";
  emailStatus: EmailStatus;
  icpScore: number;
  icpReason: string;
}

export interface SignalInsert {
  signalType: string;
  title: string;
  quote: string;
  sourceUrl: string;
  sourceDate: string;
  confidence: number;
  explanation: string;
}

export interface DossierUpsert {
  workspaceId: string;
  companyId: string;
  targetContactId: string | null;
  summary: string;
  icpScore: number;
  breakdown: Record<string, unknown>;
  windowDays: number;
  tier: "P1" | "P2" | "P3";
  triggers: Record<string, unknown>[];
  opener: string;
  talkingPoints: string[];
}

export interface PublishedCompany {
  id: string;
  name: string;
  domain: string;
}

export interface UsageEventInsert {
  workspaceId: string;
  runId: string;
  provider: string;
  eventType: string;
  tokensUsed: number;
  apiCalls: number;
  costUsd: number;
}

export interface AuditLogInsert {
  workspaceId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
}

/**
 * Persistence contract. Every method throws AgentRepoError when Supabase
 * returns an error, so failures are never silently ignored.
 */
export interface AgentRepo {
  getRun(runId: string): Promise<RunRecord | null>;
  getWorkspace(workspaceId: string): Promise<WorkspaceRecord | null>;
  listDeliveredDomains(workspaceId: string): Promise<string[]>;
  isStopRequested(runId: string): Promise<boolean>;
  updateRun(runId: string, patch: RunPatch): Promise<void>;
  recordTask(task: TaskInput): Promise<string | null>;
  completeTask(taskId: string, status: TaskStatus, output: Record<string, unknown>): Promise<void>;
  /** Idempotent on (workspace_id, canonical_domain). Returns the company id. */
  upsertCompany(row: CompanyUpsert): Promise<string>;
  /** Shows a company in the live grid while it is researched; never changes an existing row's stage. */
  markResearching(row: CompanyDraft): Promise<void>;
  /** Marks a draft that did not meet the bar, so the grid can show why. */
  markDiscarded(workspaceId: string, domain: string, reason: string): Promise<void>;
  /** Ends a free sample run: "delivered", or back to "icp_pending" when the run failed. */
  completeSample(workspaceId: string, runId: string, status: "delivered" | "icp_pending"): Promise<void>;
  /** Idempotent on (workspace_id, work_email). Returns the contact id. */
  upsertContact(row: ContactUpsert): Promise<string>;
  /** Inserts only signals whose (company_id, evidence_url) is new. Returns how many were inserted. */
  insertSignals(workspaceId: string, companyId: string, rows: SignalInsert[]): Promise<number>;
  /** Idempotent on (workspace_id, company_id). Returns the dossier id. */
  upsertDossier(row: DossierUpsert): Promise<string>;
  publishCompanies(workspaceId: string, companyIds: string[]): Promise<PublishedCompany[]>;
  postSystemMessage(workspaceId: string, content: string, metadata: Record<string, unknown>): Promise<void>;
  insertUsageEvents(rows: UsageEventInsert[]): Promise<void>;
  insertAuditLog(row: AuditLogInsert): Promise<void>;
}

export class AgentRepoError extends Error {
  readonly code = "AGENT_REPO_ERROR";
  constructor(
    readonly operation: string,
    message: string
  ) {
    super(`${operation}: ${message}`);
    this.name = "AgentRepoError";
  }
}

export interface AgentLogger {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, error?: unknown): void;
}

export interface AgentDeps {
  repo: AgentRepo;
  tools: AgentTools;
  config: AgentConfig;
  logger: AgentLogger;
  now: () => Date;
}
