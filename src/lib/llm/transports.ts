/**
 * One HTTP call per provider kind. Each returns the model's text plus token
 * usage, or a typed failure carrying the HTTP status so the router can decide
 * whether to cool the provider down.
 */

import type { ProviderConfig } from "./providers";

export const LLM_TIMEOUT_MS = 45_000;

export interface LlmRequest {
  system: string;
  user: string;
  temperature?: number;
  /** Ask for a JSON object (provider JSON mode where supported). */
  json?: boolean;
}

export type TransportResult =
  | { ok: true; text: string; tokens: number }
  | { ok: false; status: number; message: string; retryAfterSec?: number };

const JSON_INSTRUCTION = "Respond with a single JSON object.";

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function httpFailure(p: ProviderConfig, res: Response): Promise<TransportResult> {
  const detail = await res.text().catch(() => "");
  // Retry-After header, or Gemini's {"retryDelay": "37s"} in the body.
  const retryAfter = Number(res.headers.get("retry-after")) || Number(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(detail)?.[1]);
  return {
    ok: false,
    status: res.status,
    message: `${p.id} ${p.model} HTTP ${res.status}: ${detail.slice(0, 200)}`,
    retryAfterSec: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  };
}

async function callOpenAiCompatible(p: ProviderConfig, req: LlmRequest): Promise<TransportResult> {
  const system = req.json ? `${req.system}\n${JSON_INSTRUCTION}` : req.system;
  const res = await post(`${p.baseUrl}/chat/completions`, { Authorization: `Bearer ${p.apiKey}`, ...p.headers }, {
    model: p.model,
    temperature: req.temperature ?? 0.1,
    ...(req.json && p.jsonMode ? { response_format: { type: "json_object" } } : {}),
    messages: [
      { role: "system", content: system },
      { role: "user", content: req.user },
    ],
  });
  if (!res.ok) return httpFailure(p, res);
  const data = await res.json();
  return {
    ok: true,
    text: String(data?.choices?.[0]?.message?.content || ""),
    tokens: Number(data?.usage?.total_tokens) || 0,
  };
}

async function callGemini(p: ProviderConfig, req: LlmRequest): Promise<TransportResult> {
  const res = await post(
    `${p.baseUrl}/models/${encodeURIComponent(p.model)}:generateContent`,
    { "x-goog-api-key": p.apiKey, ...p.headers },
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: {
        temperature: req.temperature ?? 0.1,
        ...(req.json ? { responseMimeType: "application/json" } : {}),
      },
    }
  );
  if (!res.ok) return httpFailure(p, res);
  const data = await res.json();
  const parts: unknown[] = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : ""))
    .join("");
  return { ok: true, text, tokens: Number(data?.usageMetadata?.totalTokenCount) || 0 };
}

async function callAnthropic(p: ProviderConfig, req: LlmRequest): Promise<TransportResult> {
  const res = await post(
    `${p.baseUrl}/messages`,
    { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01", ...p.headers },
    {
      model: p.model,
      max_tokens: 4096,
      temperature: req.temperature ?? 0.1,
      system: req.json ? `${req.system}\n${JSON_INSTRUCTION}` : req.system,
      messages: [{ role: "user", content: req.user }],
    }
  );
  if (!res.ok) return httpFailure(p, res);
  const data = await res.json();
  const blocks: unknown[] = Array.isArray(data?.content) ? data.content : [];
  const text = blocks
    .map((b) => (b && typeof b === "object" && (b as { type?: unknown }).type === "text" ? String((b as { text: unknown }).text) : ""))
    .join("");
  const tokens = (Number(data?.usage?.input_tokens) || 0) + (Number(data?.usage?.output_tokens) || 0);
  return { ok: true, text, tokens };
}

/** Calls one provider; network errors and timeouts come back as status 0. */
export async function callProvider(p: ProviderConfig, req: LlmRequest): Promise<TransportResult> {
  try {
    if (p.kind === "gemini") return await callGemini(p, req);
    if (p.kind === "anthropic") return await callAnthropic(p, req);
    return await callOpenAiCompatible(p, req);
  } catch (e) {
    return { ok: false, status: 0, message: `${p.id} ${p.model}: ${e instanceof Error ? e.message : String(e)}` };
  }
}
