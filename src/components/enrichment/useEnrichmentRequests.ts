"use client";

import { useCallback, useEffect, useState } from "react";

export type EnrichmentStatus = "requested" | "assigned" | "in_progress" | "submitted" | "approved" | "delivered" | "rejected";

export interface EnrichmentRequest {
  id: string;
  workspace_id: string;
  workspaceName: string;
  workspaceDomain: string;
  run_id: string | null;
  status: EnrichmentStatus;
  client_note: string | null;
  requested_columns: string[];
  assigned_humagent_id: string | null;
  assigned_humagent_name: string | null;
  admin_note: string | null;
  submitted_at: string | null;
  delivered_at: string | null;
  created_at: string;
  staged: { companies: number; contacts: number; warnings: string[] } | null;
}

export const STATUS_LABEL: Record<EnrichmentStatus, string> = {
  requested: "Requested",
  assigned: "Assigned",
  in_progress: "In progress",
  submitted: "Awaiting review",
  approved: "Approved",
  delivered: "Delivered",
  rejected: "Rejected",
};

/** Loads /api/enrichment (scoped by role on the server) and exposes JSON helpers for actions. */
export function useEnrichmentRequests(pollMs = 0) {
  const [requests, setRequests] = useState<EnrichmentRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/enrichment", { credentials: "include", cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not load enrichment requests.");
        return;
      }
      setError(null);
      setRequests(json.requests || []);
    } catch {
      setError("Network error while loading enrichment requests.");
    }
  }, []);

  useEffect(() => {
    // Kick off the first load outside the effect body, then optionally poll.
    const first = setTimeout(() => void load(), 0);
    const timer = pollMs > 0 ? setInterval(() => document.visibilityState === "visible" && void load(), pollMs) : null;
    return () => {
      clearTimeout(first);
      if (timer) clearInterval(timer);
    };
  }, [load, pollMs]);

  return { requests, error, reload: load };
}

export async function sendJson(url: string, method: "POST" | "PATCH", body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
