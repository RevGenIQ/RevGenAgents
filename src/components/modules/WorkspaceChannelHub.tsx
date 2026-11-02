"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Hash,
  Send,
  Video,
  Calendar,
  FileText,
  DollarSign,
  Sliders,
  Shield,
  UserCheck,
  Building2,
  Bot,
  Edit3,
  Check,
  X,
  ExternalLink,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { CompanyFavicon } from "@/components/ui/CompanyFavicon";
import {
  ClientCompanyWorkspace,
  WorkspaceChatMessage,
  getWorkspacesStore,
  getWorkspaceMessagesStore,
  renameWorkspaceChannel,
  sendWorkspaceChatMessage,
  syncWorkflowFromDatabase,
} from "@/lib/store/osWorkflowStore";

interface WorkspaceChannelHubProps {
  role: "admin" | "humagent" | "client";
  currentUserEmail: string;
  currentUserName: string;
  /** For client role, lock to their single workspace ID. For admin/humagent, optional initial selection */
  lockedWorkspaceId?: string;
  onUpgradeIcpClick?: () => void;
  compactHeight?: boolean;
}

export function WorkspaceChannelHub({
  role,
  currentUserEmail,
  currentUserName,
  lockedWorkspaceId,
  onUpgradeIcpClick,
  compactHeight = false,
}: WorkspaceChannelHubProps) {
  const [workspaces, setWorkspaces] = useState<ClientCompanyWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
    lockedWorkspaceId || ""
  );
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [composerMode, setComposerMode] = useState<
    "text" | "google_meet" | "appointment" | "document" | "payment"
  >("text");

  // Extra attachment fields (zero hardcoded dummy values)
  const [meetUrlInput, setMeetUrlInput] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [docTitleInput, setDocTitleInput] = useState("");
  const [docUrlInput, setDocUrlInput] = useState("");
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentStatusInput, setPaymentStatusInput] = useState(
    "Invoice / Retainer Shared"
  );

  // Admin-only channel rename state
  const [isRenamingChannel, setIsRenamingChannel] = useState(false);
  const [channelNameDraft, setChannelNameDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadState = () => {
    const wsList = getWorkspacesStore();
    const visibleWorkspaces =
      role === "client" && lockedWorkspaceId
        ? wsList.filter((w) => w.id === lockedWorkspaceId)
        : wsList;

    setWorkspaces(visibleWorkspaces);

    const activeId =
      role === "client" && lockedWorkspaceId
        ? lockedWorkspaceId
        : selectedWorkspaceId &&
          visibleWorkspaces.some((w) => w.id === selectedWorkspaceId)
        ? selectedWorkspaceId
        : visibleWorkspaces[0]?.id || "";

    if (activeId && activeId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(activeId);
    }

    if (activeId) {
      setMessages(getWorkspaceMessagesStore(activeId));
    } else {
      setMessages([]);
    }
  };

  useEffect(() => {
    loadState();
    const interval = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      syncWorkflowFromDatabase().then(loadState);
    }, 8000);

    window.addEventListener("revgen-os-store-update", loadState);
    return () => {
      clearInterval(interval);
      window.removeEventListener("revgen-os-store-update", loadState);
    };
  }, [selectedWorkspaceId, lockedWorkspaceId, role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedWorkspaceId]);

  const activeWorkspace =
    workspaces.find((w) => w.id === selectedWorkspaceId) || workspaces[0];

  const handleRenameChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== "admin" || !activeWorkspace || !channelNameDraft.trim())
      return;
    setIsSending(true);
    try {
      const clean = channelNameDraft.trim().replace(/^#+/, "");
      const res = await renameWorkspaceChannel(activeWorkspace.id, clean);
      if (res.ok) {
        setIsRenamingChannel(false);
        setStatusNotice(`Channel renamed to #${clean}`);
        setTimeout(() => setStatusNotice(null), 3500);
        loadState();
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;

    let finalContent = messageInput.trim();
    const metadata: WorkspaceChatMessage["metadata"] = {};

    if (composerMode === "google_meet") {
      const url = meetUrlInput.trim() || "https://meet.google.com/new";
      metadata.meetUrl = url;
      if (!finalContent) {
        finalContent = `Shared a Google Meet conference link: ${url}`;
      }
    } else if (composerMode === "appointment") {
      metadata.appointmentDate =
        appointmentDate || new Date().toISOString().slice(0, 10);
      metadata.appointmentTime = appointmentTime.trim() || "Scheduled Slot";
      metadata.agenda = finalContent || "Campaign & ICP Sync";
      if (!finalContent) {
        finalContent = `Scheduled appointment on ${metadata.appointmentDate} (${metadata.appointmentTime}).`;
      }
    } else if (composerMode === "document") {
      if (!docUrlInput.trim() && !finalContent) return;
      metadata.docTitle = docTitleInput.trim() || "Workspace Document";
      metadata.docUrl = docUrlInput.trim();
      if (!finalContent) {
        finalContent = `Shared document: ${metadata.docTitle}`;
      }
    } else if (composerMode === "payment") {
      if (!paymentAmountInput.trim() && !finalContent) return;
      metadata.paymentAmount = paymentAmountInput.trim() || "Commercial Update";
      metadata.paymentStatus = paymentStatusInput;
      if (!finalContent) {
        finalContent = `Commercial & Payout Milestone (${metadata.paymentStatus}): ${metadata.paymentAmount}`;
      }
    } else {
      if (!finalContent) return;
    }

    setIsSending(true);
    try {
      const res = await sendWorkspaceChatMessage({
        workspaceId: activeWorkspace.id,
        messageType: composerMode,
        content: finalContent,
        metadata,
      });
      if (res.ok) {
        setMessageInput("");
        setMeetUrlInput("");
        setAppointmentDate("");
        setAppointmentTime("");
        setDocTitleInput("");
        setDocUrlInput("");
        setPaymentAmountInput("");
        setComposerMode("text");
        loadState();
      }
    } finally {
      setIsSending(false);
    }
  };

  const getRoleBadge = (senderRole: WorkspaceChatMessage["senderRole"]) => {
    switch (senderRole) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-[10px] font-bold uppercase">
            <Shield className="w-2.5 h-2.5" />
            Admin Supervisor
          </span>
        );
      case "humagent":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-[10px] font-bold uppercase">
            <UserCheck className="w-2.5 h-2.5" />
            Humagent Specialist
          </span>
        );
      case "client":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-600 text-white font-mono text-[10px] font-bold uppercase">
            <Building2 className="w-2.5 h-2.5" />
            Client
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-mono text-[10px] font-bold uppercase">
            <Bot className="w-2.5 h-2.5" />
            RevGen AI System
          </span>
        );
    }
  };

  const showChannelSidebar = role === "admin" || role === "humagent";
  const fieldInputClass =
    "px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all";

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs overflow-hidden flex flex-col md:flex-row ${
        compactHeight ? "h-[580px]" : "h-[700px]"
      }`}
    >
      {/* Left Multi-Channel Sidebar — Visible ONLY for Admin (all channels) and Humagent (allocated channels) */}
      {showChannelSidebar && (
        <div className="w-full md:w-76 border-b md:border-b-0 md:border-r border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold block">
                {role === "admin"
                  ? "ADMIN · ALL WORKSPACE CHANNELS"
                  : "HUMAGENT · ASSIGNED CHANNELS"}
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                Workspace Channels ({workspaces.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => syncWorkflowFromDatabase().then(loadState)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
              title="Refresh Channels"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {workspaces.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                {role === "admin"
                  ? "No client workspaces created yet."
                  : "No client workspaces allocated to you yet."}
              </div>
            ) : (
              workspaces.map((ws) => {
                const isSelected = ws.id === activeWorkspace?.id;
                const wsMsgs = getWorkspaceMessagesStore(ws.id);
                const lastMsg = wsMsgs[wsMsgs.length - 1];
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      setSelectedWorkspaceId(ws.id);
                      setIsRenamingChannel(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-900 dark:text-slate-100 border-slate-200/90 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CompanyFavicon
                          domain={ws.companyDomain}
                          name={ws.companyName}
                          size="xs"
                        />
                        <span className="font-mono text-xs font-extrabold truncate">
                          #
                          {ws.channelName ||
                            `RevGenAIx${ws.companyName.replace(
                              /[^a-zA-Z0-9]/g,
                              ""
                            )}`}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                        }`}
                      >
                        {wsMsgs.length}
                      </span>
                    </div>

                    <div
                      className={`text-[11px] font-semibold mt-1.5 truncate ${
                        isSelected
                          ? "text-indigo-100"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {ws.companyName} · {ws.companyDomain}
                    </div>

                    <div
                      className={`text-[10px] mt-0.5 truncate ${
                        isSelected
                          ? "text-indigo-200"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {ws.assignedHumagentName
                        ? `Humagent: ${ws.assignedHumagentName}`
                        : "Humagent: Unassigned"}
                    </div>

                    {lastMsg && (
                      <div
                        className={`text-[10px] mt-1.5 pt-1.5 border-t truncate ${
                          isSelected
                            ? "border-white/15 text-white/90"
                            : "border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <strong>{lastMsg.senderName}:</strong> {lastMsg.content}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Main Channel Conversation Area (Flex column with scrollable message viewport + sticky bottom composer) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-slate-900 relative">
        {!activeWorkspace ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Hash className="w-8 h-8 text-slate-400 mb-2" />
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              No Active Workspace Channel
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
              {role === "admin"
                ? "Create or approve a Client Workspace to automatically provision its #RevGenAIxClientName channel."
                : "Once the Admin allocates a Client Workspace to you, its channel will appear here."}
            </p>
          </div>
        ) : (
          <>
            {/* Top Channel Header (With Client Company Domain Favicon) */}
            <div className="px-5 py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <CompanyFavicon
                  domain={activeWorkspace.companyDomain}
                  name={activeWorkspace.companyName}
                  size="md"
                />
                <div className="min-w-0">
                  {isRenamingChannel && role === "admin" ? (
                    <form
                      onSubmit={handleRenameChannel}
                      className="flex items-center gap-1.5"
                    >
                      <span className="text-sm font-mono font-bold text-indigo-600">
                        #
                      </span>
                      <input
                        type="text"
                        value={channelNameDraft}
                        onChange={(e) => setChannelNameDraft(e.target.value)}
                        placeholder="Channel name"
                        className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-indigo-500 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isSending}
                        className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                        title="Save Channel Name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRenamingChannel(false)}
                        className="p-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">
                        #{activeWorkspace.channelName}
                      </span>
                      {role === "admin" && (
                        <button
                          type="button"
                          onClick={() => {
                            setChannelNameDraft(activeWorkspace.channelName);
                            setIsRenamingChannel(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-bold cursor-pointer border border-indigo-200/70 dark:border-indigo-800/60"
                          title="Only Admin can rename this channel"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Rename Channel</span>
                        </button>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                        ● Live Tri-Party Supervision
                      </span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5">
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        Client:
                      </strong>{" "}
                      {activeWorkspace.companyName} (
                      {activeWorkspace.companyDomain})
                    </span>
                    <span>·</span>
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        Humagent:
                      </strong>{" "}
                      {activeWorkspace.assignedHumagentName ||
                        "Pending Allocation"}
                    </span>
                    <span>·</span>
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        Supervisor:
                      </strong>{" "}
                      RevGen AI Admin
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Channel Actions: SLA Pill + Client ICP Upgrade Shortcut */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    SLA: <strong>~5 Samples (&lt;24h)</strong> →{" "}
                    <strong>~35 Cards (1 Month)</strong>
                  </span>
                </div>

                {onUpgradeIcpClick && (
                  <button
                    type="button"
                    onClick={onUpgradeIcpClick}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Upgrade ICP Criteria</span>
                  </button>
                )}
              </div>
            </div>

            {statusNotice && (
              <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800/60 text-xs font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                {statusNotice}
              </div>
            )}

            {/* Scrollable Message Stream */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-slate-50/60 dark:bg-slate-950/40">
              {messages.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-center space-y-2 shadow-2xs">
                  <Sparkles className="w-6 h-6 text-indigo-600 mx-auto" />
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Welcome to #{activeWorkspace.channelName}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                    Start the conversation below. Share Google Meet links,
                    schedule appointments, review the initial ~5 sample accounts
                    (&lt;24h max), coordinate the 1-month (~35 cards) rollout,
                    request ICP upgrades, or share payment and payout updates.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe =
                    msg.senderEmail?.toLowerCase() ===
                      currentUserEmail?.toLowerCase() &&
                    msg.senderRole === role;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.senderRole === "system"
                          ? "items-center"
                          : isMe
                          ? "items-end"
                          : "items-start"
                      }`}
                    >
                      {msg.senderRole === "system" ? (
                        <div className="max-w-2xl w-full p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-slate-800 dark:text-slate-200 space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            {getRoleBadge("system")}
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="leading-relaxed mt-1">{msg.content}</p>
                        </div>
                      ) : (
                        <div
                          className={`max-w-xl w-full rounded-2xl p-4 border space-y-2 shadow-2xs ${
                            isMe
                              ? "bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/70"
                              : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {msg.senderRole === "client" && (
                                <CompanyFavicon
                                  domain={activeWorkspace.companyDomain}
                                  name={activeWorkspace.companyName}
                                  size="xs"
                                />
                              )}
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {msg.senderName}
                              </span>
                              {getRoleBadge(msg.senderRole)}
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {new Date(msg.createdAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                            {msg.content}
                          </p>

                          {/* Rich Attachment Cards */}
                          {msg.messageType === "google_meet" &&
                            msg.metadata?.meetUrl && (
                              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Video className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                                      Google Meet Conference Link
                                    </div>
                                    <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 truncate">
                                      {msg.metadata.meetUrl}
                                    </div>
                                  </div>
                                </div>
                                <a
                                  href={
                                    msg.metadata.meetUrl.startsWith("http")
                                      ? msg.metadata.meetUrl
                                      : `https://${msg.metadata.meetUrl}`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                                >
                                  <span>Join Meet</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}

                          {msg.messageType === "appointment" && (
                            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <div>
                                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                                    Scheduled Appointment Slot
                                  </div>
                                  <div className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300">
                                    Date:{" "}
                                    {msg.metadata?.appointmentDate || "TBD"} ·
                                    Time:{" "}
                                    {msg.metadata?.appointmentTime || "TBD"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {msg.messageType === "document" &&
                            msg.metadata?.docUrl && (
                              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/60 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {msg.metadata.docTitle ||
                                        "Shared Document"}
                                    </div>
                                    <div className="text-[11px] font-mono text-sky-700 dark:text-sky-300 truncate">
                                      {msg.metadata.docUrl}
                                    </div>
                                  </div>
                                </div>
                                <a
                                  href={
                                    msg.metadata.docUrl.startsWith("http")
                                      ? msg.metadata.docUrl
                                      : `https://${msg.metadata.docUrl}`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                                >
                                  <span>Open Doc</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}

                          {msg.messageType === "payment" && (
                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <DollarSign className="w-4 h-4 text-amber-600 shrink-0" />
                                <div>
                                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                                    Commercial / Payment / Payout Milestone
                                  </div>
                                  <div className="text-[11px] font-mono text-amber-700 dark:text-amber-300">
                                    {msg.metadata?.paymentAmount} · Status:{" "}
                                    {msg.metadata?.paymentStatus}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {msg.messageType === "icp_upgrade" && (
                            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 text-[11px] font-mono text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                              <Sliders className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                ICP Brief Synced:{" "}
                                {msg.metadata?.icpSummary ||
                                  "Updated target parameters"}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Sticky Bottom Rich Composer Bar (Shadcn Light-First with zero hardcoded "e.g." examples) */}
            <div className="sticky bottom-0 z-20 p-4 border-t border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md space-y-3 shrink-0">
              {/* Quick Attachment Mode Bar */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setComposerMode("text")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    composerMode === "text"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Message
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode("google_meet")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                    composerMode === "google_meet"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Video className="w-3 h-3" />
                  <span>Share Google Meet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode("appointment")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                    composerMode === "appointment"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>Book Appointment</span>
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode("document")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                    composerMode === "document"
                      ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Share Doc / Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode("payment")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                    composerMode === "payment"
                      ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  <span>Payment / Payouts</span>
                </button>
              </div>

              {/* Extra Structured Inputs for Selected Mode (Zero hardcoded "e.g." examples) */}
              {composerMode === "google_meet" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={meetUrlInput}
                    onChange={(e) => setMeetUrlInput(e.target.value)}
                    placeholder="Enter Google Meet room URL"
                    className={`${fieldInputClass} font-mono`}
                  />
                  <a
                    href="https://meet.google.com/new"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 transition-colors"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Launch New Google Meet Room</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {composerMode === "appointment" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className={fieldInputClass}
                  />
                  <input
                    type="text"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    placeholder="Select time and timezone"
                    className={fieldInputClass}
                  />
                </div>
              )}

              {composerMode === "document" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={docTitleInput}
                    onChange={(e) => setDocTitleInput(e.target.value)}
                    placeholder="Document title"
                    className={fieldInputClass}
                  />
                  <input
                    type="text"
                    value={docUrlInput}
                    onChange={(e) => setDocUrlInput(e.target.value)}
                    placeholder="Document URL"
                    className={`${fieldInputClass} font-mono`}
                  />
                </div>
              )}

              {composerMode === "payment" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    placeholder="Enter milestone or payment reference"
                    className={fieldInputClass}
                  />
                  <select
                    value={paymentStatusInput}
                    onChange={(e) => setPaymentStatusInput(e.target.value)}
                    className={fieldInputClass}
                  >
                    <option value="Invoice / Retainer Shared">
                      Invoice / Retainer Shared
                    </option>
                    <option value="Payment Verified">Payment Verified</option>
                    <option value="Humagent Payout Approved">
                      Humagent Payout Approved
                    </option>
                    <option value="Commercial Negotiation">
                      Commercial Negotiation
                    </option>
                  </select>
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={`Write a message in #${activeWorkspace.channelName}...`}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all"
                />
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
