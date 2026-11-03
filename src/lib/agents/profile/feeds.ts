/**
 * Free, dated signal feeds:
 * - Google News RSS for news, funding and partnership mentions.
 * - Public job-board JSON (Greenhouse, Lever, Ashby) for hiring signals.
 * - HN Algolia for social / launch mentions.
 * Parsers are pure; the node fetches the URLs these helpers build.
 */

export interface FeedItem {
  title: string;
  url: string;
  publishedDate: string | null;
  source: string;
}

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return m ? decode(m[1]) : "";
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function googleNewsUrl(companyName: string, terms: string[]): string {
  const q = `"${companyName}"${terms.length ? ` (${terms.map((t) => `"${t}"`).join(" OR ")})` : ""}`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;
}

/** Items from a Google News RSS document. Titles end with " - Publisher", which becomes `source`. */
export function parseNewsRss(xml: string, limit = 10): FeedItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, limit).map((m) => {
    const raw = tag(m[1], "title");
    const publisher = tag(m[1], "source");
    const title = publisher && raw.endsWith(` - ${publisher}`) ? raw.slice(0, -publisher.length - 3) : raw;
    return { title, url: tag(m[1], "link"), publishedDate: isoDate(tag(m[1], "pubDate")), source: publisher || "Google News" };
  }).filter((i) => i.title && /^https?:\/\//.test(i.url));
}

export type JobBoard = { kind: "greenhouse" | "lever" | "ashby"; token: string };

/** Finds a Greenhouse, Lever or Ashby board token among a page's links. */
export function detectJobBoard(html: string): JobBoard | null {
  const gh = /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i.exec(html);
  if (gh && gh[1] !== "embed") return { kind: "greenhouse", token: gh[1] };
  const lever = /jobs\.lever\.co\/([a-z0-9_-]+)/i.exec(html);
  if (lever) return { kind: "lever", token: lever[1] };
  const ashby = /jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/i.exec(html);
  if (ashby) return { kind: "ashby", token: ashby[1] };
  return null;
}

export function jobBoardApiUrl(board: JobBoard): string {
  const t = encodeURIComponent(board.token);
  if (board.kind === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${t}/jobs`;
  if (board.kind === "lever") return `https://api.lever.co/v0/postings/${t}?mode=json`;
  return `https://api.ashbyhq.com/posting-api/job-board/${t}`;
}

export interface JobPosting {
  title: string;
  url: string;
  location: string;
  postedDate: string | null;
  department: string;
}

/** Normalises the three boards' JSON shapes into postings. */
export function parseJobBoard(board: JobBoard, json: unknown): JobPosting[] {
  const asList = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  if (board.kind === "greenhouse") {
    return asList((json as { jobs?: unknown })?.jobs).map((j) => ({
      title: str(j.title),
      url: str(j.absolute_url),
      location: str((j.location as { name?: string })?.name),
      postedDate: isoDate(str(j.updated_at) || str(j.first_published)),
      department: str(asList(j.departments)[0]?.name),
    }));
  }
  if (board.kind === "lever") {
    return asList(json).map((j) => ({
      title: str(j.text),
      url: str(j.hostedUrl),
      location: str((j.categories as { location?: string })?.location),
      postedDate: typeof j.createdAt === "number" ? new Date(j.createdAt).toISOString().slice(0, 10) : null,
      department: str((j.categories as { team?: string })?.team),
    }));
  }
  return asList((json as { jobs?: unknown })?.jobs).map((j) => ({
    title: str(j.title),
    url: str(j.jobUrl),
    location: str(j.location),
    postedDate: isoDate(str(j.publishedAt)),
    department: str(j.department),
  }));
}

export function hnSearchUrl(companyName: string): string {
  return `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(`"${companyName}"`)}&tags=story&hitsPerPage=10`;
}

/** HN stories that actually name the company in their title. */
export function parseHnSearch(json: unknown, companyName: string): FeedItem[] {
  const hits = Array.isArray((json as { hits?: unknown })?.hits) ? ((json as { hits: Record<string, unknown>[] }).hits) : [];
  const name = companyName.toLowerCase();
  return hits
    .filter((h) => typeof h.title === "string" && (h.title as string).toLowerCase().includes(name))
    .map((h) => ({
      title: String(h.title),
      url: `https://news.ycombinator.com/item?id=${String(h.objectID)}`,
      publishedDate: isoDate(String(h.created_at || "")),
      source: "Hacker News",
    }));
}
