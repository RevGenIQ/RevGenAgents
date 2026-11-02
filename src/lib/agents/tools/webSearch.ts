/**
 * ICP-agnostic web search: Brave Search first, Tavily Search as fallback,
 * plus Tavily Extract for pages whose snippet is too thin to quote from.
 * The source-rejection and recency filters are ported from adapters/research.ts;
 * the queries themselves always come from the caller (planQueries), never from here.
 */

import type { SourceSnippet } from "../types";

const SEARCH_TIMEOUT_MS = 20_000;
const EXTRACT_TIMEOUT_MS = 25_000;
const MAX_EXTRACT_CHARS = 4_000;

export type SearchProvider = "brave" | "tavily";

export type WebSearchResult =
  | { ok: true; provider: SearchProvider; hits: SourceSnippet[]; calls: Record<SearchProvider, number> }
  | { ok: false; code: "NO_PROVIDER" | "PROVIDER_ERROR"; message: string; calls: Record<SearchProvider, number> };

export type ExtractResult =
  | { ok: true; pages: Array<{ url: string; content: string }> }
  | { ok: false; code: "NO_PROVIDER" | "PROVIDER_ERROR"; message: string };

/**
 * Rejects event/speaker pages, personal profiles, job boards and directories:
 * none of them are evidence that a company is in a buying window.
 */
export function isRejectedSource(url: string, title: string): boolean {
  const u = (url || "").toLowerCase();
  const t = (title || "").toLowerCase();
  if (
    u.includes("/speakers") ||
    u.includes("/agenda") ||
    u.includes("conference") ||
    u.includes("eventbrite")
  ) {
    return true;
  }
  if (t.includes("speaker") && (t.includes("congress") || t.includes("summit") || t.includes("conference"))) {
    return true;
  }
  if (u.includes("linkedin.com/in/")) return true; // personal profiles belong in findContacts
  if (
    u.includes("naukri.com") ||
    u.includes("indeed.com") ||
    u.includes("glassdoor.com") ||
    u.includes("monster.com")
  ) {
    return true;
  }
  if (
    u.includes("zoominfo.com") ||
    u.includes("yellowpages") ||
    u.includes("justdial") ||
    u.includes("indiamart")
  ) {
    return true;
  }
  return false;
}

/** Parses a date string; returns null when it is missing or not a real date. */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * True when the date is inside the window. Undated values pass here (search hits
 * are often undated); signals enforce a date separately.
 */
export function isWithinWindow(dateStr: string | null | undefined, windowDays: number, now: Date = new Date()): boolean {
  const d = parseDate(dateStr);
  if (!d) return true;
  const cutoff = new Date(now.getTime() - windowDays * 24 * 3600 * 1000);
  return d >= cutoff && d.getTime() <= now.getTime() + 24 * 3600 * 1000;
}

function cleanHits(hits: SourceSnippet[], windowDays: number): SourceSnippet[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (!h.url || !h.url.startsWith("http") || seen.has(h.url)) return false;
    seen.add(h.url);
    if (isRejectedSource(h.url, h.title)) return false;
    return isWithinWindow(h.publishedDate, windowDays);
  });
}

async function braveSearch(query: string, key: string, count: number): Promise<SourceSnippet[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: { Accept: "application/json", "X-Subscription-Token": key },
  });
  if (!res.ok) throw new Error(`Brave HTTP ${res.status}`);
  const data = await res.json();
  const results: unknown[] = Array.isArray(data?.web?.results) ? data.web.results : [];
  return results.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      url: String(r.url || ""),
      title: String(r.title || ""),
      content: String(r.description || ""),
      publishedDate: typeof r.page_age === "string" ? r.page_age : null,
    };
  });
}

async function tavilySearch(query: string, key: string, count: number): Promise<SourceSnippet[]> {
  const res = await fetch("https://api.tavily.com/search", {
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, search_depth: "advanced", max_results: count }),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const data = await res.json();
  const results: unknown[] = Array.isArray(data?.results) ? data.results : [];
  return results.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      url: String(r.url || ""),
      title: String(r.title || ""),
      content: String(r.content || ""),
      publishedDate: typeof r.published_date === "string" ? r.published_date : null,
    };
  });
}

/**
 * Runs one query. Brave is tried first; Tavily is used when Brave is not
 * configured, fails, or returns nothing usable.
 */
export async function webSearch(
  query: string,
  options: { count?: number; windowDays?: number } = {}
): Promise<WebSearchResult> {
  const braveKey = process.env.BRAVE_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;
  const count = options.count ?? 8;
  const windowDays = options.windowDays ?? 365;
  const calls: Record<SearchProvider, number> = { brave: 0, tavily: 0 };

  if (!braveKey && !tavilyKey) {
    return { ok: false, code: "NO_PROVIDER", message: "Neither BRAVE_API_KEY nor TAVILY_API_KEY is configured.", calls };
  }

  let lastError = "";
  if (braveKey) {
    try {
      calls.brave += 1;
      const hits = cleanHits(await braveSearch(query, braveKey, count), windowDays);
      if (hits.length > 0) return { ok: true, provider: "brave", hits, calls };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  if (tavilyKey) {
    try {
      calls.tavily += 1;
      const hits = cleanHits(await tavilySearch(query, tavilyKey, count), windowDays);
      return { ok: true, provider: "tavily", hits, calls };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  if (lastError) return { ok: false, code: "PROVIDER_ERROR", message: lastError, calls };
  return { ok: true, provider: "brave", hits: [], calls };
}

/** Fetches readable page text through Tavily Extract. */
export async function tavilyExtract(urls: string[]): Promise<ExtractResult> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    return { ok: false, code: "NO_PROVIDER", message: "TAVILY_API_KEY is not configured." };
  }
  const targets = urls.filter((u) => u.startsWith("http")).slice(0, 5);
  if (targets.length === 0) return { ok: true, pages: [] };

  try {
    const res = await fetch("https://api.tavily.com/extract", {
      signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tavilyKey}` },
      body: JSON.stringify({ urls: targets }),
    });
    if (!res.ok) {
      return { ok: false, code: "PROVIDER_ERROR", message: `Tavily Extract HTTP ${res.status}` };
    }
    const data = await res.json();
    const results: unknown[] = Array.isArray(data?.results) ? data.results : [];
    const pages = results
      .map((raw) => raw as Record<string, unknown>)
      .filter((r) => typeof r.url === "string" && typeof r.raw_content === "string")
      .map((r) => ({ url: String(r.url), content: String(r.raw_content).slice(0, MAX_EXTRACT_CHARS) }));
    return { ok: true, pages };
  } catch (e) {
    return { ok: false, code: "PROVIDER_ERROR", message: e instanceof Error ? e.message : String(e) };
  }
}
