"use client";

export interface SpokespersonMember {
  id: string;
  fullName: string;
  email: string;
  title: string;
  joinedAt: string;
}

export interface DncEntry {
  domain: string;
  companyName: string;
  location: string;
  reason?: string;
}

export interface ClientAccessRequestRecord {
  id: string;
  company_name: string;
  company_domain: string;
  spokesperson_name: string;
  work_email: string;
  job_title: string;
  phone: string;
  prospecting_goal: string;
  status: "pending" | "approved" | "rejected";
  workspace_id?: string;
  generated_login_id?: string;
  generated_password?: string;
  assigned_humagent_id?: string;
  assigned_humagent_name?: string;
  assigned_humagent_email?: string;
  approved_at?: string;
  created_at: string;
}

export interface HumagentUserRecord {
  id: string;
  full_name: string;
  email: string;
  login_id: string;
  password_plain: string;
  status: "active" | "inactive";
  allocated_workspace_ids: string[];
  created_at: string;
}

export interface WorkspaceChatMessage {
  id: string;
  workspaceId: string;
  senderRole: "admin" | "humagent" | "client" | "system";
  senderName: string;
  senderEmail?: string;
  messageType:
    | "text"
    | "google_meet"
    | "appointment"
    | "document"
    | "payment"
    | "icp_upgrade"
    | "system";
  content: string;
  metadata?: {
    meetUrl?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    agenda?: string;
    docUrl?: string;
    docTitle?: string;
    paymentAmount?: string;
    paymentStatus?: string;
    icpSummary?: string;
  };
  createdAt: string;
}

export interface ClientCompanyWorkspace {
  id: string;
  companyName: string;
  companyDomain: string;
  primaryEmail?: string;
  generatedLoginId: string;
  generatedPassword: string;
  plan: "Pilot · ~5 Samples (<24h) + ~35 Cards/Mo" | "Enterprise Growth";
  status: "Active" | "Onboarding" | "Paused";
  createdAt: string;
  spokespersons: SpokespersonMember[];
  assignedHumagentId?: string;
  assignedHumagentName?: string;
  assignedHumagentEmail?: string;
  channelName: string;
  activeTalkyRoomId: string;
  activeTalkyRoomUrl: string;
  talkyUpdatedAt?: string;
  /** Billing tier: trial gets one free sample run; premium is set by the Admin after payment. */
  tier?: ClientTier;
  sampleStatus?: SampleStatus;
  sampleRunId?: string | null;
  registeredVia?: "self" | "admin";
}

export type ClientTier = "trial" | "premium" | "suspended";
export type SampleStatus = "not_claimed" | "icp_pending" | "running" | "delivered";

export interface ClientIcpSubmission {
  id: string;
  workspaceId: string;
  companyName: string;
  companyDomain: string;
  submittedByEmail: string;
  submittedAt: string;
  offering: string;
  businessGoal: string;
  targetIndustries: string[];
  geographies: string[];
  employeeBands: string[];
  revenueBands: string[];
  buyerFunctions: string[];
  seniorityLevels: string[];
  contactLocations: string[];
  requiredSignals: string[];
  signalWindowDays: number;
  desiredAccountVolume: number;
  contactsPerAccount: number;
  requiredChannels: string[];
  deliveryCadence: string;
  dncEntries: DncEntry[];
  status:
    | "Submitted to Admin"
    | "Prospecting in Progress"
    | "In Human Agent QA"
    | "Delivered to Client";
}

export interface EnrichedContactPerson {
  id: string;
  role:
    | "Executive Sponsor"
    | "Economic Buyer"
    | "Champion"
    | "Influencer"
    | "Procurement";
  name: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  verificationStatus:
    | "✓ Public record"
    | "⚠ Re-verify"
    | "✓ Direct verified";
  tenureNote?: string;
  whyThisContact?: string;
}

export interface EvidenceCitation {
  ref: string;
  title: string;
  whatItEvidences: string;
  url: string;
  sourceEngine:
    | "Brave Search API"
    | "Google Search API"
    | "Tavily"
    | "Crawler"
    | "Social Media Verified";
  publishedDate: string;
}

export interface ProspectAccountRecord {
  id: string;
  leadNumber: string;
  workspaceId: string;
  clientCompanyName: string;
  deliveryType: "sample" | "daily";
  deliveryDayLabel: string;
  stage: "admin_prospecting" | "human_agent_queue" | "published_to_client";

  // 20 Data Enrichment Columns
  inputCompanyName: string;
  companyWebsite: string;
  companyNumber: string;
  employeeCount: string;
  companyIndustry: string;
  subSector: string;
  segment: string;
  location: string;
  campusAddress: string;
  techStack: string[];
  companyLinkedinUrl: string;
  companyTwitterUrl: string;
  companyType: string;
  companyRevenue: string;
  companyDescription: string;
  companyLogo: string;
  foundedYear: string;
  companyEmailPhone: string;
  scoring: {
    icpFitScore: number;
    intentScore: number;
    verifyScore: number;
    verificationPct: number;
    intentBasis: string;
    windowLabel: string;
  };
  priority: "High Priority" | "Medium Priority" | "Watchlist";

  // 5 Signals Matching Columns + Sources
  signalsMatching: {
    targetedSignalBrave: {
      summary: string;
      sourceUrl: string;
      date: string;
    };
    hiringSignalGoogleCareers: {
      summary: string;
      sourceUrl: string;
      date: string;
    };
    investmentsFundingTavily: {
      summary: string;
      sourceUrl: string;
      date: string;
    };
    newsArticleCrawler: {
      summary: string;
      sourceUrl: string;
      date: string;
    };
    socialMediaVerified: {
      slug: string;
      profileUrl: string;
      verifyChecked: boolean;
      recentPostSummary: string;
      recentPostUrl: string;
      date: string;
    };
  };

  recentBuyingSignalHeadline: string;
  recentBuyingSignalBody: string;
  potentialPainPoint: string;
  recommendedOpener: string;
  checkpointsCleared: string;

  contacts: EnrichedContactPerson[];
  evidenceLinks: EvidenceCitation[];

  reviewedByClient: boolean;
  exportedByClient: boolean;
  clientFeedback?: "Relevant" | "Needs Correction" | "Not Relevant";
  clientFeedbackNote?: string;
  updatedAt: string;
}

// In-memory live cache synced from Supabase (/api/os/workflow) — ZERO hardcoded data
let cachedWorkspaces: ClientCompanyWorkspace[] = [];
let cachedAccessRequests: ClientAccessRequestRecord[] = [];
let cachedHumagents: HumagentUserRecord[] = [];
let cachedIcps: ClientIcpSubmission[] = [];
let cachedAccounts: ProspectAccountRecord[] = [];
let cachedMessages: WorkspaceChatMessage[] = [];

function notifyStoreUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("revgen-os-store-update"));
  }
}

export async function syncWorkflowFromDatabase(): Promise<{
  workspaces: ClientCompanyWorkspace[];
  accessRequests: ClientAccessRequestRecord[];
  humagents: HumagentUserRecord[];
  icpSubmissions: ClientIcpSubmission[];
  accounts: ProspectAccountRecord[];
  messages: WorkspaceChatMessage[];
}> {
  if (typeof window === "undefined") {
    return {
      workspaces: [],
      accessRequests: [],
      humagents: [],
      icpSubmissions: [],
      accounts: [],
      messages: [],
    };
  }
  try {
    const res = await fetch("/api/os/workflow", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      cachedWorkspaces = data.workspaces || [];
      cachedAccessRequests = data.accessRequests || [];
      cachedHumagents = data.humagents || [];
      cachedIcps = data.icpSubmissions || [];
      cachedAccounts = data.accounts || [];
      cachedMessages = data.messages || [];
      notifyStoreUpdate();
    }
  } catch {
    // ignore network errors
  }
  return {
    workspaces: cachedWorkspaces,
    accessRequests: cachedAccessRequests,
    humagents: cachedHumagents,
    icpSubmissions: cachedIcps,
    accounts: cachedAccounts,
    messages: cachedMessages,
  };
}

export function getWorkspacesStore(): ClientCompanyWorkspace[] {
  return cachedWorkspaces;
}

export function getAccessRequestsStore(): ClientAccessRequestRecord[] {
  return cachedAccessRequests;
}

export function getHumagentsStore(): HumagentUserRecord[] {
  return cachedHumagents;
}

export function getWorkspaceMessagesStore(workspaceId?: string): WorkspaceChatMessage[] {
  if (!workspaceId) return cachedMessages;
  return cachedMessages.filter((m) => m.workspaceId === workspaceId);
}

export function saveWorkspacesStore(workspaces: ClientCompanyWorkspace[]) {
  cachedWorkspaces = workspaces;
  notifyStoreUpdate();
}

export async function renameWorkspaceChannel(
  workspaceId: string,
  channelName: string
): Promise<{ ok: boolean; channelName?: string; error?: string }> {
  try {
    const res = await fetch("/api/os/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "rename_workspace_channel",
        workspaceId,
        channelName,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      await syncWorkflowFromDatabase();
      return { ok: true, channelName: data.channelName };
    }
    return { ok: false, error: data.error || "Failed to rename channel" };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function sendWorkspaceChatMessage(params: {
  workspaceId: string;
  messageType?: WorkspaceChatMessage["messageType"];
  content: string;
  metadata?: WorkspaceChatMessage["metadata"];
}): Promise<{ ok: boolean; message?: WorkspaceChatMessage; error?: string }> {
  try {
    const res = await fetch("/api/os/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "send_workspace_message",
        ...params,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      await syncWorkflowFromDatabase();
      return { ok: true, message: data.message };
    }
    return { ok: false, error: data.error || "Failed to send message" };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export function getIcpSubmissionsStore(): ClientIcpSubmission[] {
  return cachedIcps;
}

export async function saveIcpSubmission(
  submission: ClientIcpSubmission
): Promise<void> {
  const existingIdx = cachedIcps.findIndex(
    (s) => s.workspaceId === submission.workspaceId
  );
  if (existingIdx >= 0) {
    cachedIcps[existingIdx] = submission;
  } else {
    cachedIcps.unshift(submission);
  }
  notifyStoreUpdate();

  if (typeof window !== "undefined") {
    try {
      await fetch("/api/os/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "submit_icp",
          workspaceId: submission.workspaceId,
          icpBrief: submission,
          dncEntries: submission.dncEntries || [],
        }),
      });
      await syncWorkflowFromDatabase();
    } catch {
      // ignore
    }
  }
}

export function getProspectAccountsStore(): ProspectAccountRecord[] {
  return cachedAccounts;
}

export function saveProspectAccountsStore(accounts: ProspectAccountRecord[]) {
  cachedAccounts = accounts;
  notifyStoreUpdate();
}

export async function updateProspectAccount(
  updated: ProspectAccountRecord
): Promise<void> {
  const idx = cachedAccounts.findIndex((a) => a.id === updated.id);
  if (idx >= 0) {
    cachedAccounts[idx] = updated;
  } else {
    cachedAccounts.unshift(updated);
  }
  notifyStoreUpdate();

  if (typeof window !== "undefined") {
    try {
      await fetch("/api/os/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "update_account",
          accountId: updated.id,
          updates: updated,
        }),
      });
      await syncWorkflowFromDatabase();
    } catch {
      // ignore
    }
  }
}
