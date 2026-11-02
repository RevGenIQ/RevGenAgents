export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PriorityTier = "P1" | "P2" | "P3";
export type RunStatus =
  | "queued"
  | "discovering"
  | "researching"
  | "contact_enrichment"
  | "human_review"
  | "approved"
  | "published"
  | "needs_clarification"
  | "retry_pending"
  | "correction_required"
  | "rejected"
  | "running"
  | "completed"
  | "stopped"
  | "failed";

export type AccountResearchStatus =
  | "queued"
  | "discovering"
  | "researching"
  | "contact_enrichment"
  | "human_review"
  | "approved"
  | "published"
  | "needs_clarification"
  | "retry_pending"
  | "correction_required"
  | "rejected"
  | "failed";

export type ClientActivityStatus = "new" | "reviewed" | "shortlisted" | "not_relevant";

export type OutreachOutcomeStatus =
  | "not_contacted"
  | "contacted"
  | "replied"
  | "meeting_booked"
  | "disqualified";

export type SampleFeedbackStatus = "pending" | "relevant" | "not_relevant" | "needs_correction";

export type OperatingRole = "client" | "human_agent" | "admin";

export type AtlasWorkerType =
  | "ICP Planner"
  | "Account Finder"
  | "Fit Checker"
  | "Signal Researchers"
  | "Evidence Reviewer"
  | "Prioritizer"
  | "Brief Composer"
  | "Scout"
  | "Analyst"
  | "Matcher"
  | "Verifier"
  | "Writer";

export interface TargetSignalGroup {
  id: string;
  name: string;
  definition: string;
  matchingLogic: "any" | "all";
  requirement: "mandatory" | "preferred";
  timeWindowMonths: number;
  acceptableEvidence: string[];
  exclusions: string[];
  signalPriority: "primary_target" | "supporting";
}

export interface CriterionField<T = string> {
  value: T;
  requirement: "mandatory" | "preferred";
}

export interface CampaignBrief {
  id: string;
  workspace_id: string;
  campaign_name: string;
  version: number;
  status:
    | "draft"
    | "submitted"
    | "needs_clarification"
    | "confirmed"
    | "samples_in_progress"
    | "samples_delivered"
    | "active_delivery"
    | "paused";
  // Core Offering & Problem
  clientWebsite: string;
  productService: string;
  problemSolved: string;
  businessGoal: string;
  normalBuyers: string;
  // Target Account Criteria (Mandatory vs Preferred)
  industries: CriterionField<string>;
  geography: CriterionField<string>;
  employeeBand: CriterionField<{ min: number; max: number }>;
  revenueBand: CriterionField<{ min: number; max: number }>;
  companyType: CriterionField<string>;
  // Target-Signal Groups
  targetSignalGroups: TargetSignalGroup[];
  // Disqualifiers & Exclusions
  disqualifyingConditions: string[];
  existingCustomers: string[];
  competitors: string[];
  dncExclusions: string[];
  parentSubsidiaryRule: "separate_entities" | "hq_only" | "include_subsidiaries";
  // Contact Requirements
  buyerFunctions: string[];
  seniorityLevels: string[];
  contactLocation: string;
  contactsPerAccount: number; // default 3 (Buyer, Influencer, Implementation)
  requiredChannels: Array<"work_email" | "direct_mobile" | "linkedin_profile">;
  // Capacities & Delivery Cadence
  researchBatchSize: number; // e.g. 150 companies Atlas investigates
  contactResearchQueueSize: number; // e.g. 100 qualified accounts humans work on
  clientDeliveryAllocation: number; // e.g. 40/month (5 mandatory samples + 30/35 additional)
  samplesCount: number; // 5 mandatory reviewed sample accounts
  paidEntitlementCount: number; // 30 additional accounts
  deliveryCadence: "5_samples_then_daily" | "1_per_day" | "batch_5" | "batch_10" | "flexible";
  premiumActivated: boolean;
  assignedAgent?: string;
  dueDate?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignThreadMessage {
  id: string;
  workspace_id: string;
  campaign_id?: string;
  account_id?: string;
  account_name?: string;
  author_name: string;
  author_role: OperatingRole;
  visibility: "shared" | "internal_note";
  message_type: "comment" | "correction_request" | "question" | "status_update";
  body: string;
  attachments?: Array<{ name: string; url: string; type: string }>;
  resolved?: boolean;
  created_at: string;
}

export type ApprovalStatus = "pending" | "approved" | "return_for_correction" | "rejected";
export type VerificationStatus = "verified_current" | "pending_verification" | "ex_employee_rejected" | "unverified";
export type EmailStatus = "deliverable" | "catch_all" | "undeliverable" | "unverified";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  created_at: string;
  updated_at?: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "researcher" | "sales_user" | "read_only";
  full_name?: string;
  business_email?: string;
  created_at: string;
}

export interface Company {
  id: string;
  workspace_id: string;
  canonical_domain: string;
  company_name: string;
  company_aliases?: string[];
  industry?: string;
  employee_count?: number;
  employee_count_is_estimate?: boolean;
  annual_revenue_usd?: number;
  revenue_band?: string;
  revenue_is_estimate?: boolean;
  company_type?: string;
  total_funding_usd?: number;
  latest_funding?: string;
  company_city?: string;
  company_state?: string;
  company_country?: string;
  company_linkedin?: string;
  company_linkedin_verified?: boolean;
  switchboard_phone?: string;
  generic_email?: string;
  company_keywords?: string;
  company_technologies?: string[] | Record<string, unknown>;
  founded_year?: number;
  icp_score?: number;
  icp_fit_reason?: string;
  overview?: string;
  // Phase 1 Operating & Delivery Fields
  research_status?: AccountResearchStatus;
  client_activity?: ClientActivityStatus;
  outreach_outcome?: OutreachOutcomeStatus;
  sample_feedback?: SampleFeedbackStatus;
  sample_feedback_reason?: string;
  is_sample_account?: boolean;
  priority_tier?: PriorityTier;
  priority_reason?: string;
  mandatory_fit_pass?: boolean;
  signal_strength_level?: "strong" | "moderate" | "weak" | "none_found";
  evidence_confidence_level?: "high" | "medium" | "review_required";
  contact_readiness_level?: "complete_3_plus" | "shortfall_1_2" | "pending";
  exported_at?: string;
  delivered_at?: string;
  // Compatibility aliases
  name?: string;
  domain?: string;
  fit_score?: number;
  city?: string;
  state?: string;
  country?: string;
  created_at: string;
  updated_at?: string;
}

export interface Contact {
  id: string;
  workspace_id: string;
  company_id?: string;
  company_name?: string;
  company_domain?: string;
  first_name: string;
  last_name: string;
  title: string;
  // Compatibility aliases
  full_name?: string;
  job_title?: string;
  seniority?: string;
  department?: string;
  buyer_role_type?: "Buyer" | "Influencer" | "Implementation";
  work_email?: string;
  personal_linkedin?: string;
  linkedin_verified?: boolean;
  mobile_number?: string;
  direct_number?: string;
  is_switchboard_or_generic?: boolean;
  contact_city?: string;
  contact_country?: string;
  role_start_date?: string;
  verification_status: VerificationStatus;
  verification_method?: string;
  verified_at?: string;
  email_status: EmailStatus;
  phone_status?: string;
  icp_score?: number;
  icp_reason?: string;
  created_at: string;
}

export interface ResearchRun {
  id: string;
  workspace_id: string;
  name: string;
  status: RunStatus;
  target_count: number;
  min_icp_score: number;
  include_dm: boolean;
  maximize_coverage: boolean;
  live_search: boolean;
  icp_input: {
    website?: string;
    description?: string;
    industries?: string[];
    titles?: string[];
    headcountMin?: number;
    headcountMax?: number;
    revenueMin?: number;
    revenueMax?: number;
    hqRegion?: string;
    exclusions?: string[];
  };
  progress_percent: number;
  current_step: string;
  leads_found: number;
  leads_verified: number;
  stop_requested: boolean;
  retry_count: number;
  error_message?: string;
  report_url?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ResearchTask {
  id: string;
  run_id: string;
  workspace_id: string;
  task_type: string;
  company_name?: string;
  company_domain?: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  output_data?: Record<string, unknown>;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface Signal {
  id: string;
  workspace_id: string;
  company_id?: string;
  company_name?: string;
  company_domain?: string;
  signal_type:
    | "hiring_growth"
    | "new_leadership"
    | "hr_payroll_vacancy"
    | "office_expansion"
    | "funding_round"
    | "acquisition"
    | "business_expansion"
    | "tech_stack_change";
  title: string;
  supporting_excerpt: string;
  // Compatibility aliases
  headline?: string;
  confidence_score?: number;
  raw_text_snippet?: string;
  evidence_url?: string;
  event_date?: string;
  publication_date?: string;
  retrieval_timestamp: string;
  confidence: number;
  explanation?: string;
  is_confirmed_fact: boolean;
  source_layer?: string;
  created_at: string;
}

export interface Dossier {
  id: string;
  workspace_id: string;
  company_id: string;
  company_name?: string;
  company_domain?: string;
  target_contact_id?: string;
  target_contact_name?: string;
  target_contact_title?: string;
  summary: string;
  // Compatibility aliases
  firmographic_summary?: string;
  executive_hook?: string;
  icp_score: number;
  icp_score_breakdown: {
    firmographic: number;
    technographic: number;
    buying_trigger: number;
    leadership_fit: number;
  };
  buying_window_days: number;
  priority_tier: PriorityTier;
  key_triggers: Array<{
    layer: string;
    trigger: string;
    date?: string;
    evidence_url?: string;
  }>;
  recommended_opener: string;
  talking_points: string[];
  status: "ready" | "draft" | "archived";
  created_at: string;
  updated_at: string;
}

export interface OutreachDraft {
  id: string;
  workspace_id: string;
  company_id: string;
  company_name?: string;
  contact_id: string;
  contact_name?: string;
  contact_email?: string;
  contact_title?: string;
  dossier_id?: string;
  subject_line: string;
  body_text: string;
  channel: "email" | "linkedin" | "multichannel";
  tone: "consultative" | "executive" | "direct" | "custom";
  status: "draft" | "pending_approval" | "approved" | "rejected" | "sent";
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalItem {
  id: string;
  workspace_id: string;
  item_type: "dossier_release" | "outreach_draft" | "warmup_change" | "geo_content";
  item_id?: string;
  title: string;
  description: string;
  recommendation: string;
  confidence: number;
  sla_expires_at?: string;
  status: ApprovalStatus;
  actioned_by?: string;
  actioned_at?: string;
  notes?: string;
  created_at: string;
}

export interface IntegrationConnection {
  id: string;
  workspace_id: string;
  provider_type: string;
  provider_name: string;
  is_connected: boolean;
  status: "healthy" | "degraded" | "disconnected" | "rate_limited" | "demo_mode";
  last_checked_at?: string;
  last_error?: string;
  config_metadata?: Record<string, unknown>;
  usage_count_this_month: number;
  cost_estimate_usd: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  actor_id?: string;
  actor_email?: string;
  action: string;
  target_type: string;
  target_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface IcpProfile {
  id: string;
  workspace_id: string;
  name: string;
  product?: string;
  pain_points?: string;
  criteria?: {
    website?: string;
    industries?: string[];
    countries?: string[];
    headcountRanges?: string[];
    titles?: string[];
    seniorityLevels?: string[];
    exclusions?: string[];
    competitorExclusions?: string[];
    signalDateRangeDays?: number;
    leadTarget?: number;
  };
  minimum_score: number;
  created_at: string;
  updated_at: string;
}
