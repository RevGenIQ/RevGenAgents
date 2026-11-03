"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunAccount } from "@/lib/accounts/runAccount";
import type { ClientTier, SampleStatus } from "@/lib/store/osWorkflowStore";

export interface SampleRun {
  id: string;
  status: "queued" | "running" | "completed" | "stopped" | "failed";
  progress_percent: number;
  current_step: string;
  leads_found: number;
  error_message: string | null;
}

export interface SampleState {
  tier: ClientTier;
  sampleStatus: SampleStatus;
  hasIcp: boolean;
  icpBrief: Record<string, unknown> | null;
  run: SampleRun | null;
  accounts: RunAccount[];
}

/** While research is running the grid refreshes this often. */
const LIVE_POLL_MS = 2500;

/** Loads /api/samples and keeps polling while the sample run is in progress. */
export function useSampleState() {
  const [state, setState] = useState<SampleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (): Promise<SampleState | null> => {
    try {
      const res = await fetch("/api/samples", { credentials: "include", cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not load your samples.");
        return null;
      }
      const next: SampleState = {
        tier: json.tier,
        sampleStatus: json.sampleStatus,
        hasIcp: !!json.hasIcp,
        icpBrief: json.icpBrief,
        run: json.run,
        accounts: json.accounts || [],
      };
      setError(null);
      setState(next);
      return next;
    } catch {
      setError("Network error while loading your samples.");
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const next = await load();
      if (cancelled) return;
      if (next?.sampleStatus === "running") timer.current = setTimeout(tick, LIVE_POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  /** Re-fetches now and resumes live polling (used right after starting the run). */
  const refresh = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const poll = async () => {
      const next = await load();
      if (next?.sampleStatus === "running") timer.current = setTimeout(poll, LIVE_POLL_MS);
    };
    await poll();
  }, [load]);

  return { state, error, refresh };
}
