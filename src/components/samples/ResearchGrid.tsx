"use client";

import React from "react";
import { CompanyFavicon } from "@/components/ui/CompanyFavicon";
import type { RunAccount } from "@/lib/accounts/runAccount";

interface Column {
  key: string;
  label: string;
  width: string;
  value: (a: RunAccount) => string;
}

const COLUMNS: Column[] = [
  { key: "industry", label: "Industry", width: "min-w-[150px]", value: (a) => a.industry },
  { key: "employees", label: "Employees", width: "min-w-[100px]", value: (a) => a.employees },
  { key: "hq", label: "HQ", width: "min-w-[170px]", value: (a) => a.hqLocation || [a.city, a.country].filter(Boolean).join(", ") },
  { key: "founded", label: "Founded", width: "min-w-[80px]", value: (a) => a.foundedYear },
  { key: "type", label: "Type", width: "min-w-[100px]", value: (a) => a.companyType },
  { key: "funding", label: "Funding", width: "min-w-[150px]", value: (a) => [a.latestFundingRound, a.latestFundingAmount || a.totalFunding].filter(Boolean).join(" · ") },
  { key: "tech", label: "Tech stack", width: "min-w-[180px]", value: (a) => a.techStack.slice(0, 3).join(", ") + (a.techStack.length > 3 ? ` +${a.techStack.length - 3}` : "") },
  { key: "signals", label: "Signals", width: "min-w-[90px]", value: (a) => (a.status === "done" || a.totalSignals ? String(a.totalSignals) : "") },
  { key: "score", label: "ICP score", width: "min-w-[90px]", value: (a) => (a.icpScore === null ? "" : String(a.icpScore)) },
];

function StatusPill({ account }: { account: RunAccount }) {
  if (account.status !== "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex rounded-full w-2 h-2 bg-indigo-500" />
        </span>
        Researching
      </span>
    );
  }
  if (account.stage === "discarded") return <span className="text-[11px] font-medium text-slate-500">Did not qualify</span>;
  return <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Ready</span>;
}

function Cell({ value, researching }: { value: string; researching: boolean }) {
  if (value) {
    // key={value} remounts the span so each newly found value fades in.
    return <span key={value} className="cell-arrive block truncate">{value}</span>;
  }
  if (researching) return <span aria-label="Researching" className="cell-shimmer block h-3.5 w-3/4 rounded" />;
  return <span className="text-slate-400" aria-label="Not found">—</span>;
}

interface ResearchGridProps {
  accounts: RunAccount[];
  onSelect?: (account: RunAccount) => void;
  /** Placeholder rows shown before the first company is discovered. */
  pendingRows?: number;
}

/** Apollo-style account table that fills in cell by cell while the agent researches. */
export function ResearchGrid({ accounts, onSelect, pendingRows = 0 }: ResearchGridProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-left text-xs font-medium text-slate-500">
            <th scope="col" className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 min-w-[230px]">Company</th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className={`px-3 py-2.5 ${c.width}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => {
            const researching = a.status !== "done";
            const dimmed = a.stage === "discarded";
            return (
              <tr
                key={a.id}
                onClick={() => onSelect?.(a)}
                className={`border-b border-slate-100 dark:border-slate-800/70 last:border-0 ${onSelect && !researching ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" : ""} ${dimmed ? "opacity-55" : ""}`}
              >
                <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-4 py-3 text-left font-normal">
                  <div className="flex items-center gap-3">
                    <CompanyFavicon domain={a.domain} name={a.name} size="w-8 h-8" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white truncate max-w-[150px]">{a.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 truncate max-w-[110px]">{a.domain}</span>
                        <StatusPill account={a} />
                      </div>
                    </div>
                  </div>
                </th>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={`px-3 py-3 text-slate-700 dark:text-slate-300 ${c.width}`}>
                    <Cell value={c.value(a)} researching={researching} />
                  </td>
                ))}
              </tr>
            );
          })}
          {Array.from({ length: pendingRows }, (_, i) => (
            <tr key={`pending-${i}`} className="border-b border-slate-100 dark:border-slate-800/70 last:border-0">
              <th scope="row" className="sticky left-0 bg-white dark:bg-slate-900 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="cell-shimmer w-8 h-8 rounded-md" />
                  <span className="cell-shimmer h-3.5 w-28 rounded" />
                </div>
              </th>
              {COLUMNS.map((c) => (
                <td key={c.key} className="px-3 py-3"><span className="cell-shimmer block h-3.5 w-2/3 rounded" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
