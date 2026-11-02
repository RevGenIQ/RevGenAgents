"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Download,
  FileText,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Search,
  Building2,
  Users,
  Sparkles,
  Printer,
  Hash,
  Sliders,
  LayoutGrid,
  Table as TableIcon,
  Clock,
  Calendar,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import {
  ProspectAccountRecord,
  getProspectAccountsStore,
  getWorkspacesStore,
  updateProspectAccount,
} from "@/lib/store/osWorkflowStore";

interface AccountsContactsProps {
  workspaceId: string;
  onOpenDossier?: (companyName: string) => void;
  onOpenChannel?: () => void;
  onUpgradeIcp?: () => void;
}

export function AccountsContacts({
  workspaceId,
  onOpenChannel,
  onUpgradeIcp,
}: AccountsContactsProps) {
  const [accounts, setAccounts] = useState<ProspectAccountRecord[]>([]);
  const [channelName, setChannelName] = useState<string>("RevGenAIxClient");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "sample" | "daily" | "reviewed"
  >("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const loadAccounts = () => {
    const wsList = getWorkspacesStore();
    const myWs = wsList.find((w) => w.id === workspaceId) || wsList[0];
    if (myWs?.channelName) {
      setChannelName(myWs.channelName);
    }

    const all = getProspectAccountsStore();
    const published = all.filter(
      (a) =>
        (!workspaceId || a.workspaceId === workspaceId) &&
        a.stage === "published_to_client"
    );
    setAccounts(published);
  };

  useEffect(() => {
    loadAccounts();
    window.addEventListener("revgen-os-store-update", loadAccounts);
    return () =>
      window.removeEventListener("revgen-os-store-update", loadAccounts);
  }, [workspaceId]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (activeFilter === "sample" && acc.deliveryType !== "sample")
        return false;
      if (activeFilter === "daily" && acc.deliveryType !== "daily")
        return false;
      if (activeFilter === "reviewed" && !acc.reviewedByClient) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          acc.inputCompanyName.toLowerCase().includes(q) ||
          acc.companyWebsite.toLowerCase().includes(q) ||
          acc.location.toLowerCase().includes(q) ||
          acc.companyIndustry.toLowerCase().includes(q) ||
          acc.recentBuyingSignalHeadline.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [accounts, activeFilter, searchQuery]);

  const toggleSelectAccount = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAccounts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAccounts.map((a) => a.id));
    }
  };

  const handleToggleReviewed = (acc: ProspectAccountRecord) => {
    const updated: ProspectAccountRecord = {
      ...acc,
      reviewedByClient: !acc.reviewedByClient,
      updatedAt: new Date().toISOString(),
    };
    updateProspectAccount(updated);
    loadAccounts();
  };

  const handleClientFeedback = (
    acc: ProspectAccountRecord,
    feedback: "Relevant" | "Needs Correction" | "Not Relevant"
  ) => {
    const updated: ProspectAccountRecord = {
      ...acc,
      clientFeedback: feedback,
      reviewedByClient: true,
      updatedAt: new Date().toISOString(),
    };
    updateProspectAccount(updated);
    loadAccounts();
    if (feedback === "Needs Correction" && onOpenChannel) {
      onOpenChannel();
    }
  };

  // Selected Bulk Download CSV
  const handleBulkExportCsv = () => {
    const targetList =
      selectedIds.length > 0
        ? accounts.filter((a) => selectedIds.includes(a.id))
        : filteredAccounts;

    if (targetList.length === 0) return;

    const headers = [
      "Lead Number",
      "Delivery Batch",
      "Company Name",
      "Website",
      "Industry",
      "Location",
      "Employees",
      "Revenue",
      "Priority",
      "ICP Fit Score",
      "Intent Score",
      "Buying Signal Headline",
      "Recommended Opener",
      "Contact 1 Name",
      "Contact 1 Title",
      "Contact 1 Email",
      "Contact 1 Phone",
      "Contact 1 LinkedIn",
      "Contact 2 Name",
      "Contact 2 Title",
      "Contact 2 Email",
      "Contact 3 Name",
      "Contact 3 Title",
      "Contact 3 Email",
    ];

    const rows = targetList.map((acc) => {
      const c1 = acc.contacts[0];
      const c2 = acc.contacts[1];
      const c3 = acc.contacts[2];
      return [
        acc.leadNumber,
        acc.deliveryType === "sample" ? "Sample Batch" : "Monthly Rollout",
        acc.inputCompanyName,
        acc.companyWebsite,
        acc.companyIndustry,
        acc.location,
        acc.employeeCount,
        acc.companyRevenue,
        acc.priority,
        acc.scoring.icpFitScore,
        acc.scoring.intentScore,
        acc.recentBuyingSignalHeadline,
        acc.recommendedOpener,
        c1?.name || "",
        c1?.title || "",
        c1?.email || "",
        c1?.phone || "",
        c1?.linkedinUrl || "",
        c2?.name || "",
        c2?.title || "",
        c2?.email || "",
        c3?.name || "",
        c3?.title || "",
        c3?.email || "",
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RevGenAI-Verified-Accounts-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    targetList.forEach((acc) => {
      updateProspectAccount({
        ...acc,
        exportedByClient: true,
        updatedAt: new Date().toISOString(),
      });
    });
    loadAccounts();
    setExportToast(
      `Exported ${targetList.length} verified account(s) to CSV.`
    );
    setTimeout(() => setExportToast(null), 4000);
  };

  // Printable Executive PDF Brief
  const handleExportPdfBrief = (singleAccount?: ProspectAccountRecord) => {
    const targetList = singleAccount
      ? [singleAccount]
      : selectedIds.length > 0
      ? accounts.filter((a) => selectedIds.includes(a.id))
      : filteredAccounts;

    targetList.forEach((acc) => {
      updateProspectAccount({
        ...acc,
        exportedByClient: true,
        updatedAt: new Date().toISOString(),
      });
    });
    loadAccounts();
    setExportToast(
      `Prepared Executive PDF Dossier for ${targetList.length} account(s).`
    );
    setTimeout(() => {
      window.print();
      setExportToast(null);
    }, 300);
  };

  const sampleCount = accounts.filter((a) => a.deliveryType === "sample").length;
  const monthlyCount = accounts.filter((a) => a.deliveryType === "daily").length;
  const totalContactsCount = accounts.reduce(
    (sum, a) => sum + (a.contacts?.length || 0),
    0
  );

  return (
    <div className="space-y-6 pb-14 max-w-7xl mx-auto text-left">
      {/* ════════════════ EXECUTIVE HEADER & CAMPAIGN DELIVERY TRACKER ════════════════ */}
      <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--line2)]">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>REVGEN AI · ACCOUNT INTELLIGENCE &amp; VERIFIED DOSSIERS</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight">
              Human-Verified Target Accounts &amp; Decision-Makers
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text2)] max-w-3xl leading-relaxed">
              Every delivered card is enriched across <strong>L1–L10</strong> and verified by your assigned{" "}
              <strong>Humagent</strong> with <strong>~3+ direct decision-makers</strong>. Review your initial{" "}
              <strong>~5 Sample Cards (&lt;24h SLA)</strong> and ongoing{" "}
              <strong>~35 Monthly Cards (1-Month Span)</strong>, or coordinate adjustments directly in{" "}
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                #{channelName}
              </span>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onUpgradeIcp && (
              <button
                type="button"
                onClick={onUpgradeIcp}
                className="px-3.5 py-2 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Upgrade ICP</span>
              </button>
            )}

            {onOpenChannel && (
              <button
                type="button"
                onClick={onOpenChannel}
                className="px-3.5 py-2 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Hash className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Discuss in #{channelName}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleBulkExportCsv}
              disabled={filteredAccounts.length === 0}
              className="px-3.5 py-2 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] disabled:opacity-50 text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>
                Export CSV (
                {selectedIds.length > 0
                  ? `${selectedIds.length} Selected`
                  : `All ${filteredAccounts.length}`}
                )
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleExportPdfBrief()}
              disabled={filteredAccounts.length === 0}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export Executive PDF</span>
            </button>
          </div>
        </div>

        {/* 3 Clean Progress Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--text3)] font-bold">
                PHASE 1 · SAMPLE CALIBRATION (&lt;24H MAX)
              </div>
              <div className="text-lg font-extrabold text-[var(--text)] mt-0.5">
                {sampleCount}{" "}
                <span className="text-xs font-normal text-[var(--text2)]">
                  of ~5 Sample Cards Delivered
                </span>
              </div>
            </div>
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--text3)] font-bold">
                PHASE 2 · 1-MONTH PRODUCTION ROLLOUT
              </div>
              <div className="text-lg font-extrabold text-[var(--text)] mt-0.5">
                {monthlyCount}{" "}
                <span className="text-xs font-normal text-[var(--text2)]">
                  of ~35 Monthly Cards Delivered
                </span>
              </div>
            </div>
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--text3)] font-bold">
                HUMAN-VERIFIED DECISION MAKERS
              </div>
              <div className="text-lg font-extrabold text-[var(--text)] mt-0.5">
                {totalContactsCount}{" "}
                <span className="text-xs font-normal text-[var(--text2)]">
                  Verified Contacts (~3+ / Account)
                </span>
              </div>
            </div>
            <Users className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
          </div>
        </div>

        {exportToast && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportToast}</span>
          </div>
        )}

        {/* Filter, Search & View Mode Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold cursor-pointer"
            >
              {selectedIds.length === filteredAccounts.length &&
              filteredAccounts.length > 0
                ? "Deselect All"
                : "Select All"}
            </button>

            {(
              [
                { id: "all", label: `All Delivered (${accounts.length})` },
                {
                  id: "sample",
                  label: `~5 Sample Batch (${sampleCount})`,
                },
                {
                  id: "daily",
                  label: `~35 Monthly Rollout (${monthlyCount})`,
                },
                {
                  id: "reviewed",
                  label: `Reviewed (${
                    accounts.filter((a) => a.reviewedByClient).length
                  })`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-[var(--bg3)] text-[var(--text2)] border border-[var(--line2)] hover:text-[var(--text)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-[var(--text3)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by company, domain, city, signal..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] text-xs text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center rounded-xl bg-[var(--bg3)] border border-[var(--line2)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-indigo-600 text-white"
                    : "text-[var(--text2)] hover:text-[var(--text)]"
                }`}
                title="Executive Dossier Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  viewMode === "table"
                    ? "bg-indigo-600 text-white"
                    : "text-[var(--text2)] hover:text-[var(--text)]"
                }`}
                title="Compact Intelligence Table"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════ EMPTY STATE WHEN AWAITING HUMAGENT QA ════════════════ */}
      {filteredAccounts.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-12 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-lg font-extrabold text-[var(--text)]">
              ATLAS &amp; Humagent QA in Progress (~24h Max Sample Window)
            </h2>
            <p className="text-xs text-[var(--text2)] leading-relaxed">
              Your target accounts are being discovered across Layers L1–L10 and verified by your allocated{" "}
              <strong>Humagent</strong> (enriching ≥3 direct decision-maker contacts per company). As soon as each account passes QA, its full Dossier Card appears here.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onOpenChannel && (
              <button
                type="button"
                onClick={onOpenChannel}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Hash className="w-3.5 h-3.5" />
                <span>Check Status in #{channelName}</span>
              </button>
            )}
            {onUpgradeIcp && (
              <button
                type="button"
                onClick={onUpgradeIcp}
                className="px-4 py-2.5 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Review / Upgrade ICP Brief</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === "table" ? (
        /* ════════════════ COMPACT INTELLIGENCE TABLE VIEW ════════════════ */
        <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--line2)] bg-[var(--bg3)] text-[10px] font-mono uppercase text-[var(--text3)]">
                  <th className="py-3 px-4">Select</th>
                  <th className="py-3 px-4">Company &amp; Domain</th>
                  <th className="py-3 px-4">Industry &amp; Size</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Verified Buying Signal</th>
                  <th className="py-3 px-4">Scores</th>
                  <th className="py-3 px-4">Verified Contacts</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line2)]">
                {filteredAccounts.map((acc) => {
                  const isSel = selectedIds.includes(acc.id);
                  return (
                    <tr
                      key={acc.id}
                      className="hover:bg-[var(--bg3)]/60 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelectAccount(acc.id)}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-[var(--text)]">
                          {acc.inputCompanyName}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                          <a
                            href={`https://${acc.companyWebsite}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {acc.companyWebsite}
                          </a>
                          {acc.companyLinkedinUrl && (
                            <a
                              href={acc.companyLinkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10"
                            >
                              in
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--text)]">
                          {acc.companyIndustry}
                        </div>
                        <div className="text-[11px] text-[var(--text2)]">
                          {acc.employeeCount} · {acc.companyRevenue}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text2)]">
                        {acc.location}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-[var(--text)] truncate">
                          {acc.recentBuyingSignalHeadline}
                        </div>
                        <div className="text-[11px] text-[var(--text2)] line-clamp-1">
                          {acc.recentBuyingSignalBody}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                          Fit {acc.scoring.icpFitScore}
                        </span>{" "}
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                          Intent {acc.scoring.intentScore}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[var(--text)]">
                          {acc.contacts.length} Contacts
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleReviewed(acc)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            acc.reviewedByClient
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-[var(--bg3)] text-[var(--text2)] border border-[var(--line2)]"
                          }`}
                        >
                          {acc.reviewedByClient ? "✓ Reviewed" : "Mark Reviewed"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ════════════════ EXECUTIVE DOSSIER CARDS VIEW (CLEAN, BRANDED, CONSISTENT) ════════════════ */
        <div className="space-y-5">
          {filteredAccounts.map((acc) => {
            const isSelected = selectedIds.includes(acc.id);
            return (
              <div
                key={acc.id}
                className={`rounded-2xl bg-[var(--bg2)] border transition-all overflow-hidden shadow-xs ${
                  isSelected
                    ? "border-indigo-600 ring-2 ring-indigo-500/20"
                    : "border-[var(--line2)]"
                }`}
              >
                {/* 1. Card Top Bar: Identity, Domain, Delivery Batch, Scores */}
                <div className="px-6 py-4 bg-[var(--bg3)] border-b border-[var(--line2)] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectAccount(acc.id)}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                    />

                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-mono text-xs font-extrabold flex items-center justify-center shrink-0 shadow-2xs">
                      {acc.companyLogo ||
                        acc.inputCompanyName.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                          #{acc.leadNumber}
                        </span>
                        <h2 className="text-base font-extrabold text-[var(--text)] truncate">
                          {acc.inputCompanyName}
                        </h2>
                        <a
                          href={`https://${acc.companyWebsite}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <span>{acc.companyWebsite}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {acc.companyLinkedinUrl && (
                          <a
                            href={acc.companyLinkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded bg-[#0A66C2]/15 text-[#0A66C2] dark:text-sky-300 font-mono text-[10px] font-bold hover:bg-[#0A66C2]/25"
                          >
                            LinkedIn ↗
                          </a>
                        )}
                      </div>

                      <div className="text-xs text-[var(--text2)] flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5">
                        <span>{acc.companyIndustry}</span>
                        <span>·</span>
                        <span>{acc.location}</span>
                        <span>·</span>
                        <span>{acc.employeeCount}</span>
                        {acc.companyRevenue && (
                          <>
                            <span>·</span>
                            <span>{acc.companyRevenue}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Badges: Batch Type & Fit/Intent Scores */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase border ${
                        acc.deliveryType === "sample"
                          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                      }`}
                    >
                      {acc.deliveryDayLabel ||
                        (acc.deliveryType === "sample"
                          ? "Sample Batch (<24h)"
                          : "Monthly Rollout")}
                    </span>

                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--bg2)] border border-[var(--line2)] font-mono text-xs">
                      <span className="text-[var(--text2)]">ICP Fit:</span>
                      <strong className="text-indigo-600 dark:text-indigo-400">
                        {acc.scoring.icpFitScore}%
                      </strong>
                      <span className="text-[var(--line2)]">|</span>
                      <span className="text-[var(--text2)]">Intent:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {acc.scoring.intentScore}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 2. Core 2-Column Executive Brief: (Left) Why This Company & Why Now + Evidence | (Right) Verified Decision-Makers */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left 6 Cols: Why This Account, Buying Signal, Recommended Opener & Source Citations */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
                          WHY THIS COMPANY &amp; WHY NOW (VERIFIED SIGNAL)
                        </span>
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {acc.priority}
                        </span>
                      </div>
                      <div className="text-xs font-extrabold text-[var(--text)]">
                        {acc.recentBuyingSignalHeadline}
                      </div>
                      <p className="text-xs text-[var(--text2)] leading-relaxed">
                        {acc.recentBuyingSignalBody || acc.companyDescription}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] space-y-2">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                        CALIBRATED OUTREACH OPENER &amp; PAIN HYPOTHESIS
                      </div>
                      {acc.potentialPainPoint && (
                        <p className="text-xs text-[var(--text2)]">
                          <strong className="text-[var(--text)]">
                            Operational Context:
                          </strong>{" "}
                          {acc.potentialPainPoint}
                        </p>
                      )}
                      <p className="text-xs text-[var(--text)] italic bg-[var(--bg2)] p-3 rounded-lg border border-[var(--line2)]">
                        &ldquo;{acc.recommendedOpener}&rdquo;
                      </p>
                    </div>

                    {/* Evidence Citations */}
                    {acc.evidenceLinks && acc.evidenceLinks.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono uppercase text-[var(--text3)] font-bold">
                          SUPPORTING EVIDENCE &amp; SOURCE LINKS ({acc.evidenceLinks.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {acc.evidenceLinks.map((ev) => (
                            <a
                              key={ev.ref + ev.url}
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg3)] hover:bg-indigo-500/10 border border-[var(--line2)] hover:border-indigo-500/30 text-[11px] text-[var(--text)] transition-colors"
                            >
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {ev.ref}
                              </span>
                              <span className="truncate max-w-[220px]">
                                {ev.title}
                              </span>
                              <ExternalLink className="w-3 h-3 text-[var(--text3)] shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right 6 Cols: Human-Verified Decision-Maker Contacts (~3+ per Account) */}
                  <div className="lg:col-span-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text3)] font-bold">
                        HUMAGENT-VERIFIED DECISION MAKERS ({acc.contacts.length})
                      </span>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        ✓ Direct Email, Phone &amp; LinkedIn Checked
                      </span>
                    </div>

                    {acc.contacts.length === 0 ? (
                      <div className="p-6 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] text-xs text-[var(--text2)] text-center">
                        Decision-maker contacts are being finalized by your assigned Humagent.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {acc.contacts.map((c) => (
                          <div
                            key={c.id}
                            className="p-3.5 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-extrabold text-[var(--text)]">
                                  {c.name}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
                                  {c.role}
                                </span>
                              </div>
                              <div className="text-xs text-[var(--text2)] truncate">
                                {c.title}{" "}
                                {c.location ? `· ${c.location}` : ""}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              {c.email && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(c.email);
                                    setCopiedEmail(c.id);
                                    setTimeout(() => setCopiedEmail(null), 2000);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[var(--bg2)] hover:bg-indigo-500/10 border border-[var(--line2)] text-[11px] font-mono text-[var(--text)] flex items-center gap-1.5 cursor-pointer"
                                  title="Click to copy verified email"
                                >
                                  <Mail className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                  <span>{c.email}</span>
                                  {copiedEmail === c.id ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-[var(--text3)]" />
                                  )}
                                </button>
                              )}

                              {c.phone && (
                                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg2)] border border-[var(--line2)] text-[11px] font-mono text-[var(--text2)] flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-emerald-600" />
                                  <span>{c.phone}</span>
                                </span>
                              )}

                              {c.linkedinUrl && (
                                <a
                                  href={c.linkedinUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 rounded-lg bg-[#0A66C2]/15 hover:bg-[#0A66C2]/25 text-[#0A66C2] dark:text-sky-300 font-mono text-[11px] font-bold flex items-center gap-1"
                                >
                                  <span>in</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Card Footer: Client Feedback, Review Checkmark & Single-Card PDF Export */}
                <div className="px-6 py-3 bg-[var(--bg3)] border-t border-[var(--line2)] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono uppercase text-[var(--text3)] font-bold">
                      SAMPLE / CARD FEEDBACK:
                    </span>
                    {(
                      ["Relevant", "Needs Correction", "Not Relevant"] as const
                    ).map((fb) => (
                      <button
                        key={fb}
                        type="button"
                        onClick={() => handleClientFeedback(acc, fb)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          acc.clientFeedback === fb
                            ? fb === "Relevant"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : fb === "Needs Correction"
                              ? "bg-amber-500 text-slate-950 border-amber-500"
                              : "bg-rose-600 text-white border-rose-600"
                            : "bg-[var(--bg2)] text-[var(--text2)] border-[var(--line2)] hover:text-[var(--text)]"
                        }`}
                      >
                        {fb}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleReviewed(acc)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        acc.reviewedByClient
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : "bg-[var(--bg2)] text-[var(--text2)] border-[var(--line2)]"
                      }`}
                    >
                      {acc.reviewedByClient ? "✓ Reviewed" : "Mark Reviewed"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportPdfBrief(acc)}
                      className="px-3 py-1 rounded-lg bg-[var(--bg2)] hover:bg-indigo-500/10 text-[var(--text)] border border-[var(--line2)] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Dossier PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
