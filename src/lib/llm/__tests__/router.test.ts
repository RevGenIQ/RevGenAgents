import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { llmJson } from "../../agents/tools/llmJson";
import { resolveProviders } from "../providers";
import { llmText, resetLlmCooldowns } from "../router";

const FOUR_KEYS = {
  OPENAI_API_KEY: "sk-openai",
  GEMINI_API_KEY: "g-key",
  ANTHROPIC_API_KEY: "sk-ant",
  GROQ_API_KEY: "gsk-groq",
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

const openAiAnswer = (content: string) => jsonResponse({ choices: [{ message: { content } }], usage: { total_tokens: 42 } });

describe("resolveProviders", () => {
  it("orders OpenAI, Gemini, Anthropic, then Groq by default", () => {
    expect(resolveProviders(FOUR_KEYS).providers.map((p) => p.id)).toEqual(["openai", "gemini", "anthropic", "groq"]);
  });

  it("honours LLM_PROVIDER_ORDER and appends unlisted providers", () => {
    const ids = resolveProviders({ ...FOUR_KEYS, LLM_PROVIDER_ORDER: "groq, gemini" }).providers.map((p) => p.id);
    expect(ids).toEqual(["groq", "gemini", "openai", "anthropic"]);
  });

  it("ignores placeholder keys from .env.example", () => {
    expect(resolveProviders({ OPENAI_API_KEY: "your_openai_api_key" }).providers).toEqual([]);
  });

  it("adds any OpenAI-compatible API from LLM_<NAME>_* variables", () => {
    const { providers } = resolveProviders({
      LLM_LOCALQWEN_BASE_URL: "http://localhost:11434/v1/",
      LLM_LOCALQWEN_API_KEY: "ollama",
      LLM_LOCALQWEN_MODEL: "qwen3",
    });
    expect(providers).toMatchObject([{ id: "localqwen", kind: "openai-compatible", baseUrl: "http://localhost:11434/v1", model: "qwen3" }]);
  });

  it("skips presets that need a model and custom providers on plain http", () => {
    const { providers, skipped } = resolveProviders({
      XAI_API_KEY: "xai-key",
      LLM_REMOTE_BASE_URL: "http://example.com/v1",
      LLM_REMOTE_API_KEY: "k",
      LLM_REMOTE_MODEL: "m",
    });
    expect(providers).toEqual([]);
    expect(skipped.map((s) => s.id).sort()).toEqual(["remote", "xai"]);
  });

  it("refuses a preset base URL that would send the key over plain http", () => {
    const { providers, skipped } = resolveProviders({ OPENAI_API_KEY: "sk-openai", OPENAI_BASE_URL: "http://proxy.example.com/v1" });
    expect(providers).toEqual([]);
    expect(skipped).toEqual([{ id: "openai", reason: expect.stringContaining("OPENAI_BASE_URL") }]);
  });

  it("sends the Anthropic workspace header when ANTHROPIC_WORKSPACE_ID is set", () => {
    const [p] = resolveProviders({ ANTHROPIC_API_KEY: "sk-ant", ANTHROPIC_WORKSPACE_ID: "wrkspc_1" }).providers;
    expect(p.headers).toEqual({ "anthropic-workspace-id": "wrkspc_1" });
  });
});

describe("llmText fallback chain", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    resetLlmCooldowns();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    for (const [k, v] of Object.entries(FOUR_KEYS)) vi.stubEnv(k, v);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const hosts = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)).host);

  it("falls through OpenAI, Gemini and Anthropic failures to Groq", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { code: "insufficient_quota" } }, 429))
      .mockResolvedValueOnce(jsonResponse({ error: "set up billing" }, 403))
      .mockResolvedValueOnce(jsonResponse({ error: "workspace required" }, 401))
      .mockResolvedValueOnce(openAiAnswer('{"ok":true}'));

    const result = await llmText({ system: "s", user: "u", json: true });

    expect(result).toMatchObject({ ok: true, provider: "groq", text: '{"ok":true}' });
    expect(hosts()).toEqual(["api.openai.com", "generativelanguage.googleapis.com", "api.anthropic.com", "api.groq.com"]);
  });

  it("skips providers cooling down after a billing failure on the next call", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { code: "insufficient_quota" } }, 429))
      .mockResolvedValueOnce(jsonResponse({ error: "billing" }, 403))
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValue(openAiAnswer("{}"));

    await llmText({ system: "s", user: "u" });
    fetchMock.mockClear();
    await llmText({ system: "s", user: "u" });

    expect(hosts()).toEqual(["api.groq.com"]);
  });

  it("cools down a provider whose 400 names a key or workspace problem", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 403))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "must include the anthropic-workspace-id header" } }, 400))
      .mockResolvedValue(openAiAnswer("{}"));

    await llmText({ system: "s", user: "u" });
    fetchMock.mockClear();
    await llmText({ system: "s", user: "u" });

    expect(hosts()).toEqual(["api.groq.com"]);
  });

  it("retries a short rate limit before moving on", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429, { "retry-after": "1" }))
      .mockResolvedValueOnce(openAiAnswer("{}"));
    const sleep = vi.fn(async () => {});

    const result = await llmText({ system: "s", user: "u" }, undefined, { sleep });

    expect(result.ok).toBe(true);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(hosts()).toEqual(["api.groq.com", "api.groq.com"]);
  });

  it("waits for a long rate limit to reset when no other provider can answer", async () => {
    for (const k of ["OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]) vi.stubEnv(k, "");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429, { "retry-after": "35" }))
      .mockResolvedValueOnce(openAiAnswer("{}"));
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});

    const result = await llmText({ system: "s", user: "u" }, undefined, { sleep });

    expect(result.ok).toBe(true);
    const waited = sleep.mock.calls.map(([ms]) => ms);
    expect(waited).toHaveLength(1);
    expect(waited[0]).toBeGreaterThan(30_000);
    expect(waited[0]).toBeLessThanOrEqual(35_000);
  });

  it("treats Gemini's per-minute quota 429 as a rate limit, not a billing failure", async () => {
    for (const k of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY"]) vi.stubEnv(k, "");
    const body = { error: { code: 429, message: "You exceeded your current quota, please check your plan and billing details.", status: "RESOURCE_EXHAUSTED", details: [{ retryDelay: "3s" }] } };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(body, 429))
      .mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }));
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});

    const result = await llmText({ system: "s", user: "u" }, undefined, { sleep });

    expect(result).toMatchObject({ ok: true, provider: "gemini" });
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("keeps provider response bodies out of the returned error", async () => {
    for (const k of ["OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]) vi.stubEnv(k, "");
    fetchMock.mockResolvedValue(jsonResponse({ error: "org_secret_123 is over its limit" }, 500));
    const result = await llmText({ system: "s", user: "u" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).not.toContain("org_secret_123");
  });

  it("reports NO_PROVIDER when no key is set", async () => {
    for (const k of Object.keys(FOUR_KEYS)) vi.stubEnv(k, "");
    const result = await llmText({ system: "s", user: "u" });
    expect(result).toMatchObject({ ok: false, code: "NO_PROVIDER" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves to the next provider when an answer fails the schema", async () => {
    fetchMock
      .mockResolvedValueOnce(openAiAnswer('{"count":"many"}'))
      .mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: '{"count":3}' }] } }] }));

    const result = await llmJson(z.object({ count: z.number() }), { system: "s", user: "u" });

    expect(result).toMatchObject({ ok: true, provider: "gemini", data: { count: 3 } });
    expect(result.attempts.map((a) => [a.provider, a.ok])).toEqual([
      ["openai", false],
      ["gemini", true],
    ]);
  });
});
