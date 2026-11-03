"use client";

import React, { useState } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { EMPLOYEE_BANDS, SUGGESTED_SIGNALS } from "@/lib/samples/sampleIcp";
import { TagInput } from "./TagInput";

interface SampleIcpFormProps {
  initial?: Record<string, unknown> | null;
  onStarted: () => void;
  onCancel?: () => void;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

/** The ICP the free sample is researched against. Submitting starts the one-time run. */
export function SampleIcpForm({ initial, onStarted, onCancel }: SampleIcpFormProps) {
  const [offering, setOffering] = useState(String(initial?.offering || ""));
  const [idealCustomer, setIdealCustomer] = useState(String(initial?.businessGoal || ""));
  const [industries, setIndustries] = useState(strings(initial?.targetIndustries));
  const [geographies, setGeographies] = useState(strings(initial?.geographies));
  const [bands, setBands] = useState(strings(initial?.employeeBands));
  const [titles, setTitles] = useState(strings(initial?.targetTitles));
  const [signals, setSignals] = useState(strings(initial?.requiredSignals));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (industries.length === 0 || geographies.length === 0) {
      setError("Add at least one target industry and one country or region.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/samples/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offering, idealCustomer, industries, geographies, employeeBands: bands, targetTitles: titles, signals }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not start the research. Please try again.");
        return;
      }
      onStarted();
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500";

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 space-y-6">
      <div>
        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Step 2 of 3</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">Describe who you sell to</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          Our research agent uses this to find 5 companies that match and are showing buying signals right now.
          You get one free run, so be as specific as you can.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label htmlFor="icp-offering" className="block text-sm font-medium text-slate-800 dark:text-slate-200">What do you sell?</label>
          <textarea id="icp-offering" required minLength={10} maxLength={600} rows={2} value={offering}
            onChange={(e) => setOffering(e.target.value)} className={fieldClass}
            placeholder="e.g. Payroll and HR software for mid-size manufacturers" />
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="icp-ideal" className="block text-sm font-medium text-slate-800 dark:text-slate-200">Your ideal customer, in a sentence <span className="font-normal text-slate-500">(optional)</span></label>
          <input id="icp-ideal" maxLength={600} value={idealCustomer} onChange={(e) => setIdealCustomer(e.target.value)} className={fieldClass}
            placeholder="e.g. Fast-growing B2B SaaS companies that just raised and are hiring sales reps" />
        </div>
        <TagInput id="icp-industries" label="Target industries" values={industries} onChange={setIndustries}
          placeholder="Type an industry and press Enter" suggestions={["B2B SaaS", "Fintech", "Healthcare", "Manufacturing", "Logistics", "E-commerce"]} />
        <TagInput id="icp-geos" label="Countries or regions" values={geographies} onChange={setGeographies}
          placeholder="e.g. India, United States" suggestions={["India", "United States", "United Kingdom", "UAE", "Singapore", "Germany"]} />
        <div>
          <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">Company size (employees)</span>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Company size">
            {EMPLOYEE_BANDS.map((b) => {
              const on = bands.includes(b);
              return (
                <button key={b} type="button" aria-pressed={on} onClick={() => setBands(on ? bands.filter((x) => x !== b) : [...bands, b])}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400"}`}>
                  {b}
                </button>
              );
            })}
          </div>
        </div>
        <TagInput id="icp-titles" label="Buyer job titles" hint="Optional: contacts are a bonus in the sample." values={titles} onChange={setTitles}
          placeholder="e.g. Head of Sales" suggestions={["CEO", "Head of Sales", "VP Marketing", "CTO", "Head of HR"]} />
        <div className="lg:col-span-2">
          <TagInput id="icp-signals" label="Buying signals that matter to you" values={signals} onChange={setSignals}
            placeholder="e.g. Funding round" suggestions={SUGGESTED_SIGNALS} />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex gap-2 rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-5">
        <p className="text-xs text-slate-500 max-w-md">Research takes a few minutes. You can watch every company being researched.</p>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Back</button>
          )}
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white">
            {submitting ? "Starting research..." : <>Start research <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </form>
  );
}
