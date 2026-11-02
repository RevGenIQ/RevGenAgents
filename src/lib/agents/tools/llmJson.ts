/**
 * Structured LLM calls: Gemini first (GEMINI_API_KEY), OpenAI as fallback
 * (OPENAI_API_KEY). The response must be JSON that passes the caller's zod
 * schema; otherwise a typed error is returned. Nothing is ever fabricated.
 */

import type * as z from "zod";

const LLM_TIMEOUT_MS = 45_000;

export type LlmProvider = "gemini" | "openai";

export type LlmErrorCode = "NO_PROVIDER" | "HTTP_ERROR" | "EMPTY_RESPONSE" | "INVALID_JSON" | "SCHEMA_MISMATCH";

export interface LlmError {
  code: LlmErrorCode;
  message: string;
  provider?: LlmProvider;
}

export interface LlmAttempt {
  provider: LlmProvider;
  tokens: number;
}

export type LlmJsonResult<T> =
  | { ok: true; data: T; provider: LlmProvider; attempts: LlmAttempt[] }
  | { ok: false; error: LlmError; attempts: LlmAttempt[] };

export interface LlmJsonRequest {
  system: string;
  user: string;
  temperature?: number;
}

type RawCall = { ok: true; text: string; tokens: number } | { ok: false; error: LlmError; tokens: number };

async function callGemini(key: string, req: LlmJsonRequest): Promise<RawCall> {
  const model = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: req.temperature ?? 0.1 },
        }),
      }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        tokens: 0,
        error: { code: "HTTP_ERROR", provider: "gemini", message: `Gemini ${model} HTTP ${res.status}: ${detail.slice(0, 160)}` },
      };
    }
    const data = await res.json();
    const tokens = Number(data?.usageMetadata?.totalTokenCount) || 0;
    const parts: unknown[] = data?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .map((p) => (p && typeof p === "object" && "text" in p ? String((p as { text: unknown }).text) : ""))
      .join("");
    if (!text.trim()) {
      return { ok: false, tokens, error: { code: "EMPTY_RESPONSE", provider: "gemini", message: "Gemini returned no text." } };
    }
    return { ok: true, text, tokens };
  } catch (e) {
    return {
      ok: false,
      tokens: 0,
      error: { code: "HTTP_ERROR", provider: "gemini", message: e instanceof Error ? e.message : String(e) },
    };
  }
}

async function callOpenAi(key: string, req: LlmJsonRequest): Promise<RawCall> {
  const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: req.temperature ?? 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${req.system}\nRespond with a single JSON object.` },
          { role: "user", content: req.user },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        tokens: 0,
        error: { code: "HTTP_ERROR", provider: "openai", message: `OpenAI ${model} HTTP ${res.status}: ${detail.slice(0, 160)}` },
      };
    }
    const data = await res.json();
    const tokens = Number(data?.usage?.total_tokens) || 0;
    const text = String(data?.choices?.[0]?.message?.content || "");
    if (!text.trim()) {
      return { ok: false, tokens, error: { code: "EMPTY_RESPONSE", provider: "openai", message: "OpenAI returned no content." } };
    }
    return { ok: true, text, tokens };
  } catch (e) {
    return {
      ok: false,
      tokens: 0,
      error: { code: "HTTP_ERROR", provider: "openai", message: e instanceof Error ? e.message : String(e) },
    };
  }
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

function validate<T>(schema: z.ZodType<T>, text: string, provider: LlmProvider): { ok: true; data: T } | { ok: false; error: LlmError } {
  const parsed = parseJsonText(text);
  if (parsed === undefined) {
    return { ok: false, error: { code: "INVALID_JSON", provider, message: "Response was not valid JSON." } };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: { code: "SCHEMA_MISMATCH", provider, message: result.error.message.slice(0, 300) },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Calls the configured providers in order until one returns schema-valid JSON.
 * Every attempt (including failures) is reported so usage can be metered.
 */
export async function llmJson<T>(schema: z.ZodType<T>, req: LlmJsonRequest): Promise<LlmJsonResult<T>> {
  const providers: Array<{ name: LlmProvider; key: string }> = [];
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (geminiKey) providers.push({ name: "gemini", key: geminiKey });
  if (openaiKey) providers.push({ name: "openai", key: openaiKey });

  if (providers.length === 0) {
    return {
      ok: false,
      attempts: [],
      error: { code: "NO_PROVIDER", message: "Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured." },
    };
  }

  const attempts: LlmAttempt[] = [];
  let lastError: LlmError = { code: "EMPTY_RESPONSE", message: "No provider returned a response." };

  for (const p of providers) {
    const raw = p.name === "gemini" ? await callGemini(p.key, req) : await callOpenAi(p.key, req);
    attempts.push({ provider: p.name, tokens: raw.tokens });
    if (!raw.ok) {
      lastError = raw.error;
      continue;
    }
    const checked = validate(schema, raw.text, p.name);
    if (checked.ok) return { ok: true, data: checked.data, provider: p.name, attempts };
    lastError = checked.error;
  }

  return { ok: false, error: lastError, attempts };
}
