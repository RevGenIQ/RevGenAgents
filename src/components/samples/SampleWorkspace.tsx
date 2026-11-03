"use client";

import React, { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Download, Sparkles } from "lucide-react";
import { accountsToCsv } from "@/lib/accounts/csv";
import type { RunAccount } from "@/lib/accounts/runAccount";
import { AccountCard } from "./AccountCard";
import { PlanPanel } from "./PlanPanel";
import { ResearchGrid } from "./ResearchGrid";
import { SampleIcpForm } from "./SampleIcpForm";
import { useSampleState } from "./useSampleState";

interface SampleWorkspaceProps {
  workspaceId: string;
  onOpenChannel: () => void;
  /** Slot for the enrichment request control (rendered under the results). */
  enrichmentSlot?: (accounts: RunAccount[]) => React.ReactNode;
}

const SAMPLE_SIZE = 5;

const WHAT_YOU_GET = [
  ["Matched to your ICP", "Companies in your industries, regions and size range."],
  ["Firmographics with sources", "Size, HQ, funding, tech stack, industry codes. Every value links to where we found it."],
  ["Live buying signals", "Hiring, funding, news and social activity, each dated and linked."],
  ["Why fit, what to pitch", "A short, evidence-based angle for each account."],
];

function downloadCsv(accounts: RunAccount[], signals: string[]) {
  const csv = accountsToCsv(accounts, { requiredSignals: signals, includeContacts: false });
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `revgeniq-sample-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Claim({ onClaim }: { onClaim: () => void }) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
      <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Step 1 of 3 · Free</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Claim your 5 free sample accounts</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Tell us who you sell to. Our research agent then finds 5 matching companies and researches each one in front of you.
        This is a one-time run, so you can judge the quality before you commit.
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {WHAT_YOU_GET.map(([title, body]) => (
          <div key={title} className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <dt className="text-sm font-medium text-slate-900 dark:text-white">{title}</dt>
            <dd className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{body}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={onClaim}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white">
        Claim my free samples <ArrowRight className="w-4 h-4" />
      </button>
    </section>
  );
}

function RunHeader({ step, percent }: { step: string; percent: number }) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Step 3 of 3 · Researching live</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Your agent is researching {SAMPLE_SIZE} accounts</h2>
        </div>
        <span className="text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">{percent}%</span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-700" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400" aria-live="polite">{step}</p>
    </section>
  );
}

/** The client's free-sample journey: claim, describe the ICP, watch the research, review and download. */
export function SampleWorkspace({ workspaceId, onOpenChannel, enrichmentSlot }: SampleWorkspaceProps) {
  const { state, error, refresh } = useSampleState();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const signals = useMemo(
    () => (Array.isArray(state?.icpBrief?.requiredSignals) ? (state?.icpBrief?.requiredSignals as string[]) : []),
    [state?.icpBrief]
  );

  if (!state) {
    return error ? (
      <div role="alert" className="flex gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertCircle className="w-4 h-4 mt-0.5" /> {error}</div>
    ) : (
      <div className="space-y-3" aria-busy="true">
        <div className="cell-shimmer h-40 rounded-xl" />
        <div className="cell-shimmer h-64 rounded-xl" />
      </div>
    );
  }

  const { sampleStatus, run, accounts } = state;

  if (sampleStatus === "not_claimed" || sampleStatus === "icp_pending") {
    const retry = sampleStatus === "icp_pending" && !!run;
    return (
      <div className="space-y-4">
        {retry && (
          <div role="status" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Your last research run could not finish, so your free sample is still available. Check your ICP and start again.
          </div>
        )}
        {showForm || sampleStatus === "icp_pending" ? (
          <SampleIcpForm initial={state.icpBrief} onCancel={sampleStatus === "not_claimed" ? () => setShowForm(false) : undefined}
            onStarted={() => { setShowForm(false); void refresh(); }} />
        ) : (
          <Claim onClaim={() => setShowForm(true)} />
        )}
      </div>
    );
  }

  if (sampleStatus === "running") {
    return (
      <div className="space-y-4">
        <RunHeader step={run?.current_step || "Starting research..."} percent={Math.max(2, run?.progress_percent || 0)} />
        <ResearchGrid accounts={accounts} pendingRows={accounts.length === 0 ? SAMPLE_SIZE : 0} />
        <p className="text-xs text-slate-500">
          Companies that do not meet the evidence bar are dimmed and will not be delivered. You can leave this page; research continues.
        </p>
      </div>
    );
  }

  const selected = accounts.find((a) => a.id === selectedId) || accounts[0];
  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Sample delivered</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {accounts.length === 0 ? "No account met the bar this time" : `Your ${accounts.length} sample account${accounts.length === 1 ? "" : "s"}`}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            {accounts.length < SAMPLE_SIZE
              ? `We only deliver accounts with dated, sourced buying signals. ${accounts.length === 0 ? "Request enrichment and" : "Request enrichment if you want more depth, and"} our team will complete the research by hand.`
              : "Click any row for the full research card. Request enrichment to have a Humagent add decision-maker contacts and fill any gaps."}
          </p>
        </div>
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadCsv(accounts, signals)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Download className="w-4 h-4" /> CSV
            </button>
            <a href="/api/samples/pdf" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Download className="w-4 h-4" /> PDF
            </a>
          </div>
        )}
      </section>

      {accounts.length > 0 && <ResearchGrid accounts={accounts} onSelect={(a) => setSelectedId(a.id)} />}
      {enrichmentSlot?.(accounts)}
      {selected && <AccountCard account={selected} />}
      {accounts.length > 1 && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><Sparkles className="w-3.5 h-3.5" /> Showing {selected.name}. Select another row above to see its card.</p>
      )}
      <PlanPanel workspaceId={workspaceId} tier={state.tier} onOpenChannel={onOpenChannel} />
    </div>
  );
}
