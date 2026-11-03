"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  id: string;
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
}

/** Comma/Enter-separated chips, with optional one-click suggestions. */
export function TagInput({ id, label, hint, values, onChange, placeholder, suggestions = [], max = 8 }: TagInputProps) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const items = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...values, ...items.filter((i) => !values.some((v) => v.toLowerCase() === i.toLowerCase()))].slice(0, max);
    onChange(next);
    setDraft("");
  };

  const unused = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</label>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 px-2 py-1 text-xs font-medium">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-indigo-500 hover:text-indigo-800 dark:hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {values.length < max && (
          <input
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && !draft && values.length) {
                onChange(values.slice(0, -1));
              }
            }}
            onBlur={() => draft.trim() && add(draft)}
            placeholder={values.length === 0 ? placeholder : "Add more"}
            className="flex-1 min-w-[8rem] bg-transparent px-1 py-1 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
        )}
      </div>
      {unused.length > 0 && values.length < max && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unused.slice(0, 7).map((s) => (
            <button key={s} type="button" onClick={() => add(s)}
              className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
