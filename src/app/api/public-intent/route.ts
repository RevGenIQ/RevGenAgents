import { NextResponse } from "next/server";

export interface PublicIntentItem {
  id: string;
  company: string;
  domain: string;
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

function extractXmlTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  if (!match) return "";
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function GET() {
  const items: PublicIntentItem[] = [];

  // 1. Live Product Launches Feed
  try {
    const phRes = await fetch("https://www.producthunt.com/feed", {
      headers: {
        "User-Agent": "RevGenAI-IntentStream/1.0",
        Accept: "application/atom+xml,application/xml,text/xml",
      },
      next: { revalidate: 180 },
    });

    if (phRes.ok) {
      const xml = await phRes.text();
      const entries = xml.split("<entry>").slice(1, 7);
      entries.forEach((entry, idx) => {
        const rawTitle = extractXmlTag(entry, "title");
        const content =
          extractXmlTag(entry, "content") || extractXmlTag(entry, "summary");
        const published =
          extractXmlTag(entry, "published") || new Date().toISOString();
        const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/i);
        const url = linkMatch ? linkMatch[1] : "https://www.producthunt.com";

        const [companyPart, ...rest] = rawTitle.split(" - ");
        const companyName = (
          companyPart ||
          rawTitle ||
          `Enterprise #${idx + 1}`
        ).trim();
        const tagline =
          rest.join(" - ").trim() ||
          content.slice(0, 130) ||
          "New product release signaling active GTM & engineering expansion.";
        const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const domain = `${slug || "company"}.com`;

        items.push({
          id: `launch-${idx}-${slug}`,
          company: companyName,
          domain,
          logoUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
          linkedinUrl: `https://www.linkedin.com/company/${slug}/`,
          title: tagline.slice(0, 95),
          signalType: "Product Launch",
          intentScore: 89 + ((idx * 2) % 9),
          summary: tagline.slice(0, 145),
          url,
          publishedAt: published,
          category: "Product Release",
        });
      });
    }
  } catch {
    // ignore
  }

  // 2. Live Hiring & Expansion Stream
  try {
    const hnRes = await fetch(
      "https://hacker-news.firebaseio.com/v0/jobstories.json",
      {
        next: { revalidate: 180 },
      }
    );
    if (hnRes.ok) {
      const ids: number[] = await hnRes.json();
      const topIds = (ids || []).slice(0, 4);
      const stories = await Promise.all(
        topIds.map(async (id) => {
          const r = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`
          );
          return r.ok ? r.json() : null;
        })
      );

      stories.filter(Boolean).forEach((story: any, idx: number) => {
        const rawTitle: string = story.title || "Engineering Expansion";
        const companyMatch = rawTitle.match(
          /^([A-Za-z0-9.\s-]+?)\s+(?:\(YC[^)]*\)\s+)?is hiring/i
        );
        const company = companyMatch
          ? companyMatch[1].trim()
          : rawTitle.split(" ")[0];
        const slug = company.toLowerCase().replace(/[^a-z0-9]/g, "");
        const domain = `${slug || "tech"}.com`;

        items.push({
          id: `hire-${story.id || idx}`,
          company,
          domain,
          logoUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
          linkedinUrl: `https://www.linkedin.com/company/${slug}/`,
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
        });
      });
    }
  } catch {
    // ignore
  }

  // 3. Live Cloud & SaaS Engineering Stream
  try {
    const devRes = await fetch(
      "https://dev.to/api/articles?tag=cloud&per_page=3",
      {
        next: { revalidate: 300 },
      }
    );
    if (devRes.ok) {
      const articles: any[] = await devRes.json();
      articles.forEach((art, idx) => {
        const orgName =
          art.organization?.name || art.user?.name || "Cloud Platform";
        const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const domain = `${slug || "cloud"}.io`;
        items.push({
          id: `stack-${art.id || idx}`,
          company: orgName,
          domain,
          logoUrl:
            art.organization?.profile_image_90 ||
            `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
          linkedinUrl: `https://www.linkedin.com/company/${slug}/`,
          title: art.title,
          signalType: "Tech Stack Shift",
          intentScore: 86 + idx,
          summary:
            art.description ||
            "Engineering team publishing new cloud architecture & stack migration initiatives.",
          url: art.url || "https://dev.to",
          publishedAt: art.published_at || new Date().toISOString(),
          category: "Architecture Shift",
        });
      });
    }
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    updatedAt: new Date().toISOString(),
    items: items.slice(0, 9),
  });
}
