"use client";

import React, { useRef, useState } from "react";
import { AlertCircle, Download, Upload } from "lucide-react";
import { CompanyFavicon } from "@/components/ui/CompanyFavicon";
import { STATUS_LABEL, sendJson, useEnrichmentRequests, type EnrichmentRequest } from "./useEnrichmentRequests";

interface HumagentOption {
  id: string;
  full_name: string;
}

interface EnrichmentQueueProps {
  role: "admin" | "humagent";
  humagents?: HumagentOption[];
}

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  assigned: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  in_progress: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
  submitted: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
  approved: "bg-emerald-100 text-emerald-800",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800",
};

function RequestRow({ req, role, humagents, onChanged }: { req: EnrichmentRequest; role: "admin" | "humagent"; humagents: HumagentOption[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [sendBackNote, setSendBackNote] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const act = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    const res = await sendJson(`/api/enrichment/${req.id}`, "PATCH", body);
    setBusy(false);
    setMessage(res.ok ? { tone: "ok", text: success } : { tone: "error", text: String(res.data.error || "Action failed.") });
    if (res.ok) onChanged();
  };

  const upload = async (file: File) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/enrichment/${req.id}/csv`, { method: "POST", credentials: "include", headers: { "Content-Type": "text/csv" }, body: await file.text() });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ tone: "error", text: data.error || "Upload failed." });
      return;
    }
    const warn = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.length} warning(s): ${data.warnings.slice(0, 2).join(" ")}` : "";
    setMessage({ tone: "ok", text: `Submitted ${data.staged.companies} accounts and ${data.staged.contacts} contacts for Admin review.${warn}` });
    onChanged();
  };

  const canUpload = ["assigned", "in_progress", "submitted"].includes(req.status);

  return (
    <li className="p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CompanyFavicon domain={req.workspaceDomain} name={req.workspaceName} size="w-9 h-9" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-slate-900 dark:text-white">{req.workspaceName}</span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[req.status]}`}>{STATUS_LABEL[req.status]}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Requested {new Date(req.created_at).toLocaleString()} {req.assigned_humagent_name ? `· ${req.assigned_humagent_name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/enrichment/${req.id}/csv`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Download className="w-3.5 h-3.5" /> Download CSV
          </a>
          {canUpload && (
            <>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" aria-label="Upload enriched CSV"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
              <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-white">
                <Upload className="w-3.5 h-3.5" /> Upload enriched CSV
              </button>
            </>
          )}
        </div>
      </div>

      {(req.client_note || req.requested_columns.length > 0) && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-950/50 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
          {req.requested_columns.length > 0 && <p><span className="font-medium">Wants:</span> {req.requested_columns.join(", ")}</p>}
          {req.client_note && <p className="mt-0.5"><span className="font-medium">Client note:</span> {req.client_note}</p>}
        </div>
      )}
      {req.admin_note && req.status !== "delivered" && (
        <p className="text-sm text-amber-700 dark:text-amber-300"><span className="font-medium">Admin note:</span> {req.admin_note}</p>
      )}
      {req.staged && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Staged: {req.staged.companies} accounts, {req.staged.contacts} contacts
          {req.staged.warnings.length > 0 ? ` · ${req.staged.warnings.length} warning(s)` : ""}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {role === "admin" && ["requested", "assigned", "in_progress"].includes(req.status) && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            Assign to
            <select disabled={busy} value={req.assigned_humagent_id || ""}
              onChange={(e) => e.target.value && void act({ action: "assign", humagentId: e.target.value }, "Humagent assigned.")}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-sm">
              <option value="">Choose a Humagent</option>
              {humagents.map((h) => <option key={h.id} value={h.id}>{h.full_name}</option>)}
            </select>
          </label>
        )}
        {role === "humagent" && req.status === "assigned" && (
          <button type="button" disabled={busy} onClick={() => act({ action: "start" }, "Marked as in progress.")}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800">Start work</button>
        )}
        {role === "admin" && req.status === "submitted" && (
          <>
            <button type="button" disabled={busy} onClick={() => act({ action: "approve" }, "Approved and delivered to the client.")}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-white">Approve and deliver</button>
            <input value={sendBackNote} onChange={(e) => setSendBackNote(e.target.value)} placeholder="What needs fixing?" aria-label="Send-back note"
              className="min-w-[12rem] flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-sm" />
            <button type="button" disabled={busy || sendBackNote.trim().length < 3} onClick={() => act({ action: "send_back", note: sendBackNote }, "Sent back to the Humagent.")}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium disabled:opacity-50">Send back</button>
          </>
        )}
      </div>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`flex gap-1.5 text-sm ${message.tone === "error" ? "text-rose-600" : "text-emerald-700 dark:text-emerald-400"}`}>
          {message.tone === "error" && <AlertCircle className="w-4 h-4 mt-0.5" />} {message.text}
        </p>
      )}
    </li>
  );
}

/** Admin: every enrichment request, assignment and approval. Humagent: assigned tasks, CSV out and in. */
export function EnrichmentQueue({ role, humagents = [] }: EnrichmentQueueProps) {
  const { requests, error, reload } = useEnrichmentRequests(20000);
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{role === "admin" ? "Enrichment queue" : "Enrichment tasks"}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          {role === "admin"
            ? "Assign client requests to a Humagent, then review the uploaded CSV and approve it to deliver to the client."
            : "Download the CSV, add contacts and missing details (extra columns are kept as context), then upload it for Admin review."}
        </p>
      </header>
      {error && <p className="p-5 text-sm text-rose-600">{error}</p>}
      {!requests ? (
        <div className="p-5"><div className="cell-shimmer h-16 rounded-lg" /></div>
      ) : requests.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">{role === "admin" ? "No enrichment requests yet." : "No tasks assigned to you yet."}</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {requests.map((r) => <RequestRow key={r.id} req={r} role={role} humagents={humagents} onChanged={reload} />)}
        </ul>
      )}
    </section>
  );
}
