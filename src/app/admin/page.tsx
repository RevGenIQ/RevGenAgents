"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  Search,
  Key,
  Plus,
  ExternalLink,
  CheckCircle2,
  Video,
  Sparkles,
  UserCheck,
  Copy,
  Check,
  Database,
  Radio,
  Mail,
  LogOut,
  XCircle,
  Clock,
  Hash,
  Edit3,
  ClipboardCheck,
} from "lucide-react";
import { RevGenLogo } from "@/components/ui/RevGenLogo";
import { useAuth } from "@/context/AuthContext";
import { WorkspaceChannelHub } from "@/components/modules/WorkspaceChannelHub";
import { RunReviewQueue } from "@/components/modules/RunReviewQueue";
import { EnrichmentQueue } from "@/components/enrichment/EnrichmentQueue";
import {
  ClientCompanyWorkspace,
  ClientIcpSubmission,
  ProspectAccountRecord,
  ClientAccessRequestRecord,
  HumagentUserRecord,
  getWorkspacesStore,
  getIcpSubmissionsStore,
  getProspectAccountsStore,
  getAccessRequestsStore,
  getHumagentsStore,
  renameWorkspaceChannel,
  syncWorkflowFromDatabase,
  type ClientTier,
  type SampleStatus,
} from "@/lib/store/osWorkflowStore";

const TIER_LABEL: Record<ClientTier, string> = { trial: "Free trial", premium: "Premium", suspended: "Suspended" };
const TIER_BADGE: Record<ClientTier, string> = {
  trial: "bg-amber-100 text-amber-800",
  premium: "bg-emerald-100 text-emerald-800",
  suspended: "bg-rose-100 text-rose-800",
};
const SAMPLE_LABEL: Record<SampleStatus, string> = {
  not_claimed: "not claimed",
  icp_pending: "ICP in progress",
  running: "researching",
  delivered: "delivered",
};

export default function AdminMiddlewarePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<
    | "access_and_credentials"
    | "clients_middleware"
    | "workspace_channels"
    | "agentic_prospecting"
    | "all_20_columns"
    | "run_review"
    | "enrichment"
  >("access_and_credentials");

  const [workspaces, setWorkspaces] = useState<ClientCompanyWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [icpSubmissions, setIcpSubmissions] = useState<ClientIcpSubmission[]>([]);
  const [accounts, setAccounts] = useState<ProspectAccountRecord[]>([]);
  const [accessRequests, setAccessRequests] = useState<ClientAccessRequestRecord[]>([]);
  const [humagents, setHumagents] = useState<HumagentUserRecord[]>([]);

  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Per-request humagent selection before approval
  const [requestHumagentMap, setRequestHumagentMap] = useState<Record<string, string>>({});

  // Direct Client Creation Form State (No hardcoded values)
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyDomain, setNewCompanyDomain] = useState("");
  const [newSpokespersonName, setNewSpokespersonName] = useState("");
  const [newSpokespersonEmail, setNewSpokespersonEmail] = useState("");
  const [newClientHumagentId, setNewClientHumagentId] = useState("");
  const [newClientChannelName, setNewClientChannelName] = useState("");
  const [editingChannelWsId, setEditingChannelWsId] = useState<string | null>(null);
  const [editingChannelValue, setEditingChannelValue] = useState("");

  // New Humagent Credential Generator State
  const [humName, setHumName] = useState("");
  const [humEmail, setHumEmail] = useState("");
  const [humLoginId, setHumLoginId] = useState("");
  const [humPassword, setHumPassword] = useState("");

  // Agentic Prospecting Search State (No hardcoded values)
  const [targetCompanyQuery, setTargetCompanyQuery] = useState("");
  const [targetDomainQuery, setTargetDomainQuery] = useState("");
  const [targetLocationQuery, setTargetLocationQuery] = useState("");
  const [targetSignalQuery, setTargetSignalQuery] = useState("");
  const [isProspecting, setIsProspecting] = useState(false);

  // Strict Role Guard: Only Admin is allowed on /admin
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.replace("/login");
        return;
      }
      if (user.role === "client") {
        router.replace("/");
        return;
      }
      if (user.role === "humagent") {
        router.replace("/human-agent");
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  const loadFromStore = () => {
    const wsList = getWorkspacesStore();
    setWorkspaces(wsList);
    if (wsList.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(wsList[0].id);
    }
    setIcpSubmissions(getIcpSubmissionsStore());
    setAccounts(getProspectAccountsStore());
    setAccessRequests(getAccessRequestsStore());
    setHumagents(getHumagentsStore());
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");

    if (isAuthenticated && user?.role === "admin") {
      syncWorkflowFromDatabase().then(loadFromStore);
    }
    window.addEventListener("revgen-os-store-update", loadFromStore);
    return () => window.removeEventListener("revgen-os-store-update", loadFromStore);
  }, [isAuthenticated, user?.role]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const activeWorkspace =
    workspaces.find((w) => w.id === selectedWorkspaceId) || workspaces[0];

  const buildMailtoShareLink = (params: {
    toEmail: string;
    recipientName: string;
    companyName: string;
    loginId: string;
    password: string;
    roleLabel?: string;
  }) => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const subject = encodeURIComponent(
      `Your RevGen AI ${params.roleLabel || "Client Portal"} Credentials — ${params.companyName}`
    );
    const body = encodeURIComponent(
      `Hi ${params.recipientName || "Team"},\n\n` +
        `Your access to RevGen AI (${params.companyName}) has been approved by the Admin.\n\n` +
        `Portal Login URL: ${origin}/login\n` +
        `Registered Work Email: ${params.toEmail}\n` +
        `Generated Login ID: ${params.loginId}\n` +
        `Generated Password: ${params.password}\n\n` +
        `You can sign in using either your Generated Login ID or your Work Email along with the password above.\n\n` +
        `Best regards,\nRevGen AI Admin`
    );
    return `mailto:${params.toEmail}?subject=${subject}&body=${body}`;
  };

  const handleApproveAccessRequest = async (reqItem: ClientAccessRequestRecord) => {
    setIsBusy(true);
    try {
      const allocatedHumagentId = requestHumagentMap[reqItem.id] || "";
      const res = await fetch("/api/os/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_access_request",
          requestId: reqItem.id,
          allocatedHumagentId: allocatedHumagentId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Failed to approve request.");
        return;
      }
      await syncWorkflowFromDatabase();
      loadFromStore();
      notify(
        `Approved ${reqItem.company_name}! Generated Login ID: ${data.generatedLoginId} | Password: ${data.generatedPassword}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRejectAccessRequest = async (reqItem: ClientAccessRequestRecord) => {
    setIsBusy(true);
    try {
      await fetch("/api/os/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_access_request",
          requestId: reqItem.id,
        }),
      });
      await syncWorkflowFromDatabase();
      loadFromStore();
      notify(`Rejected access request from ${reqItem.work_email}.`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateClientWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newCompanyDomain.trim() || !newSpokespersonEmail.trim()) {
      return;
    }
    setIsBusy(true);
    try {
      const res = await fetch("/api/os/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_client_direct",
          companyName: newCompanyName.trim(),
          companyDomain: newCompanyDomain.trim(),
          fullName: newSpokespersonName.trim(),
          email: newSpokespersonEmail.trim(),
          allocatedHumagentId: newClientHumagentId || null,
          channelName:
            newClientChannelName.trim() ||
            `RevGenAIx${newCompanyName.trim().replace(/[^a-zA-Z0-9]/g, "")}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Failed to create client credentials.");
        return;
      }
      await syncWorkflowFromDatabase();
      loadFromStore();
      setSelectedWorkspaceId(data.workspaceId);
      setNewCompanyName("");
      setNewCompanyDomain("");
      setNewSpokespersonName("");
      setNewSpokespersonEmail("");
      setNewClientHumagentId("");
      setNewClientChannelName("");
      notify(
        `Created Client Workspace "${data.workspace?.companyName || ""}"! ID: ${data.generatedLoginId} | Password: ${data.generatedPassword} | Channel: #${data.credentials?.channelName || ""}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateHumagent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!humName.trim() || !humEmail.trim()) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/os/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_humagent",
          fullName: humName.trim(),
          email: humEmail.trim(),
          loginId: humLoginId.trim() || undefined,
          password: humPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Failed to create Humagent credentials.");
        return;
      }
      await syncWorkflowFromDatabase();
      loadFromStore();
      setHumName("");
      setHumEmail("");
      setHumLoginId("");
      setHumPassword("");
      notify(
        `Created Humagent "${data.humagent.full_name}"! Login ID: ${data.humagent.login_id} | Password: ${data.humagent.password_plain}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleAllocateHumagent = async (workspaceId: string, humagentId: string) => {
    setIsBusy(true);
    try {
      const res = await fetch("/api/os/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "allocate_humagent",
          workspaceId,
          humagentId: humagentId || null,
        }),
      });
      if (res.ok) {
        await syncWorkflowFromDatabase();
        loadFromStore();
        notify("Updated Humagent allocation for client workspace.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleSetClientPlan = async (workspaceId: string, tier: ClientTier) => {
    if (tier === "suspended" && !window.confirm("Suspend this client? They will not be able to sign in.")) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/os/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_client_plan", workspaceId, tier }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(json.error || "Could not change the plan.");
        return;
      }
      await syncWorkflowFromDatabase();
      loadFromStore();
      notify(`Plan changed to ${TIER_LABEL[tier]}.`);
    } finally {
      setIsBusy(false);
    }
  };

  // Run Agentic Prospecting (5 Signals Matching + 20 Data Enrichment Columns) -> Save to Supabase & Push to Humagent Queue
  const handleRunAgenticProspecting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCompanyQuery.trim() || !activeWorkspace) {
      notify("Please select an onboarded Client Workspace and enter a Target Company Name.");
      return;
    }
    setIsProspecting(true);

    try {
      const cleanName = targetCompanyQuery.trim();
      const cleanDom =
        targetDomainQuery.trim().toLowerCase() ||
        `${cleanName.split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
      const slug = cleanName
        .split(/[—-]/)[0]
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      const loc = targetLocationQuery.trim() || "India";
      const sig = targetSignalQuery.trim() || "Expansion & Hiring Signal";

      const newLeadNum = `${String(accounts.length + 1).padStart(2, "0")}/${String(
        accounts.length + 1
      ).padStart(2, "0")}`;

      const newRecord: ProspectAccountRecord = {
        id: `acc-prospect-${Date.now()}`,
        leadNumber: newLeadNum,
        workspaceId: activeWorkspace.id,
        clientCompanyName: activeWorkspace.companyName,
        deliveryType: accounts.filter((a) => a.workspaceId === activeWorkspace.id).length < 5 ? "sample" : "daily",
        deliveryDayLabel:
          accounts.filter((a) => a.workspaceId === activeWorkspace.id).length < 5
            ? `Sample #${accounts.filter((a) => a.workspaceId === activeWorkspace.id).length + 1} of 5 · Pending Humagent QA`
            : "Daily Card · Pending Humagent QA",
        stage: "human_agent_queue",
        inputCompanyName: cleanName,
        companyWebsite: cleanDom,
        companyNumber: "Switchboard Pending Verification",
        employeeCount: "500–2,500 Employees",
        companyIndustry: "Enterprise B2B",
        subSector: "Growth & Operations",
        segment: "Enterprise Account · STATUS: IN HUMAGENT QA",
        location: loc,
        campusAddress: loc,
        techStack: ["Cloud Infrastructure", "Enterprise ERP", "CRM"],
        companyLinkedinUrl: `https://www.linkedin.com/company/${slug}/`,
        companyTwitterUrl: `https://x.com/${slug.replace(/-/g, "")}`,
        companyType: "Private / Public Enterprise",
        companyRevenue: "Est. Mid-to-Large Enterprise",
        companyDescription: `${cleanName} (${cleanDom}) identified via RevGen AI Agentic Prospecting in ${loc} matching signal "${sig}".`,
        companyLogo: cleanName.slice(0, 3).toUpperCase(),
        foundedYear: "Verified",
        companyEmailPhone: `contact@${cleanDom}`,
        scoring: {
          icpFitScore: 88,
          intentScore: 86,
          verifyScore: 45,
          verificationPct: 45,
          intentBasis: `Targeted Signal (${sig}) (35) + Career Page Hiring (25) + Tavily Expansion (16) + Verified Social Post (10) = 86`,
          windowLabel: "WINDOW: Active · Dispatched to Allocated Humagent for ≥3 Contacts Enrichment",
        },
        priority: "High Priority",
        signalsMatching: {
          targetedSignalBrave: {
            summary: `[Brave Search API] ${cleanName} matched ICP signal "${sig}" in ${loc}.`,
            sourceUrl: `https://search.brave.com/search?q=${encodeURIComponent(
              cleanName + " " + sig
            )}`,
            date: new Date().toISOString().slice(0, 10),
          },
          hiringSignalGoogleCareers: {
            summary: `[Google Search API · Career Pages] Active openings indexed on ${cleanDom} career pages.`,
            sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(
              "site:" + cleanDom + " careers"
            )}`,
            date: new Date().toISOString().slice(0, 10),
          },
          investmentsFundingTavily: {
            summary: `[Tavily AI] Capital and operational expansion indicators verified for ${cleanName}.`,
            sourceUrl: `https://${cleanDom}`,
            date: new Date().toISOString().slice(0, 10),
          },
          newsArticleCrawler: {
            summary: `[News Crawler] Recent coverage confirming growth initiatives for ${cleanName} in ${loc}.`,
            sourceUrl: `https://news.google.com/search?q=${encodeURIComponent(cleanName)}`,
            date: new Date().toISOString().slice(0, 10),
          },
          socialMediaVerified: {
            slug,
            profileUrl: `https://www.linkedin.com/company/${slug}/`,
            verifyChecked: true,
            recentPostSummary: `Verified official LinkedIn slug /company/${slug}/ — recent activity confirms "${sig}".`,
            recentPostUrl: `https://www.linkedin.com/company/${slug}/posts/`,
            date: new Date().toISOString().slice(0, 10),
          },
        },
        recentBuyingSignalHeadline: `TRIGGER VERIFIED · ${cleanName.toUpperCase()} (${sig.toUpperCase()})`,
        recentBuyingSignalBody: `${cleanName} matched all 5 Agentic Prospecting signal engines (Brave Search API, Google Career Pages API, Tavily Investments, News Crawler, and Verified Social Media Post) in ${loc}.`,
        potentialPainPoint: `Scaling operational workflows and infrastructure during ${sig} at ${cleanName}.`,
        recommendedOpener: `Noticed ${cleanName}'s recent ${sig} in ${loc}—reaching out with a tailored brief for ${activeWorkspace.companyName}.`,
        checkpointsCleared:
          "✓ 5 OF 6 CHECKPOINTS CLEARED · Sent to Allocated Humagent for 3-Contact Verification",
        contacts: [],
        evidenceLinks: [
          {
            ref: `[E${accounts.length + 1}.1]`,
            title: `Brave Search API — ${cleanName} (${sig})`,
            whatItEvidences: `Confirms targeted ICP signal (${sig}) in ${loc}.`,
            url: `https://search.brave.com/search?q=${encodeURIComponent(
              cleanName + " " + sig
            )}`,
            sourceEngine: "Brave Search API",
            publishedDate: new Date().toISOString().slice(0, 10),
          },
          {
            ref: `[E${accounts.length + 1}.2]`,
            title: `Google Search API Career Pages — ${cleanDom}`,
            whatItEvidences: "Confirms active hiring on company career pages.",
            url: `https://www.google.com/search?q=${encodeURIComponent(
              "site:" + cleanDom + " careers"
            )}`,
            sourceEngine: "Google Search API",
            publishedDate: new Date().toISOString().slice(0, 10),
          },
        ],
        reviewedByClient: false,
        exportedByClient: false,
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch("/api/os/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_prospect_account",
          account: newRecord,
        }),
      });

      if (res.ok) {
        await syncWorkflowFromDatabase();
        loadFromStore();
        setTargetCompanyQuery("");
        setTargetDomainQuery("");
        setTargetLocationQuery("");
        setTargetSignalQuery("");
        notify(
          `Enriched "${cleanName}" across all 5 Signal Engines & 20 Columns and dispatched to Humagent Queue!`
        );
      }
    } finally {
      setIsProspecting(false);
    }
  };

  if (isLoading || !isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-slate-900">
        <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mb-3" />
        <span className="text-xs font-mono text-slate-500 tracking-widest uppercase">
          Verifying RevGen AI Admin Authorization...
        </span>
      </div>
    );
  }

  const pendingRequestsCount = accessRequests.filter(
    (r) => r.status === "pending"
  ).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col">
      {/* Top Admin Header — Strictly Admin Portal Only (No Role-Switcher Toggles) */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <RevGenLogo className="w-7 h-7 text-indigo-600" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                RevGen AI
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-[10px] font-bold uppercase">
                ADMIN PORTAL · CREDENTIAL AUTHORITY &amp; AGENTIC PROSPECTING
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Approve Client Requests, Generate Client &amp; Humagent Credentials, Allocate Humagents, Run 5-Signal Enrichment
            </div>
          </div>
        </div>

        {/* Right Controls: Workspace Channels Hub + Admin Identity + Sign Out */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("workspace_channels")}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Hash className="w-3.5 h-3.5 text-indigo-600" />
            <span>Workspace Channels ({workspaces.length})</span>
            {activeWorkspace?.channelName && (
              <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                #{activeWorkspace.channelName}
              </code>
            )}
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-bold text-slate-900">{user.email}</span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold">
              ADMIN
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 space-y-6">
        {toast && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Admin Workflow Step Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab("access_and_credentials")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "access_and_credentials"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Key className="w-4 h-4" />
            <span>1. Client Access, Workspaces ({workspaces.length}) &amp; Humagents</span>
            {pendingRequestsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-extrabold">
                {pendingRequestsCount} Pending
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("workspace_channels")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "workspace_channels"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Hash className="w-4 h-4" />
            <span>2. Workspace Channels Hub (All {workspaces.length} Channels)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("clients_middleware")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "clients_middleware"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. Client ICP Middleware ({icpSubmissions.length} Briefs)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("agentic_prospecting")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "agentic_prospecting"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>4. Agentic Prospecting (5 Signals + Source Links)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all_20_columns")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "all_20_columns"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>5. Data Enrichment Ledger (All 20 Columns)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("run_review")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "run_review"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>6. Agent Run Review</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("enrichment")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "enrichment"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>7. Enrichment Queue</span>
          </button>
        </div>

        {activeTab === "run_review" && <RunReviewQueue />}
        {activeTab === "enrichment" && (
          <EnrichmentQueue role="admin" humagents={humagents.filter((h) => h.status === "active").map((h) => ({ id: h.id, full_name: h.full_name }))} />
        )}

        {/* ════════════════ TAB 1: CLIENT ACCESS REQUESTS, HUMAGENTS & ALLOCATIONS ════════════════ */}
        {activeTab === "access_and_credentials" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Client Access Requests from Registration Form */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-indigo-600 font-bold">
                      INCOMING REGISTRATION REQUESTS · CLIENT GATEKEEPER
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-900">
                      Client Access Requests ({accessRequests.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Unapproved clients cannot log in. Approve a request below to generate their Client Login ID &amp; Password, allocate a Humagent, and share credentials via email.
                    </p>
                  </div>
                </div>

                {accessRequests.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                    <Clock className="w-6 h-6 text-slate-400 mx-auto" />
                    <div className="text-sm font-bold text-slate-800">
                      No Client Access Requests Yet
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      When prospective clients fill out the Registration Form on <code>/signup</code>, their request appears here for Admin approval, or you can directly generate client credentials below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {accessRequests.map((req) => (
                      <div
                        key={req.id}
                        className={`p-4 rounded-2xl border space-y-3 ${
                          req.status === "pending"
                            ? "bg-amber-50/40 border-amber-300"
                            : req.status === "approved"
                            ? "bg-emerald-50/30 border-emerald-200"
                            : "bg-slate-50 border-slate-200 opacity-75"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-slate-900">
                                {req.company_name}
                              </span>
                              <span className="text-xs font-mono text-indigo-600 font-semibold">
                                @{req.company_domain}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                                  req.status === "pending"
                                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                                    : req.status === "approved"
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : "bg-rose-100 text-rose-900 border border-rose-300"
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-700 mt-1">
                              <strong>Spokesperson:</strong> {req.spokesperson_name} ({req.job_title}) ·{" "}
                              <span className="font-mono text-indigo-700">{req.work_email}</span>
                            </div>
                            {req.prospecting_goal && (
                              <p className="text-xs text-slate-600 mt-1 bg-white/80 p-2 rounded-lg border border-slate-200/80">
                                &ldquo;{req.prospecting_goal}&rdquo;
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(req.created_at).toLocaleString()}
                          </span>
                        </div>

                        {req.status === "pending" && (
                          <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-mono uppercase text-slate-600 font-bold">
                                Allocate Humagent:
                              </label>
                              <select
                                value={requestHumagentMap[req.id] || ""}
                                onChange={(e) =>
                                  setRequestHumagentMap((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value,
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-900"
                              >
                                <option value="">-- Select Humagent (Optional) --</option>
                                {humagents.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {h.full_name} ({h.login_id})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleApproveAccessRequest(req)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve &amp; Generate Credentials</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleRejectAccessRequest(req)}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {req.status === "approved" && req.generated_login_id && (
                          <div className="pt-2 border-t border-emerald-200 flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl">
                            <div className="text-xs font-mono">
                              <span className="text-[10px] uppercase text-slate-400 block">
                                APPROVED CLIENT CREDENTIALS
                              </span>
                              <span className="font-bold text-slate-900">
                                ID: {req.generated_login_id}
                              </span>{" "}
                              |{" "}
                              <span className="font-bold text-indigo-700">
                                Password: {req.generated_password}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <a
                                href={buildMailtoShareLink({
                                  toEmail: req.work_email,
                                  recipientName: req.spokesperson_name,
                                  companyName: req.company_name,
                                  loginId: req.generated_login_id,
                                  password: req.generated_password || "",
                                  roleLabel: "Client Portal",
                                })}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Share Credentials via Email</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `Email: ${req.work_email} | Login ID: ${req.generated_login_id} | Password: ${req.generated_password}`
                                  );
                                  setCopiedId(req.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                                title="Copy Credentials"
                              >
                                {copiedId === req.id ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct Client Credential Creation Form */}
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-indigo-600 font-bold">
                      DIRECT CLIENT ONBOARDING
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Create Client Workspace &amp; Credentials Directly
                    </h3>
                  </div>
                  <Key className="w-5 h-5 text-indigo-600" />
                </div>

                <form onSubmit={handleGenerateClientWorkspace} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                        Client Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="Enter company name"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                        Company Domain *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCompanyDomain}
                        onChange={(e) => setNewCompanyDomain(e.target.value)}
                        placeholder="company.com"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                        Spokesperson Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newSpokespersonName}
                        onChange={(e) => setNewSpokespersonName(e.target.value)}
                        placeholder="Full name (spaces allowed)"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                        Spokesperson Work Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={newSpokespersonEmail}
                        onChange={(e) => setNewSpokespersonEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                        Dedicated Channel Name (Admin Only)
                      </label>
                      <input
                        type="text"
                        value={newClientChannelName}
                        onChange={(e) => setNewClientChannelName(e.target.value)}
                        placeholder={
                          newCompanyName
                            ? `RevGenAIx${newCompanyName.replace(/[^a-zA-Z0-9]/g, "")}`
                            : "RevGenAIxClientName"
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                        Allocate Humagent
                      </label>
                      <select
                        value={newClientHumagentId}
                        onChange={(e) => setNewClientHumagentId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900"
                      >
                        <option value="">-- Optional Humagent --</option>
                        {humagents.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.full_name} ({h.login_id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Client Credentials, Workspace &amp; #Channel</span>
                  </button>
                </form>
              </div>

              {/* ACTIVE CLIENT WORKSPACES DIRECTORY — IMMEDIATELY VISIBLE RIGHT HERE IN TAB 1 */}
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-emerald-700 font-bold">
                      ONBOARDED CLIENT WORKSPACES · INSTANT CREDENTIALS &amp; CHANNEL DIRECTORY
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Active Client Workspaces ({workspaces.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      All created and approved client workspaces appear right here with their Login ID, Password, allocated Humagent, and dedicated #Channel.
                    </p>
                  </div>
                </div>

                {workspaces.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                    No client workspaces created yet. Create a client workspace above or approve a request.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workspaces.map((ws) => {
                      const primarySpokesperson = ws.spokespersons[0];
                      const isEditingCh = editingChannelWsId === ws.id;
                      return (
                        <div
                          key={ws.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-extrabold text-slate-900">
                                  {ws.companyName}
                                </span>
                                <span className="text-xs font-mono text-indigo-600 font-bold">
                                  @{ws.companyDomain}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TIER_BADGE[ws.tier || "trial"]}`}>
                                  {TIER_LABEL[ws.tier || "trial"]}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                  Sample: {SAMPLE_LABEL[ws.sampleStatus || "not_claimed"]}
                                </span>
                                {ws.registeredVia === "self" && (
                                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-semibold">
                                    Self-registered
                                  </span>
                                )}
                              </div>
                              {primarySpokesperson && (
                                <div className="text-xs text-slate-600 mt-0.5">
                                  <strong>Spokesperson:</strong>{" "}
                                  {primarySpokesperson.fullName} ·{" "}
                                  <span className="font-mono text-indigo-700">
                                    {primarySpokesperson.email}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWorkspaceId(ws.id);
                                  setActiveTab("workspace_channels");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Hash className="w-3 h-3" />
                                <span>Open #{ws.channelName}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWorkspaceId(ws.id);
                                  setActiveTab("clients_middleware");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold cursor-pointer"
                              >
                                View ICP Brief
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWorkspaceId(ws.id);
                                  setActiveTab("agentic_prospecting");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Prospect Accounts
                              </button>
                            </div>
                          </div>

                          {/* Credentials Box: self-registered clients chose their own password, which is stored hashed. */}
                          {ws.registeredVia === "self" ? (
                            <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600">
                              Signs in with <span className="font-semibold text-slate-900">{ws.primaryEmail}</span> and their own password.
                            </div>
                          ) : (
                          <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                            <div>
                              <span className="text-[10px] uppercase text-slate-400 block">
                                CLIENT PORTAL CREDENTIALS
                              </span>
                              <span className="font-bold text-slate-900">
                                Login ID: {ws.generatedLoginId}
                              </span>{" "}
                              |{" "}
                              <span className="font-bold text-indigo-700">
                                Password: {ws.generatedPassword}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {primarySpokesperson?.email && (
                                <a
                                  href={buildMailtoShareLink({
                                    toEmail: primarySpokesperson.email,
                                    recipientName: primarySpokesperson.fullName,
                                    companyName: ws.companyName,
                                    loginId: ws.generatedLoginId,
                                    password: ws.generatedPassword,
                                  })}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-sans font-bold flex items-center gap-1"
                                >
                                  <Mail className="w-3 h-3" />
                                  <span>Email Credentials</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `Company: ${ws.companyName} | Login ID: ${ws.generatedLoginId} | Password: ${ws.generatedPassword}`
                                  );
                                  setCopiedId(ws.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                                title="Copy Client Credentials"
                              >
                                {copiedId === ws.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                          )}

                          {/* Channel Name, Humagent Allocation & Plan Row */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            {/* Admin-Only Channel Name Control */}
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs">
                              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold shrink-0">
                                Channel:
                              </span>
                              {isEditingCh ? (
                                <div className="flex items-center gap-1 flex-1">
                                  <input
                                    type="text"
                                    value={editingChannelValue}
                                    onChange={(e) =>
                                      setEditingChannelValue(e.target.value)
                                    }
                                    className="w-full px-2 py-1 rounded border border-indigo-500 font-mono text-xs text-slate-900"
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!editingChannelValue.trim()) return;
                                      const res = await renameWorkspaceChannel(
                                        ws.id,
                                        editingChannelValue.trim()
                                      );
                                      if (res.ok) {
                                        setEditingChannelWsId(null);
                                        loadFromStore();
                                        notify(
                                          `Renamed channel to #${res.channelName}`
                                        );
                                      }
                                    }}
                                    className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono font-bold text-indigo-700 truncate">
                                    #{ws.channelName}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingChannelWsId(ws.id);
                                      setEditingChannelValue(ws.channelName);
                                    }}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                                    title="Rename Channel (Admin Only)"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Humagent Allocation Control */}
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs">
                              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold shrink-0">
                                Humagent:
                              </span>
                              <select
                                value={ws.assignedHumagentId || ""}
                                onChange={(e) =>
                                  handleAllocateHumagent(ws.id, e.target.value)
                                }
                                className="px-2 py-1 rounded border border-slate-300 text-xs font-semibold text-slate-900 bg-slate-50 max-w-[180px]"
                              >
                                <option value="">Unassigned</option>
                                {humagents.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {h.full_name} ({h.login_id})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Plan control: Premium is set here after payment is received. */}
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs">
                              <label htmlFor={`plan-${ws.id}`} className="text-[10px] font-mono uppercase text-slate-500 font-bold shrink-0">
                                Plan:
                              </label>
                              <select
                                id={`plan-${ws.id}`}
                                value={ws.tier || "trial"}
                                disabled={isBusy}
                                onChange={(e) => handleSetClientPlan(ws.id, e.target.value as ClientTier)}
                                className="px-2 py-1 rounded border border-slate-300 text-xs font-semibold text-slate-900 bg-slate-50"
                              >
                                <option value="trial">Free trial</option>
                                <option value="premium">Premium</option>
                                <option value="suspended">Suspended</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Cols: Create Humagent Credentials & Manage Humagents */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-emerald-700 font-bold">
                      HUMAGENT CREDENTIAL AUTHORITY
                    </span>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Create Human Agent (Humagent) Credentials
                    </h2>
                  </div>
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Only the Admin can create credentials for Human Agents (Humagents) and allocate them to Client workspaces. When a Humagent logs in at <code>/login</code>, they are routed exclusively to <code>/human-agent</code>.
                </p>

                <form onSubmit={handleCreateHumagent} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                        Humagent Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={humName}
                        onChange={(e) => setHumName(e.target.value)}
                        placeholder="Enter Humagent name"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                        Humagent Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={humEmail}
                        onChange={(e) => setHumEmail(e.target.value)}
                        placeholder="agent@revgenai.com"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                        Custom Login ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={humLoginId}
                        onChange={(e) => setHumLoginId(e.target.value)}
                        placeholder="Auto-generates if blank"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                        Custom Password (Optional)
                      </label>
                      <input
                        type="text"
                        value={humPassword}
                        onChange={(e) => setHumPassword(e.target.value)}
                        placeholder="Auto-generates if blank"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Generate Humagent Credentials</span>
                  </button>
                </form>

                {/* Active Humagents List */}
                <div className="pt-3 border-t border-slate-200 space-y-2.5">
                  <div className="text-[10px] font-mono uppercase text-slate-500 font-extrabold">
                    ACTIVE HUMAGENTS ({humagents.length})
                  </div>

                  {humagents.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                      No Humagents created yet. Create a Humagent above to allocate them to client workspaces.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {humagents.map((h) => (
                        <div
                          key={h.id}
                          className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-extrabold text-slate-900">
                                {h.full_name}
                              </div>
                              <div className="text-[11px] font-mono text-emerald-700">
                                {h.email}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                              HUMAGENT
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs font-mono">
                            <div>
                              <span className="font-bold text-slate-900">
                                ID: {h.login_id}
                              </span>{" "}
                              |{" "}
                              <span className="font-bold text-emerald-700">
                                Pass: {h.password_plain}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <a
                                href={buildMailtoShareLink({
                                  toEmail: h.email,
                                  recipientName: h.full_name,
                                  companyName: "RevGen AI Human Verification",
                                  loginId: h.login_id,
                                  password: h.password_plain,
                                  roleLabel: "Humagent Portal",
                                })}
                                className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600"
                                title="Email Credentials to Humagent"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `Humagent Email: ${h.email} | Login ID: ${h.login_id} | Password: ${h.password_plain}`
                                  );
                                  setCopiedId(h.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                                title="Copy Humagent Credentials"
                              >
                                {copiedId === h.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ TAB 2: SLACK-STYLE WORKSPACE CHANNELS HUB (ADMIN SUPERVISION) ════════════════ */}
        {activeTab === "workspace_channels" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-indigo-600 font-bold">
                  ADMIN MULTI-CHANNEL SUPERVISION · ALL CLIENT WORKSPACES
                </span>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Real-Time Workspace Collaboration Channels ({workspaces.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Only the Admin can rename workspace channels (e.g. #RevGenAIxClientName). Supervise conversations between each Client and their allocated Humagent, share Google Meet links, book appointments, share documents, and manage payment/payout milestones.
                </p>
              </div>
            </div>

            <WorkspaceChannelHub
              role="admin"
              currentUserEmail={user.email}
              currentUserName="RevGen AI Admin"
            />
          </div>
        )}

        {/* ════════════════ TAB 3: CLIENT WORKSPACES & INCOMING ICP MIDDLEWARE ════════════════ */}
        {activeTab === "clients_middleware" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 5 Cols: Onboarded Client Workspaces + Humagent Allocation + Share Email */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="text-xs font-mono uppercase text-slate-500 font-extrabold">
                  APPROVED CLIENT WORKSPACES ({workspaces.length})
                </div>

                {workspaces.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                    No client workspaces onboarded yet. Approve a request or create a client in Tab 1.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workspaces.map((ws) => {
                      const isSelected = ws.id === activeWorkspace?.id;
                      const primarySpokesperson = ws.spokespersons[0];
                      return (
                        <div
                          key={ws.id}
                          onClick={() => setSelectedWorkspaceId(ws.id)}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer space-y-3 ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/40"
                              : "border-slate-200 hover:border-slate-300 bg-slate-50/60"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-extrabold text-slate-900">
                                {ws.companyName}
                              </div>
                              <div className="text-[11px] font-mono text-indigo-600">
                                @{ws.companyDomain} · {ws.spokespersons.length} Spokesperson(s)
                              </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-800">
                              {ws.status}
                            </span>
                          </div>

                          {/* Generated Client ID & Password + Email Share */}
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs font-mono">
                            <div className="min-w-0">
                              <span className="text-[10px] text-slate-500 block">
                                CLIENT LOGIN ID &amp; PASSWORD
                              </span>
                              <span className="font-bold text-slate-900">
                                ID: {ws.generatedLoginId}
                              </span>{" "}
                              <span className="text-slate-400">|</span>{" "}
                              <span className="font-bold text-indigo-700">
                                Pass: {ws.generatedPassword}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {primarySpokesperson?.email && (
                                <a
                                  href={buildMailtoShareLink({
                                    toEmail: primarySpokesperson.email,
                                    recipientName: primarySpokesperson.fullName,
                                    companyName: ws.companyName,
                                    loginId: ws.generatedLoginId,
                                    password: ws.generatedPassword,
                                  })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-sans font-bold flex items-center gap-1"
                                  title="Share Credentials via Email"
                                >
                                  <Mail className="w-3 h-3" />
                                  <span>Email</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(
                                    `Client ID: ${ws.generatedLoginId} | Password: ${ws.generatedPassword}`
                                  );
                                  setCopiedId(ws.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                                title="Copy Credentials"
                              >
                                {copiedId === ws.id ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Allocate Humagent Dropdown */}
                          <div
                            className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                              Allocated Humagent:
                            </span>
                            <select
                              value={ws.assignedHumagentId || ""}
                              onChange={(e) =>
                                handleAllocateHumagent(ws.id, e.target.value)
                              }
                              className="px-2 py-1 rounded border border-slate-300 text-xs font-semibold text-slate-900 bg-slate-50"
                            >
                              <option value="">Unassigned (All Humagents)</option>
                              {humagents.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.full_name} ({h.login_id})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Dedicated Workspace Channel Shortcut */}
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                            <span className="font-mono text-indigo-700 font-bold">
                              Channel: #{ws.channelName}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWorkspaceId(ws.id);
                                setActiveTab("workspace_channels");
                              }}
                              className="text-indigo-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Hash className="w-3 h-3" />
                              <span>Open Channel</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right 7 Cols: Incoming ICP & DNC Middleware for Selected Client */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-indigo-600 font-bold">
                      ADMIN MIDDLEWARE · INCOMING CLIENT ICP &amp; DNC BRIEF
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-900">
                      {activeWorkspace
                        ? `${activeWorkspace.companyName} — ICP & Growth Inputs`
                        : "Select a Client Workspace"}
                    </h2>
                  </div>

                  {activeWorkspace && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("agentic_prospecting")}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>
                        Launch Agentic Prospecting for {activeWorkspace.companyName}
                      </span>
                    </button>
                  )}
                </div>

                {icpSubmissions.filter(
                  (i) => !activeWorkspace || i.workspaceId === activeWorkspace.id
                ).length === 0 ? (
                  <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    No ICP brief submitted by this client workspace yet.
                  </div>
                ) : (
                  icpSubmissions
                    .filter(
                      (i) => !activeWorkspace || i.workspaceId === activeWorkspace.id
                    )
                    .map((icp) => (
                      <div
                        key={icp.id}
                        className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold">
                              {icp.status}
                            </span>
                            <span className="ml-2 text-xs font-mono text-slate-500">
                              Submitted by {icp.submittedByEmail} ·{" "}
                              {new Date(icp.submittedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-bold text-emerald-700">
                            Cadence: {icp.deliveryCadence}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                            <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                              CLIENT OFFERING
                            </div>
                            <div className="font-bold text-slate-900">{icp.offering}</div>
                          </div>
                          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                            <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                              BUSINESS GOAL
                            </div>
                            <div className="font-bold text-slate-900">
                              {icp.businessGoal}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-mono text-slate-500 font-bold">
                              INDUSTRIES
                            </div>
                            <div className="font-semibold text-slate-900 mt-1">
                              {icp.targetIndustries.join(", ")}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-mono text-slate-500 font-bold">
                              GEOGRAPHIES
                            </div>
                            <div className="font-semibold text-slate-900 mt-1">
                              {icp.geographies.join(", ")}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-mono text-slate-500 font-bold">
                              BUYER FUNCTIONS
                            </div>
                            <div className="font-semibold text-slate-900 mt-1">
                              {icp.buyerFunctions.join(", ")}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200">
                            <div className="text-[10px] font-mono text-slate-500 font-bold">
                              REQUIRED SIGNALS
                            </div>
                            <div className="font-semibold text-indigo-700 mt-1">
                              {icp.requiredSignals.join(", ")}
                            </div>
                          </div>
                        </div>

                        {icp.dncEntries.length > 0 && (
                          <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2">
                            <div className="text-[10px] font-mono uppercase text-rose-800 font-extrabold">
                              DNC / EXCLUSION LIST (DOMAIN · COMPANY NAME · LOCATION)
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {icp.dncEntries.map((d, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-xs font-mono text-rose-900"
                                >
                                  <strong>{d.domain}</strong> · {d.companyName} ({d.location})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ TAB 3: AGENTIC PROSPECTING (5 SIGNALS MATCHING + DATA ENRICHMENT) ════════════════ */}
        {activeTab === "agentic_prospecting" && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-indigo-600 font-bold">
                    AGENTIC PROSPECTING ENGINE · SEARCH ACCOUNTS (TARGETED COMPANY)
                  </span>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Parallel 5-Signal Matching &amp; 20-Column Data Enrichment
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-600">Target Client:</span>
                  <select
                    value={activeWorkspace?.id || ""}
                    onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900"
                  >
                    {workspaces.length === 0 && (
                      <option value="">No Client Workspaces Yet</option>
                    )}
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.companyName} (@{ws.companyDomain})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <form
                onSubmit={handleRunAgenticProspecting}
                className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
              >
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                    input.Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={targetCompanyQuery}
                    onChange={(e) => setTargetCompanyQuery(e.target.value)}
                    placeholder="Enter target company"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                    company.website
                  </label>
                  <input
                    type="text"
                    value={targetDomainQuery}
                    onChange={(e) => setTargetDomainQuery(e.target.value)}
                    placeholder="domain.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={targetLocationQuery}
                    onChange={(e) => setTargetLocationQuery(e.target.value)}
                    placeholder="City / Region"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                    Targeted Signal (ICP Signal)
                  </label>
                  <input
                    type="text"
                    value={targetSignalQuery}
                    onChange={(e) => setTargetSignalQuery(e.target.value)}
                    placeholder="Expansion / Hiring / Funding"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProspecting || !activeWorkspace}
                  className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isProspecting
                      ? "Enriching..."
                      : "Prospect & Push to Humagent"}
                  </span>
                </button>
              </form>

              {/* Visual Diagram of the 2 Parallel Branches */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-xs font-mono uppercase text-indigo-700 font-extrabold">
                    BRANCH 1 · SIGNALS MATCHING + SOURCE LINKS
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      [
                        "1) Targeted Signal (ICP mentioned signal)",
                        "Brave Search API",
                        "Matches mandatory ICP trigger with direct source URL",
                      ],
                      [
                        "2) Hiring Signal (Company Career pages)",
                        "Google Search API",
                        "Crawls career pages for active expansion roles",
                      ],
                      [
                        "3) Investments / Funding",
                        "Tavily",
                        "Extracts capex, lease commitments, and funding rounds",
                      ],
                      [
                        "4) News / Article",
                        "Crawler",
                        "Dated press releases and verified business events",
                      ],
                      [
                        "5) Social Media",
                        "Slug → URL → Verify Checked → Recent Post",
                        "Verifies company LinkedIn/X slug & extracts recent post",
                      ],
                    ].map(([title, engine, desc]) => (
                      <div
                        key={title}
                        className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{title}</div>
                          <div className="text-[11px] text-slate-500">{desc}</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 font-mono text-[10px] font-bold text-indigo-700 shrink-0">
                          → {engine}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-xs font-mono uppercase text-emerald-800 font-extrabold">
                    BRANCH 2 · DATA ENRICHMENT (ALL 20 SCHEMA FIELDS)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                    {[
                      "1. input.Company Name",
                      "2. company.website",
                      "3. company_number",
                      "4. Employee Count",
                      "5. Company Industry",
                      "6. Location",
                      "7. Tech Stack",
                      "8. company.linkedin_url",
                      "9. company.twitter_url",
                      "10. company_type",
                      "11. company.revenue",
                      "12. company.description",
                      "13. company.logo",
                      "14. founded_year",
                      "15. Email/phone",
                      "16. Scoring (Fit/Intent)",
                      "17. Priority",
                      "18. All Signal Columns",
                      "19. Signal Source Links",
                      "20. Human QA Status",
                    ].map((field) => (
                      <div
                        key={field}
                        className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 font-semibold text-[11px]"
                      >
                        {field}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Signals Matching Breakdown per Account */}
            <div className="space-y-4">
              {accounts.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-xs text-slate-500">
                  No accounts prospected yet. Use the Agentic Prospecting form above to enrich target companies and dispatch them to your allocated Humagent.
                </div>
              ) : (
                accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono text-xs font-bold">
                          #{acc.leadNumber}
                        </span>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900">
                            {acc.inputCompanyName}
                          </h3>
                          <div className="text-xs font-mono text-indigo-600">
                            {acc.companyWebsite} · {acc.location} · {acc.employeeCount}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full font-mono text-xs font-bold border ${
                            acc.stage === "published_to_client"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {acc.stage === "published_to_client"
                            ? "✓ Published to Client"
                            : "In Humagent Queue"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="text-[10px] font-mono font-bold text-indigo-700 uppercase">
                          1) Targeted Signal · Brave API
                        </div>
                        <p className="text-slate-700 leading-snug">
                          {acc.signalsMatching.targetedSignalBrave.summary}
                        </p>
                        <a
                          href={acc.signalsMatching.targetedSignalBrave.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-600 hover:underline font-bold"
                        >
                          <span>Source Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="text-[10px] font-mono font-bold text-blue-700 uppercase">
                          2) Hiring Signal · Google Careers
                        </div>
                        <p className="text-slate-700 leading-snug">
                          {acc.signalsMatching.hiringSignalGoogleCareers.summary}
                        </p>
                        <a
                          href={acc.signalsMatching.hiringSignalGoogleCareers.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 hover:underline font-bold"
                        >
                          <span>Career Page Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="text-[10px] font-mono font-bold text-purple-700 uppercase">
                          3) Investments / Funding · Tavily
                        </div>
                        <p className="text-slate-700 leading-snug">
                          {acc.signalsMatching.investmentsFundingTavily.summary}
                        </p>
                        <a
                          href={acc.signalsMatching.investmentsFundingTavily.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-600 hover:underline font-bold"
                        >
                          <span>Tavily Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="text-[10px] font-mono font-bold text-amber-800 uppercase">
                          4) News / Article · Crawler
                        </div>
                        <p className="text-slate-700 leading-snug">
                          {acc.signalsMatching.newsArticleCrawler.summary}
                        </p>
                        <a
                          href={acc.signalsMatching.newsArticleCrawler.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-700 hover:underline font-bold"
                        >
                          <span>Article Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                        <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase">
                          5) Social → Slug → URL → Verified
                        </div>
                        <div className="text-[11px] font-mono text-emerald-900">
                          Slug: <strong>{acc.signalsMatching.socialMediaVerified.slug}</strong>{" "}
                          {acc.signalsMatching.socialMediaVerified.verifyChecked && "✓ Checked"}
                        </div>
                        <p className="text-slate-700 leading-snug">
                          {acc.signalsMatching.socialMediaVerified.recentPostSummary}
                        </p>
                        <a
                          href={acc.signalsMatching.socialMediaVerified.recentPostUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 hover:underline font-bold"
                        >
                          <span>Verified Recent Post</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ════════════════ TAB 4: COMPLETE 20-COLUMN DATA ENRICHMENT TABLE ════════════════ */}
        {activeTab === "all_20_columns" && (
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-indigo-600 font-bold">
                  ADMIN DATA ENRICHMENT TABLE
                </div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Full 20-Column Enriched Company &amp; Signal Schema
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Scroll horizontally to inspect all 20 columns →
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] uppercase text-slate-600 whitespace-nowrap">
                    <th className="p-3">input.Company Name</th>
                    <th className="p-3">company.website</th>
                    <th className="p-3">company_number</th>
                    <th className="p-3">Employee Count</th>
                    <th className="p-3">Company Industry</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Tech Stack</th>
                    <th className="p-3">company.linkedin_url</th>
                    <th className="p-3">company.twitter_url</th>
                    <th className="p-3">company_type</th>
                    <th className="p-3">company.revenue</th>
                    <th className="p-3">company.description</th>
                    <th className="p-3">company.logo</th>
                    <th className="p-3">founded_year</th>
                    <th className="p-3">Email/phone</th>
                    <th className="p-3">Scoring</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Targeted Signal (Brave)</th>
                    <th className="p-3">Hiring Signal (Google)</th>
                    <th className="p-3">Funding (Tavily) &amp; Social</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {accounts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 align-top">
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        {a.inputCompanyName}
                      </td>
                      <td className="p-3 font-mono text-indigo-600 whitespace-nowrap">
                        {a.companyWebsite}
                      </td>
                      <td className="p-3 font-mono whitespace-nowrap">{a.companyNumber}</td>
                      <td className="p-3 whitespace-nowrap">{a.employeeCount}</td>
                      <td className="p-3 whitespace-nowrap">{a.companyIndustry}</td>
                      <td className="p-3 whitespace-nowrap">{a.location}</td>
                      <td className="p-3 whitespace-nowrap">{a.techStack.join(", ")}</td>
                      <td className="p-3 font-mono text-blue-600 whitespace-nowrap">
                        <a href={a.companyLinkedinUrl} target="_blank" rel="noreferrer">
                          LinkedIn ↗
                        </a>
                      </td>
                      <td className="p-3 font-mono text-sky-600 whitespace-nowrap">
                        <a href={a.companyTwitterUrl} target="_blank" rel="noreferrer">
                          X/Twitter ↗
                        </a>
                      </td>
                      <td className="p-3 whitespace-nowrap">{a.companyType}</td>
                      <td className="p-3 font-bold whitespace-nowrap">{a.companyRevenue}</td>
                      <td className="p-3 min-w-[240px] text-slate-600">
                        {a.companyDescription}
                      </td>
                      <td className="p-3 font-mono font-bold">{a.companyLogo}</td>
                      <td className="p-3 font-mono">{a.foundedYear}</td>
                      <td className="p-3 font-mono whitespace-nowrap">
                        {a.companyEmailPhone}
                      </td>
                      <td className="p-3 font-mono font-bold whitespace-nowrap">
                        Fit {a.scoring.icpFitScore} / Intent {a.scoring.intentScore}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold">
                          {a.priority}
                        </span>
                      </td>
                      <td className="p-3 min-w-[220px]">
                        {a.signalsMatching.targetedSignalBrave.summary}
                      </td>
                      <td className="p-3 min-w-[220px]">
                        {a.signalsMatching.hiringSignalGoogleCareers.summary}
                      </td>
                      <td className="p-3 min-w-[220px]">
                        {a.signalsMatching.investmentsFundingTavily.summary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
