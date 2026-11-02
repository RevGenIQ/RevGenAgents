/**
 * Fallback router: tries each configured provider in order until one answers.
 * A provider that fails on auth, billing or configuration is cooled down for
 * minutes so later calls skip it. A rate-limited provider is cooled only until
 * its limit resets, and when every provider is unavailable the router waits for
 * the first rate limit to clear instead of failing the call.
 */

import { logger } from "../security/logger";
import { resolveProviders, type ProviderConfig } from "./providers";
import { callProvider, type LlmRequest, type TransportResult } from "./transports";

/** Auth/billing/config failures will not fix themselves within a run. */
const HARD_FAILURE_COOLDOWN_MS = 10 * 60_000;
/** Rate-limit cooldown when the provider sends no Retry-After. */
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 10_000;
/** Longest Retry-After we will wait for in place before moving to the next provider. */
const MAX_RETRY_WAIT_SEC = 20;
/** Rate-limit retries per provider per call (free tiers have small per-minute token budgets). */
const MAX_RATE_LIMIT_RETRIES = 2;
/** Longest wait for a rate-limited provider when nothing else can answer. */
const MAX_DEFERRED_WAIT_MS = 60_000;
const BILLING_HINT = /insufficient_quota|billing|credit|quota exceeded|free tier/i;
/** Gemini's per-minute 429s mention billing too, but name a rate limit or a retry delay. */
const RATE_HINT = /RATE_LIMIT_EXCEEDED|retryDelay|per minute|rate limit/i;
/** A 400 that names the key or workspace is a configuration error, not a bad request. */
const CONFIG_HINT = /api key|api_key|workspace|authenticat|permission/i;

type Cooldown = { until: number; kind: "hard" | "rate" };

const globalKey = Symbol.for("revgeniq.llm.cooldowns");
type GlobalWithCooldowns = typeof globalThis & { [globalKey]?: Map<string, Cooldown> };

function cooldowns(): Map<string, Cooldown> {
  const g = globalThis as GlobalWithCooldowns;
  if (!g[globalKey]) g[globalKey] = new Map();
  return g[globalKey];
}

/** Clears all cooldowns (tests, or after a key is topped up). */
export function resetLlmCooldowns(): void {
  cooldowns().clear();
}

function isBillingFailure(message: string): boolean {
  return BILLING_HINT.test(message) && !RATE_HINT.test(message);
}

function cooldownFor(result: TransportResult): Omit<Cooldown, "until"> & { ms: number } | null {
  if (result.ok) return null;
  const { status, message } = result;
  const billing = status === 429 && isBillingFailure(message);
  if (status === 401 || status === 402 || status === 403 || status === 404 || billing) {
    return { kind: "hard", ms: HARD_FAILURE_COOLDOWN_MS };
  }
  if (status === 400 && CONFIG_HINT.test(message)) return { kind: "hard", ms: HARD_FAILURE_COOLDOWN_MS };
  if (status === 429) {
    return { kind: "rate", ms: result.retryAfterSec ? result.retryAfterSec * 1000 : DEFAULT_RATE_LIMIT_COOLDOWN_MS };
  }
  return null;
}

function isShortRateLimit(result: TransportResult): boolean {
  return (
    !result.ok &&
    result.status === 429 &&
    !isBillingFailure(result.message) &&
    (result.retryAfterSec ?? 0) <= MAX_RETRY_WAIT_SEC
  );
}

export interface LlmAttempt {
  provider: string;
  model: string;
  tokens: number;
  ok: boolean;
  status?: number;
}

export type LlmTextResult =
  | { ok: true; text: string; provider: string; model: string; attempts: LlmAttempt[] }
  | { ok: false; code: "NO_PROVIDER" | "ALL_FAILED"; message: string; attempts: LlmAttempt[] };

/** Called with each provider's text; return an error string to try the next provider. */
export type Acceptor = (text: string, provider: ProviderConfig) => string | null;

export interface RouteOptions {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  providers?: ProviderConfig[];
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Runs the request through the fallback chain. `accept` lets the caller reject
 * an answer (empty, not JSON, wrong schema) so the next provider gets a turn.
 */
export async function llmText(req: LlmRequest, accept: Acceptor = () => null, opts: RouteOptions = {}): Promise<LlmTextResult> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? defaultSleep;
  const { providers, skipped } = opts.providers ? { providers: opts.providers, skipped: [] } : resolveProviders();
  const attempts: LlmAttempt[] = [];
  const errors: string[] = [];
  const cooling = cooldowns();

  if (providers.length === 0) {
    const why = skipped.map((s) => s.reason).join(" ");
    return { ok: false, code: "NO_PROVIDER", attempts, message: `No LLM provider is configured. ${why}`.trim() };
  }

  /** One provider, including in-place retries for short rate limits. Returns the text on success. */
  async function tryProvider(p: ProviderConfig): Promise<string | null> {
    let result = await callProvider(p, req);
    for (let retry = 0; retry < MAX_RATE_LIMIT_RETRIES && isShortRateLimit(result); retry++) {
      attempts.push({ provider: p.id, model: p.model, tokens: 0, ok: false, status: 429 });
      await sleep(((!result.ok && result.retryAfterSec) || 2) * 1000);
      result = await callProvider(p, req);
    }

    if (!result.ok) {
      attempts.push({ provider: p.id, model: p.model, tokens: 0, ok: false, status: result.status });
      const cool = cooldownFor(result);
      if (cool) cooling.set(p.id, { until: now() + cool.ms, kind: cool.kind });
      logger.warn("LLM provider failed; trying the next one", { provider: p.id, status: result.status, cooldownMs: cool?.ms ?? 0, detail: result.message });
      // Callers store this in task logs visible to clients: keep provider response bodies in the server log only.
      errors.push(`${p.id} ${p.model}: HTTP ${result.status || "network error"}`);
      return null;
    }

    const rejection = result.text.trim() ? accept(result.text, p) : `${p.id} ${p.model} returned an empty response.`;
    attempts.push({ provider: p.id, model: p.model, tokens: result.tokens, ok: !rejection });
    if (rejection) errors.push(rejection);
    return rejection ? null : result.text;
  }

  for (const p of providers) {
    const cool = cooling.get(p.id);
    if (cool && cool.until > now()) {
      errors.push(`${p.id}: skipped (${cool.kind === "rate" ? "rate limited" : "cooling down after an earlier failure"})`);
      continue;
    }
    const text = await tryProvider(p);
    if (text !== null) return { ok: true, text, provider: p.id, model: p.model, attempts };
  }

  // Nothing answered. If some providers are only rate limited, wait for the
  // first one to reset rather than failing the whole step.
  const rateLimited = providers
    .map((p) => ({ p, cool: cooling.get(p.id) }))
    .filter((x): x is { p: ProviderConfig; cool: Cooldown } => x.cool?.kind === "rate")
    .sort((a, b) => a.cool.until - b.cool.until);
  for (const { p, cool } of rateLimited) {
    const wait = cool.until - now();
    if (wait > MAX_DEFERRED_WAIT_MS) break;
    if (wait > 0) await sleep(wait);
    cooling.delete(p.id);
    const text = await tryProvider(p);
    if (text !== null) return { ok: true, text, provider: p.id, model: p.model, attempts };
  }

  return { ok: false, code: "ALL_FAILED", attempts, message: errors.join(" | ").slice(0, 1000) };
}
