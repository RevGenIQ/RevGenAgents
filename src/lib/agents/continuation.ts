/**
 * Chains invocations of a long run. When an invocation hits its time budget,
 * this POSTs /api/runs/[id]/continue on the app's own configured URL with the
 * shared secret, so the next invocation starts with a fresh maxDuration window.
 * The target URL comes only from configuration, never from the request Host
 * header, so the secret cannot be sent to a caller-controlled host.
 */

import { logger } from "../security/logger";
import type { RunOutcome } from "./index";

export const CONTINUE_SECRET_HEADER = "x-agent-continue";
const MIN_SECRET_LENGTH = 32;

/** Returns the continue secret, or null when it is missing or too short (fail closed). */
export function getContinueSecret(): string | null {
  const secret = (process.env.AGENT_CONTINUE_SECRET || "").trim();
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function continueBaseUrl(): string | null {
  const raw = (process.env.AGENT_CONTINUE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export async function requestContinuation(runId: string): Promise<boolean> {
  const secret = getContinueSecret();
  const base = continueBaseUrl();
  if (!secret || !base) {
    logger.error(
      `Run ${runId} needs continuation but AGENT_CONTINUE_SECRET (>=32 chars) or NEXT_PUBLIC_APP_URL is not configured.`
    );
    return false;
  }
  try {
    const res = await fetch(`${base}/api/runs/${encodeURIComponent(runId)}/continue`, {
      method: "POST",
      headers: { [CONTINUE_SECRET_HEADER]: secret },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.error(`Continuation request for run ${runId} returned HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (e) {
    logger.error(`Continuation request for run ${runId} failed`, e);
    return false;
  }
}

/** Runs one invocation and, if it ran out of time, schedules the next one. */
export async function driveRun(runId: string, step: () => Promise<RunOutcome>): Promise<RunOutcome> {
  const outcome = await step();
  if (outcome.kind === "continue") await requestContinuation(runId);
  return outcome;
}
