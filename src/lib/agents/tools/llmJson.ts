/**
 * Structured LLM calls through the provider fallback chain (src/lib/llm).
 * An answer counts only if it is JSON that passes the caller's zod schema;
 * otherwise the next provider is tried. Nothing is ever fabricated.
 */

import type * as z from "zod";
import { llmText, type LlmAttempt } from "../../llm/router";

export type { LlmAttempt };

export type LlmErrorCode = "NO_PROVIDER" | "ALL_FAILED";

export interface LlmError {
  code: LlmErrorCode;
  message: string;
}

export type LlmJsonResult<T> =
  | { ok: true; data: T; provider: string; attempts: LlmAttempt[] }
  | { ok: false; error: LlmError; attempts: LlmAttempt[] };

export interface LlmJsonRequest {
  system: string;
  user: string;
  temperature?: number;
}

/** Strips Markdown fences and parses JSON; returns undefined when it is not JSON. */
export function parseJsonText(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return undefined;
  }
}

/**
 * Calls the configured providers in order until one returns schema-valid JSON.
 * Every attempt (including failures) is reported so usage can be metered.
 */
export async function llmJson<T>(schema: z.ZodType<T>, req: LlmJsonRequest): Promise<LlmJsonResult<T>> {
  let data: T | undefined;
  const result = await llmText({ ...req, json: true }, (text, p) => {
    const parsed = parseJsonText(text);
    if (parsed === undefined) return `${p.id} ${p.model}: response was not valid JSON.`;
    const checked = schema.safeParse(parsed);
    if (!checked.success) return `${p.id} ${p.model}: ${checked.error.message.slice(0, 300)}`;
    data = checked.data;
    return null;
  });

  if (!result.ok) return { ok: false, error: { code: result.code, message: result.message }, attempts: result.attempts };
  return { ok: true, data: data as T, provider: result.provider, attempts: result.attempts };
}
