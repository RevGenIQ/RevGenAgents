"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UserCheck,
  ExternalLink,
  CheckCircle2,
  Plus,
  Trash2,
  Send,
  LogOut,
  Clock,
  Hash,
  Users,
  ClipboardCheck,
} from "lucide-react";
import { RevGenLogo } from "@/components/ui/RevGenLogo";
import { useAuth } from "@/context/AuthContext";
import { WorkspaceChannelHub } from "@/components/modules/WorkspaceChannelHub";
import { RunReviewQueue } from "@/components/modules/RunReviewQueue";
import {
  ProspectAccountRecord,
  EnrichedContactPerson,
  ClientCompanyWorkspace,
  getProspectAccountsStore,
  getWorkspacesStore,
  syncWorkflowFromDatabase,
} from "@/lib/store/osWorkflowStore";

export default function HumanAgentPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "qa_workbench" | "assigned_channels" | "run_review"
  >("qa_workbench");
  const [accounts, setAccounts] = useState<ProspectAccountRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<ClientCompanyWorkspace[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Add New Contact Form State
  const [newRole, setNewRole] =
    useState<EnrichedContactPerson["role"]>("Champion");
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newLinkedin, setNewLinkedin] = useState("");
  const [newWhy, setNewWhy] = useState("");

  // Strict Role Guard: Only Humagent is allowed on /human-agent
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
      if (user.role === "admin") {
        router.replace("/admin");
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  const loadFromStore = () => {
    const allAccounts = getProspectAccountsStore();
    setAccounts(allAccounts);
    setWorkspaces(getWorkspacesStore());
    const firstQueue =
      allAccounts.find((a) => a.stage === "human_agent_queue") ||
      allAccounts[0];
    if (firstQueue && !selectedAccountId) {
      setSelectedAccountId(firstQueue.id);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");

    if (isAuthenticated && user?.role === "humagent") {
      syncWorkflowFromDatabase().then(loadFromStore);
    }
    window.addEventListener("revgen-os-store-update", loadFromStore);
    return () =>
      window.removeEventListener("revgen-os-store-update", loadFromStore);
  }, [isAuthenticated, user?.role]);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  };

  const pendingQueue = accounts.filter((a) => a.stage === "human_agent_queue");
  const publishedAccounts = accounts.filter(
    (a) => a.stage === "published_to_client"
  );

  const activeAccount =
    accounts.find((a) => a.id === selectedAccountId) ||
    pendingQueue[0] ||
    accounts[0];

  const activeChannelName =
    workspaces.find((w) => w.id === activeAccount?.workspaceId)?.channelName ||
    workspaces[0]?.channelName;

  const persistAccountUpdate = async (
    updatedAccount: ProspectAccountRecord
  ) => {
    setIsBusy(true);
    try {
      await fetch("/api/os/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_account",
          account: updatedAccount,
        }),
      });
      await syncWorkflowFromDatabase();
      loadFromStore();
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddContactToAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount || !newName.trim() || !newTitle.trim()) return;

    const newContact: EnrichedContactPerson = {
      id: `hc-${Date.now()}`,
      role: newRole,
      name: newName.trim(),
      title: newTitle.trim(),
      location: activeAccount.location,
      email:
        newEmail.trim() ||
        `${newName.trim().toLowerCase().replace(/\s+/g, ".")}@${
          activeAccount.companyWebsite
        }`,
      phone: newPhone.trim() || activeAccount.companyNumber,
      linkedinUrl:
        newLinkedin.trim() ||
        `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
          newName + " " + activeAccount.inputCompanyName.split(" ")[0]
        )}`,
      verificationStatus: "✓ Direct verified",
      whyThisContact:
        newWhy.trim() ||
        `Human-verified ${newRole} for ${activeAccount.inputCompanyName}.`,
    };

    const updatedAccount: ProspectAccountRecord = {
      ...activeAccount,
      contacts: [...activeAccount.contacts, newContact],
      updatedAt: new Date().toISOString(),
    };

    await persistAccountUpdate(updatedAccount);
    setNewName("");
    setNewTitle("");
    setNewEmail("");
    setNewPhone("");
    setNewLinkedin("");
    setNewWhy("");
    showNotice(
      `Added & verified contact "${newContact.name}" (${newContact.role}) for ${activeAccount.inputCompanyName}.`
    );
  };

  const handleMarkContactVerified = async (contactId: string) => {
    if (!activeAccount) return;
    const updatedAccount: ProspectAccountRecord = {
      ...activeAccount,
      contacts: activeAccount.contacts.map((c) =>
        c.id === contactId
          ? { ...c, verificationStatus: "✓ Direct verified" as const }
          : c
      ),
      updatedAt: new Date().toISOString(),
    };
    await persistAccountUpdate(updatedAccount);
    showNotice("Marked contact as ✓ Direct verified by Humagent.");
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!activeAccount) return;
    const updatedAccount: ProspectAccountRecord = {
      ...activeAccount,
      contacts: activeAccount.contacts.filter((c) => c.id !== contactId),
      updatedAt: new Date().toISOString(),
    };
    await persistAccountUpdate(updatedAccount);
  };

  const handlePushToClientResult = async () => {
    if (!activeAccount) return;
    if (activeAccount.contacts.length < 3) {
      showNotice(
        "Guardrail: Please enrich at least 3 contacts for this account before pushing to Client Account Intelligence."
      );
      return;
    }

    const updatedAccount: ProspectAccountRecord = {
      ...activeAccount,
      stage: "published_to_client",
      segment: activeAccount.segment
        .replace("IN HUMAGENT QA", "QUALIFIED")
        .replace("IN HUMAN QA", "QUALIFIED"),
      deliveryDayLabel: activeAccount.deliveryDayLabel.replace(
        "Pending Humagent QA",
        "Human Verified"
      ),
      checkpointsCleared: `✓ 6 OF 6 CHECKPOINTS CLEARED · Human Verified · ${activeAccount.contacts.length} Decision-Makers Enriched`,
      updatedAt: new Date().toISOString(),
    };

    await persistAccountUpdate(updatedAccount);
    showNotice(
      `Pushed "${activeAccount.inputCompanyName}" (${activeAccount.contacts.length} verified contacts) to Client Account Intelligence & notified #Channel!`
    );
  };

  if (isLoading || !isAuthenticated || user?.role !== "humagent") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-slate-900">
        <div className="w-8 h-8 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin mb-3" />
        <span className="text-xs font-mono text-slate-500 tracking-widest uppercase">
          Verifying RevGen AI Humagent Authorization...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col text-left">
      {/* Top Human Agent Header — Strictly Humagent Portal Only */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <RevGenLogo className="w-7 h-7 text-emerald-600" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                RevGen AI
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-[10px] font-bold uppercase">
                HUMAGENT PORTAL · CONTACT ENRICHMENT &amp; ASSIGNED CHANNELS
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Verify Manually → Enrich ≥3 Decision-Makers per Account → Push to Client Result &amp; Collaborate in Assigned #Channels
            </div>
          </div>
        </div>

        {/* Right Controls: Assigned Channels Shortcut + Humagent Identity + Sign Out */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("assigned_channels")}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Hash className="w-3.5 h-3.5 text-emerald-600" />
            <span>Assigned Channels ({workspaces.length})</span>
            {activeChannelName && (
              <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                #{activeChannelName}
              </code>
            )}
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-bold text-slate-900">
              {user.fullName || user.email}
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold">
              HUMAGENT
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

        {/* Humagent Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab("qa_workbench")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "qa_workbench"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>
              1. Contact Enrichment &amp; QA Workbench ({pendingQueue.length} Pending)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("assigned_channels")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "assigned_channels"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Hash className="w-4 h-4" />
            <span>
              2. Assigned Workspace Channels ({workspaces.length} Allocated)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("run_review")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "run_review"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>3. Agent Run Review</span>
          </button>
        </div>

        {activeTab === "run_review" ? (
          <RunReviewQueue />
        ) : activeTab === "assigned_channels" ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-emerald-700 font-bold">
                HUMAGENT ASSIGNED CHANNELS · REAL-TIME CLIENT &amp; ADMIN COLLABORATION
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">
                Your Allocated Workspace Channels ({workspaces.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chat directly with your assigned Client workspaces under Admin supervision. Share Google Meet links, schedule appointments, share documents, and coordinate the ~5 sample cards (&lt;24h max) and ~35 monthly cards.
              </p>
            </div>

            <WorkspaceChannelHub
              role="humagent"
              currentUserEmail={user.email}
              currentUserName={user.fullName || user.email}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 4 Cols: Allocated Humagent Queue */}
            <div className="lg:col-span-4 space-y-5">
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-amber-800 font-extrabold">
                    PENDING HUMAGENT QA QUEUE ({pendingQueue.length})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-mono font-bold text-amber-800">
                    Requires ≥3 Contacts
                  </span>
                </div>

                {pendingQueue.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center space-y-2">
                    <Clock className="w-5 h-5 text-slate-400 mx-auto" />
                    <div>
                      No pending accounts awaiting QA in your allocated client workspaces.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingQueue.map((acc) => (
                      <div
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer space-y-1.5 ${
                          activeAccount?.id === acc.id
                            ? "border-emerald-600 bg-emerald-50/40"
                            : "border-slate-200 hover:border-slate-300 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900">
                            {acc.inputCompanyName}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                            {acc.contacts.length}/3+ Contacts
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {acc.companyWebsite} · {acc.location}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Already Published to Client Result */}
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="text-xs font-mono uppercase text-emerald-800 font-extrabold">
                  PUBLISHED TO CLIENT ACCOUNT INTELLIGENCE (
                  {publishedAccounts.length})
                </div>
                {publishedAccounts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                    No published accounts yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {publishedAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          activeAccount?.id === acc.id
                            ? "border-indigo-600 bg-indigo-50/40"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            #{acc.leadNumber} · {acc.inputCompanyName}
                          </div>
                          <div className="text-[10px] font-mono text-emerald-700 font-semibold">
                            ✓ {acc.contacts.length} Contacts ·{" "}
                            {acc.deliveryDayLabel}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold shrink-0">
                          LIVE
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 8 Cols: Active Account Manual Verification & Contact Enrichment Workbench */}
            <div className="lg:col-span-8 space-y-6">
              {!activeAccount ? (
                <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center space-y-2">
                  <UserCheck className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h2 className="text-base font-extrabold text-slate-900">
                    Humagent Verification Workbench
                  </h2>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    When the Admin allocates a client workspace to you and runs Agentic Prospecting, target accounts will appear here for manual contact enrichment (minimum 3 verified contacts per account).
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-xs font-bold">
                          LEAD #{activeAccount.leadNumber}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border ${
                            activeAccount.stage === "published_to_client"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}
                        >
                          {activeAccount.stage === "published_to_client"
                            ? "✓ Published to Client Account Intelligence"
                            : "Awaiting Humagent Push"}
                        </span>
                      </div>
                      <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                        {activeAccount.inputCompanyName}
                      </h2>
                      <div className="text-xs font-mono text-indigo-600">
                        {activeAccount.companyWebsite} ·{" "}
                        {activeAccount.campusAddress} ·{" "}
                        {activeAccount.employeeCount}
                      </div>
                    </div>

                    {/* Push to Client Result Button */}
                    <button
                      type="button"
                      onClick={handlePushToClientResult}
                      disabled={activeAccount.contacts.length < 3 || isBusy}
                      className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-extrabold flex items-center gap-2 shadow-md transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        Verify &amp; Push to Client Result (
                        {activeAccount.contacts.length}/3+ Contacts)
                      </span>
                    </button>
                  </div>

                  {/* Enriched Contacts Table (Must be >= 3) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono uppercase text-slate-700 font-extrabold">
                        DECISION-MAKER CONTACTS ({activeAccount.contacts.length}{" "}
                        ENRICHED · MINIMUM 3 REQUIRED)
                      </div>
                      {activeAccount.contacts.length >= 3 ? (
                        <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          ✓ Passes ≥3 Contacts Rule
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          Add {3 - activeAccount.contacts.length} More Contact(s)
                        </span>
                      )}
                    </div>

                    {activeAccount.contacts.length === 0 ? (
                      <div className="p-6 rounded-xl bg-amber-50/50 border border-amber-200 text-xs text-amber-900 text-center">
                        No contacts enriched yet. Use the form below to add at least 3 decision-maker contacts (Executive Sponsor, Economic Buyer, Champion).
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] uppercase text-slate-600">
                              <th className="p-3">Role</th>
                              <th className="p-3">Full Name &amp; Title</th>
                              <th className="p-3">Direct Email</th>
                              <th className="p-3">Phone</th>
                              <th className="p-3">LinkedIn</th>
                              <th className="p-3">Verification</th>
                              <th className="p-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {activeAccount.contacts.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50">
                                <td className="p-3 font-mono font-bold text-indigo-700">
                                  {c.role}
                                </td>
                                <td className="p-3">
                                  <div className="font-extrabold text-slate-900">
                                    {c.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {c.title}
                                  </div>
                                </td>
                                <td className="p-3 font-mono text-indigo-600">
                                  {c.email}
                                </td>
                                <td className="p-3 font-mono">{c.phone}</td>
                                <td className="p-3">
                                  <a
                                    href={c.linkedinUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline font-mono text-[11px] font-bold"
                                  >
                                    <span>Profile</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold">
                                    {c.verificationStatus}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-1.5">
                                    {c.verificationStatus !==
                                      "✓ Direct verified" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMarkContactVerified(c.id)
                                        }
                                        className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                                      >
                                        Verify ✓
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveContact(c.id)}
                                      className="p-1.5 rounded hover:bg-rose-50 text-rose-600 cursor-pointer"
                                      title="Remove Contact"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Add & Enrich Decision-Maker Form */}
                  <form
                    onSubmit={handleAddContactToAccount}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
                  >
                    <div className="text-xs font-mono uppercase text-emerald-800 font-extrabold">
                      ENRICH NEW DECISION-MAKER CONTACT (MANUAL HUMAN VERIFICATION)
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                          Buying Committee Role
                        </label>
                        <select
                          value={newRole}
                          onChange={(e) =>
                            setNewRole(
                              e.target.value as EnrichedContactPerson["role"]
                            )
                          }
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                        >
                          <option value="Executive Sponsor">
                            Executive Sponsor
                          </option>
                          <option value="Economic Buyer">Economic Buyer</option>
                          <option value="Champion">Champion</option>
                          <option value="Influencer">Influencer</option>
                          <option value="Procurement">Procurement</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Full name (spaces allowed)"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                          Job Title *
                        </label>
                        <input
                          type="text"
                          required
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="e.g. VP Operations / CHRO"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                          Verified Work Email
                        </label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder={`name@${activeAccount.companyWebsite}`}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                          Direct / Corporate Phone
                        </label>
                        <input
                          type="text"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="+91 ... / +1 ..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                          LinkedIn Profile URL
                        </label>
                        <input
                          type="text"
                          value={newLinkedin}
                          onChange={(e) => setNewLinkedin(e.target.value)}
                          placeholder="https://linkedin.com/in/..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                          Why Approach This Contact (Verification Note)
                        </label>
                        <input
                          type="text"
                          value={newWhy}
                          onChange={(e) => setNewWhy(e.target.value)}
                          placeholder="Owns vendor selection and operational budget for this location"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isBusy}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Verified Contact</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
