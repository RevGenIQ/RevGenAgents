"use client";

import React, { useState } from "react";
import { AlertCircle, Check, Download } from "lucide-react";
import { STATUS_LABEL, sendJson, useEnrichmentRequests, type EnrichmentRequest, type EnrichmentStatus } from "./useEnrichmentRequests";

const STEPS: EnrichmentStatus[] = ["requested", "assigned", "in_progress", "submitted", "delivered"];
const STEP_TEXT: Record<string, string> = {
  requested: "Requested",
  assigned: "Humagent assigned",
  in_progress: "Being enriched",
  submitted: "Quality review",
  delivered: "Delivered",
};
const COLUMN_CHOICES = ["Decision-maker contacts", "Verified emails", "Direct phone numbers", "Revenue", "Funding details", "Employee count", "Tech stack", "More buying signals"];

function Tracker({ req }: { req: EnrichmentRequest }) {
  const current = Math.max(0, STEPS.indexOf(req.status === "approved" ? "submitted" : req.status));
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Enrichment progress">
      {STEPS.map((step, i) => {
        const done = i < current || req.status === "delivered";
        const active = i === current && req.status !== "delivered";
        return (
          <li key={step} className="flex items-center gap-2">
            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold ${done ? "bg-emerald-600 text-white" : active ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
              {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={`text-sm ${active ? "font-medium text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>{STEP_TEXT[step]}</span>
            {i < STEPS.length - 1 && <span aria-hidden="true" className="w-6 h-px bg-slate-300 dark:bg-slate-700" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Client: request enrichment of the delivered sample, then follow it to delivery. */
export function EnrichmentPanel({ accountCount }: { accountCount: number }) {
  const { requests, error, reload } = useEnrichmentRequests(15000);
  const [note, setNote] = useState("");
  const [columns, setColumns] = useState<string[]>(["Decision-maker contacts", "Verified emails"]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!requests) return error ? <p className="text-sm text-rose-600">{error}</p> : null;
  const latest = requests[0];

  if (latest && latest.status !== "rejected") {
    return (
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Enrichment · {STATUS_LABEL[latest.status]}</p>
            <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
              {latest.status === "delivered" ? "Your enriched accounts are ready" : "Our team is enriching your accounts"}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {latest.status === "delivered"
                ? "Contacts and missing details were added by your Humagent and checked by our team. They are now on the account cards and in the PDF."
                : latest.assigned_humagent_name
                ? `${latest.assigned_humagent_name} is working on it. You will get a message in your channel when it is ready.`
                : "The Admin is assigning a Humagent. You will get a message in your channel at each step."}
            </p>
          </div>
          {latest.status === "delivered" && (
            <a href="/api/samples/pdf" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white">
              <Download className="w-4 h-4" /> Download enriched PDF
            </a>
          )}
        </div>
        <Tracker req={latest} />
      </section>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    setFormError(null);
    const res = await sendJson("/api/enrichment", "POST", { note, columns });
    setSubmitting(false);
    if (!res.ok) setFormError(String(res.data.error || "Could not send the request."));
    else void reload();
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Want these {accountCount > 0 ? `${accountCount} accounts` : "accounts"} enriched by a person?</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          A Humagent researcher adds decision-maker contacts and fills any gaps the agent could not source. Pick what matters most.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="What to enrich">
        {COLUMN_CHOICES.map((c) => {
          const on = columns.includes(c);
          return (
            <button key={c} type="button" aria-pressed={on} onClick={() => setColumns(on ? columns.filter((x) => x !== c) : [...columns, c])}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400"}`}>
              {c}
            </button>
          );
        })}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} aria-label="Note for the team"
        placeholder="Anything specific? e.g. we sell to the CFO, please find finance leaders"
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
      {formError && <p role="alert" className="flex gap-1.5 text-sm text-rose-600"><AlertCircle className="w-4 h-4 mt-0.5" /> {formError}</p>}
      <button type="button" onClick={submit} disabled={submitting}
        className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white">
        {submitting ? "Sending..." : "Request enrichment"}
      </button>
    </section>
  );
}
