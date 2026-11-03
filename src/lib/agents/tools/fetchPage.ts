/**
 * Fetches public web pages and JSON for company profiling. Target URLs come
 * from search results and company websites, so every hop is checked against
 * SSRF: only http(s) on default ports, no IP literals or internal names, and
 * the resolved addresses must be public. Bodies are size- and time-limited.
 */

import { lookup, resolveMx } from "node:dns/promises";
import { isIP } from "node:net";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; RevGenIQ-Research/1.0; +https://revgeniq.com)";

export interface FetchedPage {
  url: string;
  status: number;
  contentType: string;
  headers: Record<string, string>;
  body: string;
}

export type FetchResult = { ok: true; page: FetchedPage } | { ok: false; code: "BLOCKED_URL" | "HTTP_ERROR" | "NETWORK_ERROR" | "TOO_LARGE"; message: string };

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

/** Reason a URL may not be fetched, or null when it is a public http(s) address. */
export async function blockedReason(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Invalid URL";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Only http(s) URLs are fetched";
  if (url.port && url.port !== "80" && url.port !== "443") return "Non-default port";
  if (url.username || url.password) return "Credentials in URL";
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host)) return "IP-literal hosts are not fetched";
  if (host === "localhost" || /\.(local|internal|localhost|lan|home|corp)$/.test(host) || !host.includes(".")) {
    return "Internal host";
  }
  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) return "Host resolves to a private address";
  } catch {
    return "Host does not resolve";
  }
  return null;
}

async function readLimited(res: Response): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

/** GETs a public URL, following up to three redirects that each pass the SSRF check. */
export async function fetchPublic(rawUrl: string, accept = "text/html,application/json;q=0.9,*/*;q=0.5"): Promise<FetchResult> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const blocked = await blockedReason(current);
    if (blocked) return { ok: false, code: "BLOCKED_URL", message: `${blocked}: ${current}` };
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "en" },
      });
    } catch (e) {
      return { ok: false, code: "NETWORK_ERROR", message: e instanceof Error ? e.message : String(e) };
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location") as string, current).toString();
      continue;
    }
    if (!res.ok) return { ok: false, code: "HTTP_ERROR", message: `HTTP ${res.status} for ${current}` };
    const body = await readLimited(res);
    if (body === null) return { ok: false, code: "TOO_LARGE", message: `Response over ${MAX_BYTES} bytes: ${current}` };
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    return { ok: true, page: { url: current, status: res.status, contentType: res.headers.get("content-type") || "", headers, body } };
  }
  return { ok: false, code: "HTTP_ERROR", message: `Too many redirects for ${rawUrl}` };
}

/** MX exchange hosts for a domain; empty when none or on lookup failure. */
export async function mxHosts(domain: string): Promise<string[]> {
  try {
    const records = await resolveMx(domain);
    return records.sort((a, b) => a.priority - b.priority).map((r) => r.exchange);
  } catch {
    return [];
  }
}
