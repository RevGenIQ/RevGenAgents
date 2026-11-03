import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { extractXmlTag, feedFragmentToText, hostFromUrl } from "@/lib/feed-text";

export type PublicIntentPlatformId = "producthunt" | "hackernews" | "devto";

export interface PublicIntentItem {
  id: string;
  platform: PublicIntentPlatformId;
  company: string;
  /** Real company host when known; empty string lets the UI show initials. */
  domain: string;
  /** Direct logo image supplied by the source, if any. */
  logoUrl: string;
  linkedinUrl: string;
  title: string;
  signalType:
    | "Product Launch"
    | "Hiring Expansion"
    | "Tech Stack Shift"
    | "Capital & Expansion"
    | "Infrastructure Scale";
  intentScore: number;
  summary: string;
  url: string;
  publishedAt: string;
  category: string;
}

export interface PublicIntentPlatform {
  id: PublicIntentPlatformId;
  label: string;
  items: PublicIntentItem[];
}

const MAX_ITEMS_PER_PLATFORM = 6;
const UPSTREAM_TIMEOUT_MS = 8000;

/** Hosts that belong to the feed itself, never to the company being shown. */
const PLATFORM_HOSTS = new Set([
  "producthunt.com",
  "news.ycombinator.com",
  "ycombinator.com",
  "dev.to",
  "github.com",
  "medium.com",
]);

function companyDomainFromUrl(url?: string | null): string {
  const host = hostFromUrl(url);
  return host && !PLATFORM_HOSTS.has(host) ? host : "";
}

function linkedinSearchUrl(company: string): string {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company)}`;
}

async function fetchProductHunt(): Promise<PublicIntentItem[]> {
  const res = await fetch("https://www.producthunt.com/feed", {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: {
      "User-Agent": "RevGenAI-IntentStream/1.0",
      Accept: "application/atom+xml,application/xml,text/xml",
    },
    next: { revalidate: 180 },
  });
  if (!res.ok) return [];

  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1, MAX_ITEMS_PER_PLATFORM + 1);
  return entries.map((entry, idx) => {
    const rawTitle = extractXmlTag(entry, "title");
    // Product Hunt appends "Discussion | Link" anchors to every description.
    const content = (
      extractXmlTag(entry, "content") || extractXmlTag(entry, "summary")
    ).replace(/\s*Discussion\s*\|\s*Link\s*$/i, "");
    const published =
      extractXmlTag(entry, "published") || new Date().toISOString();
    const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/i);
    const url = linkMatch ? linkMatch[1] : "https://www.producthunt.com";

    const [companyPart, ...rest] = rawTitle.split(" - ");
    const company = (companyPart || rawTitle || `Launch #${idx + 1}`).trim();
    const tagline =
      rest.join(" - ").trim() ||
      content.slice(0, 130) ||
      "New product release signaling active GTM & engineering expansion.";

    return {
      id: `launch-${idx}-${company.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      platform: "producthunt",
      company,
      domain: companyDomainFromUrl(url),
      logoUrl: "",
      linkedinUrl: linkedinSearchUrl(company),
      title: tagline.slice(0, 95),
      signalType: "Product Launch",
      intentScore: 89 + ((idx * 2) % 9),
      summary:
        content && content !== tagline
          ? content.slice(0, 145)
          : "New launch on Product Hunt, a signal of active GTM and product investment.",
      url,
      publishedAt: published,
      category: "Product Release",
    };
  });
}

interface HackerNewsStory {
  id?: number;
  title?: string;
  url?: string;
  time?: number;
}

async function fetchHackerNewsJobs(): Promise<PublicIntentItem[]> {
  const res = await fetch(
    "https://hacker-news.firebaseio.com/v0/jobstories.json",
    { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), next: { revalidate: 180 } }
  );
  if (!res.ok) return [];

  const ids: number[] = await res.json();
  const stories = await Promise.all(
    (ids || []).slice(0, MAX_ITEMS_PER_PLATFORM).map(async (id) => {
      const r = await fetch(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
        { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), next: { revalidate: 180 } }
      );
      return r.ok ? ((await r.json()) as HackerNewsStory | null) : null;
    })
  );

  return stories
    .filter((story): story is HackerNewsStory => Boolean(story))
    .map((story, idx) => {
      const rawTitle = feedFragmentToText(story.title || "Engineering Expansion");
      const companyMatch = rawTitle.match(
        /^([A-Za-z0-9.\s-]+?)\s+(?:\(YC[^)]*\)\s+)?is hiring/i
      );
      const company = companyMatch
        ? companyMatch[1].trim()
        : rawTitle.split(" ")[0];

      return {
        id: `hire-${story.id ?? idx}`,
        platform: "hackernews",
        company,
        domain: companyDomainFromUrl(story.url),
        logoUrl: "",
        linkedinUrl: linkedinSearchUrl(company),
        title: rawTitle.replace(/\(YC[^)]*\)\s*/gi, ""),
        signalType: "Hiring Expansion",
        intentScore: 92 - idx,
        summary:
          "Active engineering & GTM headcount expansion signaling new tooling and infrastructure budget.",
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        publishedAt: story.time
          ? new Date(story.time * 1000).toISOString()
          : new Date().toISOString(),
        category: "Hiring Spike",
      };
    });
}

interface DevToArticle {
  id?: number;
  title?: string;
  description?: string;
  url?: string;
  canonical_url?: string;
  published_at?: string;
  organization?: { name?: string; profile_image_90?: string };
  user?: { name?: string; profile_image_90?: string };
}

async function fetchDevTo(): Promise<PublicIntentItem[]> {
  const res = await fetch(
    `https://dev.to/api/articles?tag=cloud&per_page=${MAX_ITEMS_PER_PLATFORM}`,
    { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), next: { revalidate: 300 } }
  );
  if (!res.ok) return [];

  const articles: DevToArticle[] = await res.json();
  return articles.slice(0, MAX_ITEMS_PER_PLATFORM).map((art, idx) => {
    const company = art.organization?.name || art.user?.name || "Cloud Platform";
    return {
      id: `stack-${art.id ?? idx}`,
      platform: "devto",
      company,
      domain: companyDomainFromUrl(art.canonical_url),
      logoUrl: art.organization?.profile_image_90 || "",
      linkedinUrl: linkedinSearchUrl(company),
      title: feedFragmentToText(art.title || "Architecture update"),
      signalType: "Tech Stack Shift",
      intentScore: 86 + (idx % 6),
      summary: feedFragmentToText(
        art.description ||
          "Engineering team publishing new cloud architecture & stack migration initiatives."
      ),
      url: art.url || "https://dev.to",
      publishedAt: art.published_at || new Date().toISOString(),
      category: "Architecture Shift",
    };
  });
}

async function settle(
  load: () => Promise<PublicIntentItem[]>
): Promise<PublicIntentItem[]> {
  try {
    return await load();
  } catch {
    // A single upstream outage should not blank the whole feed.
    return [];
  }
}

export async function GET(request: NextRequest) {
  // Public endpoint that fans out to three third-party feeds: throttle per IP.
  const rl = rateLimit(request, { max: 30, windowMs: 60 * 1000, prefix: "public_intent" });
  if (!rl.allowed && rl.response) return rl.response;

  const [productHunt, hackerNews, devTo] = await Promise.all([
    settle(fetchProductHunt),
    settle(fetchHackerNewsJobs),
    settle(fetchDevTo),
  ]);

  const platforms: PublicIntentPlatform[] = [
    { id: "producthunt", label: "Product Hunt", items: productHunt },
    { id: "hackernews", label: "Hacker News", items: hackerNews },
    { id: "devto", label: "dev.to", items: devTo },
  ];

  return NextResponse.json({
    ok: true,
    updatedAt: new Date().toISOString(),
    platforms,
    items: platforms.flatMap((p) => p.items),
  });
}
