/**
 * LLM provider registry. Every provider is configured from the environment, so
 * adding a model is a matter of setting a key — no code change:
 *
 *   - Built-in presets: set the key (e.g. DEEPSEEK_API_KEY) and optionally
 *     <ID>_MODEL / <ID>_BASE_URL.
 *   - Any other OpenAI-compatible API: set LLM_<NAME>_BASE_URL,
 *     LLM_<NAME>_API_KEY and LLM_<NAME>_MODEL.
 *
 * LLM_PROVIDER_ORDER (comma-separated ids) sets the fallback order; configured
 * providers it does not mention are tried after the listed ones.
 */

export type ProviderKind = "openai-compatible" | "gemini" | "anthropic";

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  apiKey: string;
  model: string;
  baseUrl: string;
  /** Send `response_format: json_object` (OpenAI-compatible APIs that support it). */
  jsonMode: boolean;
  headers: Record<string, string>;
}

interface Preset {
  id: string;
  kind: ProviderKind;
  keyEnv: string;
  baseUrl: string;
  /** Empty when the provider has no sensible default: <ID>_MODEL is then required. */
  defaultModel: string;
  jsonMode: boolean;
}

/** Default fallback order: the paid providers first, then free/open-model hosts. */
export const PRESETS: readonly Preset[] = [
  { id: "openai", kind: "openai-compatible", keyEnv: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", jsonMode: true },
  { id: "gemini", kind: "gemini", keyEnv: "GEMINI_API_KEY", baseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-flash-latest", jsonMode: true },
  { id: "anthropic", kind: "anthropic", keyEnv: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-haiku-5-5", jsonMode: false },
  { id: "groq", kind: "openai-compatible", keyEnv: "GROQ_API_KEY", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "openai/gpt-oss-120b", jsonMode: true },
  { id: "xai", kind: "openai-compatible", keyEnv: "XAI_API_KEY", baseUrl: "https://api.x.ai/v1", defaultModel: "", jsonMode: true },
  { id: "deepseek", kind: "openai-compatible", keyEnv: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat", jsonMode: true },
  { id: "mistral", kind: "openai-compatible", keyEnv: "MISTRAL_API_KEY", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-small-latest", jsonMode: true },
  { id: "openrouter", kind: "openai-compatible", keyEnv: "OPENROUTER_API_KEY", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "", jsonMode: false },
  { id: "together", kind: "openai-compatible", keyEnv: "TOGETHER_API_KEY", baseUrl: "https://api.together.xyz/v1", defaultModel: "", jsonMode: false },
];

type Env = Record<string, string | undefined>;

const CUSTOM_BASE_URL = /^LLM_([A-Z0-9_]+)_BASE_URL$/;
const PLACEHOLDER = /^(your_|change_me|xxx)/i;

function read(env: Env, name: string): string {
  const value = (env[name] || "").trim();
  return PLACEHOLDER.test(value) ? "" : value;
}

export interface ResolvedProviders {
  providers: ProviderConfig[];
  /** Providers that have a key but cannot be used, with the reason. */
  skipped: Array<{ id: string; reason: string }>;
}

/** https anywhere, plain http only to a local model server: keys never travel in clear text. */
function isSafeBaseUrl(url: string): boolean {
  return /^https:\/\//.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
}

function fromPreset(env: Env, p: Preset): ProviderConfig | { skip: string } | null {
  const apiKey = read(env, p.keyEnv);
  if (!apiKey) return null;
  const prefix = p.id.toUpperCase();
  const model = read(env, `${prefix}_MODEL`) || p.defaultModel;
  if (!model) return { skip: `${prefix}_MODEL is required for ${p.id}.` };
  const baseUrl = (read(env, `${prefix}_BASE_URL`) || p.baseUrl).replace(/\/+$/, "");
  if (!isSafeBaseUrl(baseUrl)) return { skip: `${prefix}_BASE_URL must be https (or http://localhost).` };
  const headers: Record<string, string> = {};
  const workspace = p.id === "anthropic" ? read(env, "ANTHROPIC_WORKSPACE_ID") : "";
  if (workspace) headers["anthropic-workspace-id"] = workspace;
  return {
    id: p.id,
    kind: p.kind,
    apiKey,
    model,
    baseUrl,
    jsonMode: p.jsonMode,
    headers,
  };
}

function fromCustom(env: Env, name: string): ProviderConfig | { skip: string } {
  const baseUrl = read(env, `LLM_${name}_BASE_URL`).replace(/\/+$/, "");
  const apiKey = read(env, `LLM_${name}_API_KEY`);
  const model = read(env, `LLM_${name}_MODEL`);
  const id = name.toLowerCase();
  if (!isSafeBaseUrl(baseUrl)) {
    return { skip: `LLM_${name}_BASE_URL must be https (or http://localhost for a local model).` };
  }
  if (!apiKey) return { skip: `LLM_${name}_API_KEY is not set.` };
  if (!model) return { skip: `LLM_${name}_MODEL is not set.` };
  return {
    id,
    kind: "openai-compatible",
    apiKey,
    model,
    baseUrl,
    jsonMode: read(env, `LLM_${name}_JSON_MODE`).toLowerCase() === "true",
    headers: {},
  };
}

/** Resolves every usable provider from the environment, in fallback order. */
export function resolveProviders(env: Env = process.env): ResolvedProviders {
  const found: ProviderConfig[] = [];
  const skipped: ResolvedProviders["skipped"] = [];
  const collect = (id: string, result: ProviderConfig | { skip: string } | null) => {
    if (!result) return;
    if ("skip" in result) skipped.push({ id, reason: result.skip });
    else found.push(result);
  };

  for (const preset of PRESETS) collect(preset.id, fromPreset(env, preset));
  const presetIds = new Set(PRESETS.map((p) => p.id));
  for (const name of Object.keys(env)) {
    const match = CUSTOM_BASE_URL.exec(name);
    if (!match || presetIds.has(match[1].toLowerCase())) continue;
    collect(match[1].toLowerCase(), fromCustom(env, match[1]));
  }

  const order = read(env, "LLM_PROVIDER_ORDER")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  // Array.prototype.sort is stable, so unlisted providers keep the preset order.
  const providers = [...found].sort((a, b) => rank(a.id) - rank(b.id));
  return { providers, skipped };
}
