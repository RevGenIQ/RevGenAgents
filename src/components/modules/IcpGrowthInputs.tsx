"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Upload,
  Target,
  Shield,
  Clock,
  Calendar,
  Hash,
  Sliders,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  ClientIcpSubmission,
  DncEntry,
  getIcpSubmissionsStore,
  getWorkspacesStore,
  saveIcpSubmission,
} from "@/lib/store/osWorkflowStore";

interface IcpGrowthInputsProps {
  onStartResearchWithIcp: (icpData: any) => void;
  onOpenChannel?: () => void;
}

export function IcpGrowthInputs({
  onStartResearchWithIcp,
  onOpenChannel,
}: IcpGrowthInputsProps) {
  const { user } = useAuth();

  const [existingIcp, setExistingIcp] = useState<ClientIcpSubmission | null>(
    null
  );
  const [channelName, setChannelName] = useState<string>("RevGenAIxClient");

  // Clean, Standard-Styled ICP Form Fields (Zero hardcoded dummy text; loads saved ICP if upgrading)
  const [offering, setOffering] = useState("");
  const [businessGoal, setBusinessGoal] = useState("");
  const [targetIndustries, setTargetIndustries] = useState("");
  const [geographies, setGeographies] = useState("");
  const [employeeBand, setEmployeeBand] = useState("200 – 2,500 Employees");
  const [revenueBand, setRevenueBand] = useState("$10M – $250M Annual Revenue");
  const [buyerFunctions, setBuyerFunctions] = useState(
    "Operations, Executive Leadership, Technology, HR"
  );
  const [seniorityLevels, setSeniorityLevels] = useState(
    "CXO, VP, Director, Head"
  );
  const [requiredSignals, setRequiredSignals] = useState(
    "Active Hiring on Career Pages, Funding / Expansion, Leadership Change, Tech Stack Adoption"
  );
  const [signalWindowDays, setSignalWindowDays] = useState<number>(90);
  const [contactsPerAccount, setContactsPerAccount] = useState<number>(3);
  const [dncText, setDncText] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitBanner, setSubmitBanner] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const loadSavedIcp = () => {
      const wsList = getWorkspacesStore();
      const myWs =
        wsList.find((w) => w.id === user?.workspaceId) || wsList[0];
      if (myWs?.channelName) {
        setChannelName(myWs.channelName);
      }

      const icps = getIcpSubmissionsStore();
      const saved =
        icps.find((i) => i.workspaceId === (myWs?.id || user?.workspaceId)) ||
        icps[0];
      if (saved) {
        setExistingIcp(saved);
        setOffering((prev) => prev || saved.offering || "");
        setBusinessGoal((prev) => prev || saved.businessGoal || "");
        setTargetIndustries(
          (prev) => prev || (saved.targetIndustries || []).join(", ")
        );
        setGeographies((prev) => prev || (saved.geographies || []).join(", "));
        setEmployeeBand(
          (prev) =>
            prev || saved.employeeBands?.[0] || "200 – 2,500 Employees"
        );
        setRevenueBand(
          (prev) =>
            prev || saved.revenueBands?.[0] || "$10M – $250M Annual Revenue"
        );
        setBuyerFunctions(
          (prev) => prev || (saved.buyerFunctions || []).join(", ")
        );
        setSeniorityLevels(
          (prev) => prev || (saved.seniorityLevels || []).join(", ")
        );
        setRequiredSignals(
          (prev) => prev || (saved.requiredSignals || []).join(", ")
        );
        setSignalWindowDays(saved.signalWindowDays || 90);
        setContactsPerAccount(saved.contactsPerAccount || 3);
        if (saved.dncEntries?.length > 0) {
          setDncText(
            (prev) =>
              prev || saved.dncEntries.map((d) => d.domain).join(", ")
          );
        }
      }
    };

    loadSavedIcp();
    window.addEventListener("revgen-os-store-update", loadSavedIcp);
    return () =>
      window.removeEventListener("revgen-os-store-update", loadSavedIcp);
  }, [user?.workspaceId]);

  // Dynamic Approximate Market Sizing (Point #5: understandable approximate numbers)
  const approxEstimates = useMemo(() => {
    const indCount = targetIndustries
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean).length;
    const geoCount = geographies
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean).length;
    const sigCount = requiredSignals
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean).length;
    const dncCount = dncText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean).length;

    const baseUniverse =
      Math.max(1, indCount) * Math.max(1, geoCount) * 650 + 400;
    const signalQualified = Math.max(
      65,
      Math.round((baseUniverse * 0.14) / Math.max(1, sigCount * 0.45)) -
        dncCount
    );

    return {
      totalUniverse: `~${baseUniverse.toLocaleString()}`,
      signalMatchedPool: `~${signalQualified.toLocaleString()}`,
      sampleBatch: "~5 Verified Cards (<24h Max)",
      monthlyRollout: "~35 Verified Cards (1-Month Span)",
      totalDecisionMakers: `~${40 * Math.max(3, contactsPerAccount)}+ Direct Contacts`,
      dncExcluded: dncCount,
    };
  }, [
    targetIndustries,
    geographies,
    requiredSignals,
    dncText,
    contactsPerAccount,
  ]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = String(ev.target?.result || "");
      const parsed = raw
        .split(/[\r\n,]+/)
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(
          (item) =>
            item &&
            item.toLowerCase() !== "domain" &&
            item.toLowerCase() !== "company"
        );
      const existing = dncText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = Array.from(new Set([...existing, ...parsed])).join(", ");
      setDncText(merged);
    };
    reader.readAsText(file);
  };

  const handleSubmitOrUpgradeIcp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (
      !offering.trim() ||
      !targetIndustries.trim() ||
      !geographies.trim()
    ) {
      setFormError(
        "Please enter your Product/Service Offering, Target Industries, and Target Geographies."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedDnc: DncEntry[] = dncText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((item) => ({
          domain: item.includes(".")
            ? item.toLowerCase()
            : `${item.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
          companyName: item
            .replace(/\.(com|in|co\.in|io|org|net|ai)$/i, "")
            .toUpperCase(),
          location: geographies.split(",")[0]?.trim() || "Global",
          reason: "Client DNC / Existing Customer Exclusion",
        }));

      const submission: ClientIcpSubmission = {
        id: existingIcp?.id || `icp-${Date.now()}`,
        workspaceId: user?.workspaceId || "",
        companyName: user?.companyName || "Client Workspace",
        companyDomain: user?.companyDomain || "",
        submittedByEmail: user?.email || "",
        submittedAt: new Date().toISOString(),
        offering: offering.trim(),
        businessGoal:
          businessGoal.trim() ||
          "Acquire high-intent enterprise accounts with verified decision-makers",
        targetIndustries: targetIndustries
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        geographies: geographies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        employeeBands: [employeeBand],
        revenueBands: [revenueBand],
        buyerFunctions: buyerFunctions
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        seniorityLevels: seniorityLevels
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        contactLocations: geographies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        requiredSignals: requiredSignals
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        signalWindowDays: Number(signalWindowDays) || 90,
        desiredAccountVolume: 40,
        contactsPerAccount: Math.max(3, Number(contactsPerAccount) || 3),
        requiredChannels: [
          "Verified Work Email",
          "Direct / Corporate Phone",
          "LinkedIn Profile URL",
        ],
        deliveryCadence:
          "~5 Sample Cards (<24h Max) → ~35 Verified Cards Over 1 Month",
        dncEntries: parsedDnc,
        status: "Submitted to Admin",
      };

      await saveIcpSubmission(submission);
      setSubmitBanner(
        existingIcp
          ? "ICP Criteria Upgraded! Launching live ATLAS 10-Layer Search & notifying your Humagent and Admin in #" +
              channelName
          : "ICP Brief Confirmed! Launching live ATLAS 10-Layer Search (~5 Samples in <24h Max, ~35 Cards over 1 Month)..."
      );

      setTimeout(() => {
        onStartResearchWithIcp(submission);
      }, 600);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] text-xs text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:border-indigo-500 transition-colors";
  const labelClass =
    "block text-[11px] font-bold text-[var(--text)] mb-1.5 text-left";
  const helperClass = "text-[10px] text-[var(--text3)] mt-1 text-left";

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-left">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
              <Target className="w-3 h-3" /> Step 02 · ICP &amp; Growth Brief
            </span>
            {existingIcp && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" /> Active ICP · Upgradeable Anytime
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight">
            {existingIcp
              ? "Review or Upgrade Your Target ICP Criteria"
              : "Configure Your Ideal Customer Profile (ICP) & Exclusions"}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text2)] max-w-3xl leading-relaxed">
            Once submitted, the{" "}
            <strong>ATLAS Supervision Architecture &amp; L1–L10 Intelligence Pipeline</strong>{" "}
            immediately starts scanning. Your first{" "}
            <strong>~5 Verified Sample Cards arrive within ~24 hours max</strong>, followed by{" "}
            <strong>~35 Verified Account Cards across a 1-Month (30-Day) campaign window</strong>. You can upgrade this ICP at any time after discussing in{" "}
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              #{channelName}
            </span>
            .
          </p>
        </div>

        {onOpenChannel && (
          <button
            type="button"
            onClick={onOpenChannel}
            className="px-4 py-2.5 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Hash className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Discuss ICP in #{channelName}</span>
          </button>
        )}
      </div>

      {submitBanner && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{submitBanner}</span>
        </div>
      )}

      {formError && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Standard-Styled Guided ICP Form */}
        <form
          onSubmit={handleSubmitOrUpgradeIcp}
          className="lg:col-span-8 space-y-6"
        >
          {/* Card 1: Offering & Target Firmographics */}
          <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 space-y-4 shadow-2xs">
            <div className="border-b border-[var(--line2)] pb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
                SECTION 1 · OFFERING &amp; TARGET FIRMOGRAPHICS
              </span>
              <h2 className="text-base font-extrabold text-[var(--text)] mt-0.5">
                What You Offer &amp; Which Companies We Should Target
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Your Product / Service Offering *
                </label>
                <input
                  type="text"
                  required
                  value={offering}
                  onChange={(e) => setOffering(e.target.value)}
                  placeholder="e.g. Enterprise Cafeteria Management / Cloud FinOps / BPO"
                  className={inputClass}
                />
                <p className={helperClass}>
                  Used by ATLAS to match why an account needs your offering now.
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  Primary Campaign Business Goal
                </label>
                <input
                  type="text"
                  value={businessGoal}
                  onChange={(e) => setBusinessGoal(e.target.value)}
                  placeholder="e.g. Book discovery calls with expanding multi-site enterprises"
                  className={inputClass}
                />
                <p className={helperClass}>
                  Helps calibrate outreach openers and Humagent verification.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Target Industries (Comma-Separated) *
                </label>
                <input
                  type="text"
                  required
                  value={targetIndustries}
                  onChange={(e) => setTargetIndustries(e.target.value)}
                  placeholder="e.g. IT Services, Manufacturing, BFSI, Pharma"
                  className={inputClass}
                />
                <p className={helperClass}>
                  Separate multiple industries with commas.
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  Target Geographies / Cities (Comma-Separated) *
                </label>
                <input
                  type="text"
                  required
                  value={geographies}
                  onChange={(e) => setGeographies(e.target.value)}
                  placeholder="e.g. Bengaluru, Mumbai, Hyderabad, NCR, United States"
                  className={inputClass}
                />
                <p className={helperClass}>
                  HQ or operational locations where target accounts operate.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Target Employee Size Band (~Approximate)
                </label>
                <select
                  value={employeeBand}
                  onChange={(e) => setEmployeeBand(e.target.value)}
                  className={inputClass}
                >
                  <option value="50 – 200 Employees">
                    ~50 – 200 Employees (Mid-Market Growth)
                  </option>
                  <option value="200 – 2,500 Employees">
                    ~200 – 2,500 Employees (Mid-to-Large Enterprise)
                  </option>
                  <option value="2,500 – 10,000+ Employees">
                    ~2,500 – 10,000+ Employees (Large Enterprise)
                  </option>
                  <option value="All Enterprise Bands (100+ Employees)">
                    ~100+ Employees (All Qualified B2B Bands)
                  </option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Target Annual Revenue Band (~Approximate)
                </label>
                <select
                  value={revenueBand}
                  onChange={(e) => setRevenueBand(e.target.value)}
                  className={inputClass}
                >
                  <option value="$5M – $50M Annual Revenue">
                    ~$5M – $50M Annual Revenue
                  </option>
                  <option value="$10M – $250M Annual Revenue">
                    ~$10M – $250M Annual Revenue
                  </option>
                  <option value="$250M – $1B+ Annual Revenue">
                    ~$250M – $1B+ Annual Revenue
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Buyer Personas & Buying Signals */}
          <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 space-y-4 shadow-2xs">
            <div className="border-b border-[var(--line2)] pb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                SECTION 2 · DECISION-MAKERS &amp; BUYING SIGNALS (L1–L10)
              </span>
              <h2 className="text-base font-extrabold text-[var(--text)] mt-0.5">
                Who We Should Enrich (~3+ Contacts/Account) &amp; What Signals Trigger Delivery
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Target Buyer Departments / Functions
                </label>
                <input
                  type="text"
                  value={buyerFunctions}
                  onChange={(e) => setBuyerFunctions(e.target.value)}
                  placeholder="Operations, Administration, HR, IT, Procurement"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Target Seniority Levels
                </label>
                <input
                  type="text"
                  value={seniorityLevels}
                  onChange={(e) => setSeniorityLevels(e.target.value)}
                  placeholder="CXO, VP, Director, Plant / Campus Head"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Required Buying Signals (Scanned Across L1–L10 Engines)
              </label>
              <input
                type="text"
                value={requiredSignals}
                onChange={(e) => setRequiredSignals(e.target.value)}
                placeholder="e.g. New Office/Plant Expansion, Hiring Spikes, Series B+ Funding, Leadership Change"
                className={inputClass}
              />
              <p className={helperClass}>
                Verified via Brave Search API, Google Career Pages, Tavily Investments, News Crawler, and LinkedIn Posts.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Signal Recency Window
                </label>
                <select
                  value={signalWindowDays}
                  onChange={(e) => setSignalWindowDays(Number(e.target.value))}
                  className={inputClass}
                >
                  <option value={30}>Last ~30 Days (Ultra-Recent Intent)</option>
                  <option value={90}>Last ~90 Days (Standard Quarter Window)</option>
                  <option value={180}>Last ~180 Days (6-Month Strategic Window)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Verified Decision-Makers Per Account
                </label>
                <select
                  value={contactsPerAccount}
                  onChange={(e) =>
                    setContactsPerAccount(Number(e.target.value))
                  }
                  className={inputClass}
                >
                  <option value={3}>
                    ~3 Verified Contacts / Account (Sponsor, Buyer, Champion)
                  </option>
                  <option value={4}>
                    ~4 Verified Contacts / Account
                  </option>
                  <option value={5}>
                    ~5 Verified Contacts / Account
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 3: DNC Exclusions (Comma-Separated or CSV Upload) */}
          <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line2)] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">
                  SECTION 3 · DO-NOT-CONTACT (DNC) &amp; EXISTING CUSTOMER EXCLUSIONS
                </span>
                <h2 className="text-base font-extrabold text-[var(--text)] mt-0.5">
                  Exclude Competitors &amp; Existing Customers Early
                </h2>
              </div>

              <label className="px-3 py-1.5 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] border border-[var(--line2)] text-xs font-bold text-[var(--text)] flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Upload DNC CSV</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsvUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className={labelClass}>
                Excluded Company Domains or Names (Comma-Separated)
              </label>
              <textarea
                rows={3}
                value={dncText}
                onChange={(e) => setDncText(e.target.value)}
                placeholder="e.g. competitor1.com, existingclient.com, acmecorp.in"
                className={inputClass}
              />
              <p className={helperClass}>
                ATLAS Sentinel automatically blocks these domains before spending research or human verification time.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[var(--text2)]">
                Submitting immediately activates{" "}
                <strong>ATLAS Supervision &amp; L1–L10 Live Search</strong> and notifies your Humagent in{" "}
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  #{channelName}
                </span>
                .
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  {existingIcp
                    ? "Upgrade ICP & Re-Calibrate ATLAS Search"
                    : "Submit ICP & Launch ATLAS L1–L10 Search"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {/* Right 4 Cols: Approximate Market Sizing & 1-Month Delivery SLA Blueprint */}
        <div className="lg:col-span-4 space-y-5">
          {/* Approximate Pool Card */}
          <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 space-y-4 shadow-2xs">
            <div className="border-b border-[var(--line2)] pb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
                LIVE APPROXIMATE PROJECTION (~ESTIMATE)
              </span>
              <h3 className="text-base font-extrabold text-[var(--text)] mt-0.5">
                Estimated Funnel &amp; Delivery Output
              </h3>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase text-[var(--text3)] font-bold">
                    1. ADDRESSABLE UNIVERSE
                  </div>
                  <div className="text-xs text-[var(--text2)]">
                    Matching industry &amp; geography
                  </div>
                </div>
                <div className="text-lg font-extrabold text-[var(--text)] font-mono">
                  {approxEstimates.totalUniverse}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase text-[var(--text3)] font-bold">
                    2. SIGNAL-QUALIFIED CANDIDATES
                  </div>
                  <div className="text-xs text-[var(--text2)]">
                    Active buying triggers ({approxEstimates.dncExcluded} DNC excluded)
                  </div>
                </div>
                <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  {approxEstimates.signalMatchedPool}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-indigo-600 dark:text-indigo-400 font-bold">
                    3. INITIAL CALIBRATION SAMPLE
                  </span>
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-sm font-extrabold text-[var(--text)]">
                  {approxEstimates.sampleBatch}
                </div>
                <p className="text-[11px] text-[var(--text2)]">
                  Delivered within <strong>~24 hours max</strong> for your feedback in #{channelName}.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-emerald-700 dark:text-emerald-300 font-bold">
                    4. 1-MONTH PRODUCTION ROLLOUT
                  </span>
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-sm font-extrabold text-[var(--text)]">
                  {approxEstimates.monthlyRollout}
                </div>
                <p className="text-[11px] text-[var(--text2)]">
                  Steady cadence (~1–2 cards/day) totaling{" "}
                  <strong>{approxEstimates.totalDecisionMakers}</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* 30-Day Interactive Collaboration Promise */}
          <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] uppercase font-bold">
              <Shield className="w-4 h-4" />
              <span>Continuous 1-Month Supervision</span>
            </div>
            <h3 className="text-sm font-extrabold text-[var(--text)]">
              Upgrade ICP &amp; Coordinate in #{channelName}
            </h3>
            <p className="text-xs text-[var(--text2)] leading-relaxed">
              Throughout your 1-month (~35-card) delivery cycle, all sample reviews, ICP adjustments, Google Meet check-ins, commercial negotiations, and payment/payout milestones happen directly in your dedicated{" "}
              <strong className="font-mono text-[var(--text)]">
                #{channelName}
              </strong>{" "}
              workspace channel with your Humagent and Admin.
            </p>
            {onOpenChannel && (
              <button
                type="button"
                onClick={onOpenChannel}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Hash className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Open #{channelName} Channel</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
