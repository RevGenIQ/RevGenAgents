"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Feather,
  GitBranch,
  Users,
  Hash,
  Clock,
  CheckCircle2,
  ArrowRight,
  Sliders,
  ShieldCheck,
  Layers,
  Calendar,
} from "lucide-react";
import { NavItemKey } from "../layout/Sidebar";
import { useAuth } from "@/context/AuthContext";
import {
  ClientCompanyWorkspace,
  ClientIcpSubmission,
  ProspectAccountRecord,
  WorkspaceChatMessage,
  getWorkspacesStore,
  getIcpSubmissionsStore,
  getProspectAccountsStore,
  getWorkspaceMessagesStore,
} from "@/lib/store/osWorkflowStore";

interface CommandCenterProps {
  workspaceId?: string;
  onNavigate: (key: NavItemKey) => void;
  onOpenDossier?: (companyName: string) => void;
}

export function CommandCenter({
  workspaceId = "",
  onNavigate,
}: CommandCenterProps) {
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState<ClientCompanyWorkspace | null>(
    null
  );
  const [icpBrief, setIcpBrief] = useState<ClientIcpSubmission | null>(null);
  const [accounts, setAccounts] = useState<ProspectAccountRecord[]>([]);
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [formattedDate, setFormattedDate] = useState("");

  const loadState = () => {
    const wsList = getWorkspacesStore();
    const myWs =
      wsList.find((w) => w.id === workspaceId) || wsList[0] || null;
    setWorkspace(myWs);

    const icps = getIcpSubmissionsStore();
    const myIcp =
      icps.find((i) => i.workspaceId === (myWs?.id || workspaceId)) ||
      icps[0] ||
      null;
    setIcpBrief(myIcp);

    const allAccs = getProspectAccountsStore();
    const myAccs = allAccs.filter(
      (a) =>
        (!myWs || a.workspaceId === myWs.id) &&
        a.stage === "published_to_client"
    );
    setAccounts(myAccs);

    if (myWs) {
      setMessages(getWorkspaceMessagesStore(myWs.id));
    }
  };

  useEffect(() => {
    const now = new Date();
    setFormattedDate(
      now
        .toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase()
    );
    loadState();
    window.addEventListener("revgen-os-store-update", loadState);
    return () =>
      window.removeEventListener("revgen-os-store-update", loadState);
  }, [workspaceId]);

  const userName = user?.fullName
    ? user.fullName.split(" ")[0]
    : user?.email
    ? user.email.split("@")[0]
    : "Partner";

  const companyName =
    workspace?.companyName || user?.companyName || "Your Company";
  const channelName =
    workspace?.channelName ||
    `RevGenAIx${companyName.replace(/[^a-zA-Z0-9]/g, "")}`;

  const sampleAccountsCount = accounts.filter(
    (a) => a.deliveryType === "sample"
  ).length;
  const monthlyAccountsCount = accounts.filter(
    (a) => a.deliveryType === "daily"
  ).length;
  const totalContactsVerified = accounts.reduce(
    (sum, a) => sum + (a.contacts?.length || 0),
    0
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-left">
      {/* Executive Header */}
      <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono tracking-wider uppercase text-indigo-600 dark:text-indigo-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
            <span>
              REVGEN AI COMMAND CENTER · {companyName.toUpperCase()} ·{" "}
              {formattedDate}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight">
            Welcome back, {userName}.
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text2)] max-w-2xl leading-relaxed">
            Configure or upgrade your ICP brief, monitor the live{" "}
            <strong>ATLAS 10-Layer Research Ecosystem</strong>, review{" "}
            <strong>~5 Sample Cards (&lt;24h max SLA)</strong> followed by{" "}
            <strong>~35 Verified Accounts over 1 Month</strong>, and collaborate directly in{" "}
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              #{channelName}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate("icp_inputs")}
            className="px-4 py-2.5 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{icpBrief ? "Upgrade ICP Brief" : "Submit ICP Brief"}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("agent_mesh")}
            className="px-4 py-2.5 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>ATLAS &amp; L1–L10 Live</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("workspace_channel")}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Open #{channelName}</span>
          </button>
        </div>
      </div>

      {/* 4 Key Campaign Metrics (With Clear Approximate Benchmarks) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text3)] font-bold">
              PHASE 1 · SAMPLE BATCH
            </span>
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight">
            {sampleAccountsCount}{" "}
            <span className="text-base font-semibold text-[var(--text3)]">
              / ~5 Cards
            </span>
          </div>
          <div className="text-[11px] text-[var(--text2)]">
            Delivery SLA: <strong>~24 Hours Max</strong> after ICP submission
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text3)] font-bold">
              PHASE 2 · 1-MONTH ROLLOUT
            </span>
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight">
            {monthlyAccountsCount}{" "}
            <span className="text-base font-semibold text-[var(--text3)]">
              / ~35 Cards
            </span>
          </div>
          <div className="text-[11px] text-[var(--text2)]">
            Cadence: <strong>~1–2 Verified Cards / Day</strong> (~30-Day Span)
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text3)] font-bold">
              VERIFIED DECISION-MAKERS
            </span>
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight">
            {totalContactsVerified}{" "}
            <span className="text-base font-semibold text-[var(--text3)]">
              / ~120+ Est.
            </span>
          </div>
          <div className="text-[11px] text-[var(--text2)]">
            Target: <strong>~3+ Human-Verified Contacts</strong> per Account
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text3)] font-bold">
              INTELLIGENCE COVERAGE
            </span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight">
            L1–L10{" "}
            <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
              Active
            </span>
          </div>
          <div className="text-[11px] text-[var(--text2)]">
            Scanning <strong>~100+ Live Signal Sources</strong> + Human QA Gate
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid: 4-Stage Client Journey + Workspace Channel Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: 30-Day Campaign Execution Architecture */}
        <div className="lg:col-span-7 rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 space-y-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[var(--line2)] pb-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
                END-TO-END CLIENT JOURNEY · 30-DAY DELIVERY CYCLE
              </span>
              <h2 className="text-base font-extrabold text-[var(--text)] mt-0.5">
                Your Active Prospecting &amp; Delivery Workflow
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
              {icpBrief ? "ICP Active · Search Live" : "Step 1 Pending: Submit ICP"}
            </span>
          </div>

          <div className="space-y-3">
            {/* Step 1 */}
            <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-mono text-xs font-extrabold flex items-center justify-center shrink-0">
                  01
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--text)]">
                      ICP &amp; Growth Brief (+ Anytime ICP Upgrade)
                    </h3>
                    {icpBrief && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                        Submitted
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text2)] mt-0.5 leading-relaxed">
                    {icpBrief
                      ? `Targeting ${icpBrief.targetIndustries.join(", ")} in ${icpBrief.geographies.join(", ")} (${icpBrief.dncEntries.length} DNC exclusions). You can upgrade your ICP anytime.`
                      : "Enter your target industries, geographies, buyer titles, signals, and DNC exclusions to start the ATLAS search."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("icp_inputs")}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Feather className="w-3.5 h-3.5" />
                <span>{icpBrief ? "Upgrade ICP" : "Configure ICP"}</span>
              </button>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-mono text-xs font-extrabold flex items-center justify-center shrink-0">
                  02
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    ATLAS Supervision Graph &amp; L1–L10 Live Search
                  </h3>
                  <p className="text-xs text-[var(--text2)] mt-0.5 leading-relaxed">
                    Inspect real-time progress across{" "}
                    <strong>ATLAS Supervisor</strong> (Probe, Signal, Verify, Score, Sentinel, Gatekeeper, Deliver) and{" "}
                    <strong>Layers L1–L10</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("agent_mesh")}
                className="px-3.5 py-2 rounded-xl bg-[var(--bg2)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <GitBranch className="w-3.5 h-3.5 text-emerald-600" />
                <span>Inspect ATLAS</span>
              </button>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white font-mono text-xs font-extrabold flex items-center justify-center shrink-0">
                  03
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    ~5 Sample Cards (&lt;24h Max) → ~35 Cards Over 1 Month
                  </h3>
                  <p className="text-xs text-[var(--text2)] mt-0.5 leading-relaxed">
                    Receive your first <strong>~5 Human-Verified Sample Cards within 24 hours max</strong>, followed by{" "}
                    <strong>~35 high-intent Account Dossiers over a 1-month span</strong> with PDF &amp; CSV export.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("accounts_contacts")}
                className="px-3.5 py-2 rounded-xl bg-[var(--bg2)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-sky-600" />
                <span>View Cards ({accounts.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Dedicated Workspace Channel Summary & Direct Access */}
        <div className="lg:col-span-5 rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 flex flex-col justify-between space-y-4 shadow-2xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line2)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/10 border border-indigo-500/25 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold block">
                    REAL-TIME WORKSPACE CHANNEL
                  </span>
                  <h2 className="text-base font-extrabold text-[var(--text)] font-mono">
                    #{channelName}
                  </h2>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                ● Live
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] text-xs text-[var(--text2)] space-y-1.5">
              <div>
                <strong>Assigned Humagent:</strong>{" "}
                <span className="text-[var(--text)] font-semibold">
                  {workspace?.assignedHumagentName || "Allocating Specialist..."}
                </span>
              </div>
              <div>
                <strong>Supervising Authority:</strong>{" "}
                <span className="text-[var(--text)] font-semibold">
                  RevGen AI Admin
                </span>
              </div>
              <p className="text-[11px] text-[var(--text3)] pt-1">
                All sample reviews, ICP adjustments, Google Meet calls, appointment bookings, ~35-card monthly delivery pacing, and payment/payout milestones take place in this channel.
              </p>
            </div>

            {/* Latest Channel Messages Preview */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase text-[var(--text3)] font-bold">
                RECENT ACTIVITY IN #{channelName} ({messages.length})
              </div>
              {messages.length === 0 ? (
                <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] text-xs text-[var(--text3)]">
                  No messages yet. Click below to open #{channelName} and message your Humagent &amp; Admin.
                </div>
              ) : (
                messages.slice(-2).map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[var(--text)]">
                        {m.senderName}{" "}
                        <span className="font-mono text-[10px] uppercase text-indigo-600 dark:text-indigo-400">
                          ({m.senderRole})
                        </span>
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text3)]">
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text2)] line-clamp-2">
                      {m.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("workspace_channel")}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Hash className="w-4 h-4" />
            <span>Open Real-Time Channel #{channelName}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
