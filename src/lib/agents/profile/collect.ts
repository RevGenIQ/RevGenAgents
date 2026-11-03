/**
 * Network collectors for profileCompany. Each returns sourced profile fields
 * and/or dated signals and never throws: a source that fails simply
 * contributes nothing, and the node records which sources answered.
 */

import type { AgentTools, FetchedDocument } from "../deps";
import type { EvidenceSignal } from "../types";
import { isWithinWindow } from "../tools/webSearch";
import { detectJobBoard, googleNewsUrl, hnSearchUrl, jobBoardApiUrl, parseHnSearch, parseJobBoard, parseNewsRss, type FeedItem } from "./feeds";
import { discoverInfoPages, pageText, parseCompanyPage } from "./homepage";
import { detectTech, emailProviderFromMx } from "./techStack";
import type { CompanyProfile } from "./types";
import { labelsFrom, matchEntity, searchResultIds, wikidataEntitiesUrl, wikidataSearchUrl } from "./wikidata";

export interface SourceDoc {
  url: string;
  text: string;
}

async function get(tools: AgentTools, url: string): Promise<FetchedDocument | null> {
  const res = await tools.fetchPage(url);
  return res.ok ? res.value : null;
}

async function getJson(tools: AgentTools, url: string): Promise<unknown> {
  const doc = await get(tools, url);
  if (!doc) return null;
  try {
    return JSON.parse(doc.body);
  } catch {
    return null;
  }
}

export interface WebsiteFindings {
  profile: CompanyProfile;
  docs: SourceDoc[];
  /** HTML pages kept for job-board detection. */
  html: string[];
}

/** Homepage plus about/contact pages: deterministic fields, tech stack and page text for the LLM. */
export async function collectWebsite(tools: AgentTools, domain: string): Promise<WebsiteFindings> {
  const home = (await get(tools, `https://${domain}/`)) || (await get(tools, `https://www.${domain}/`));
  if (!home) return { profile: {}, docs: [], html: [] };

  const links = discoverInfoPages(home.body, home.url);
  const extra = (await Promise.all([links.about, links.contact, links.careers].filter(Boolean).map((u) => get(tools, u as string))))
    .filter((d): d is FetchedDocument => !!d);
  const pages = [home, ...extra];

  const mx = await tools.lookupMx(domain);
  const emailPlatform = emailProviderFromMx(mx);
  const tech = [...detectTech(home.body, home.headers).map((t) => t.name), ...(emailPlatform ? [emailPlatform] : [])];

  const fromPages = pages.map((p) => parseCompanyPage(p.body, p.url));
  const base: CompanyProfile = {
    website: { value: `https://${domain}`, sourceUrl: home.url, method: "website" },
    ...(tech.length ? { techStack: { value: tech.join(", "), sourceUrl: home.url, method: "detected" as const } } : {}),
  };
  const profile = [base, ...fromPages].reduce<CompanyProfile>((acc, p) => ({ ...p, ...acc }), {});
  return {
    profile,
    docs: pages.map((p) => ({ url: p.url, text: pageText(p.body, 3000) })),
    html: pages.map((p) => p.body),
  };
}

function feedSignal(item: FeedItem, signalType: string): EvidenceSignal | null {
  if (!item.publishedDate) return null;
  return { signalType, title: item.title, quote: item.title, sourceUrl: item.url, sourceDate: item.publishedDate };
}

/** Hiring signal from a public Greenhouse / Lever / Ashby board linked on the site. */
export async function collectHiring(tools: AgentTools, html: string[], windowDays: number, now: Date): Promise<EvidenceSignal[]> {
  const board = html.map(detectJobBoard).find(Boolean);
  if (!board) return [];
  const json = await getJson(tools, jobBoardApiUrl(board));
  const recent = parseJobBoard(board, json)
    .filter((j) => j.title && j.url && j.postedDate && isWithinWindow(j.postedDate, windowDays, now))
    .sort((a, b) => (b.postedDate || "").localeCompare(a.postedDate || ""));
  if (recent.length === 0) return [];
  const names = recent.slice(0, 3).map((j) => j.title).join(", ");
  return [
    {
      signalType: "hiring",
      title: `Hiring: ${recent.length} open role${recent.length === 1 ? "" : "s"} (${names})`,
      quote: recent[0].title,
      sourceUrl: recent[0].url,
      sourceDate: recent[0].postedDate as string,
    },
  ];
}

/** Dated news (Google News RSS) and social (Hacker News) items that name the company. */
export async function collectNewsAndSocial(
  tools: AgentTools,
  companyName: string,
  terms: string[],
  windowDays: number,
  now: Date
): Promise<EvidenceSignal[]> {
  const name = companyName.toLowerCase();
  const [rss, hn] = await Promise.all([get(tools, googleNewsUrl(companyName, terms.slice(0, 4))), getJson(tools, hnSearchUrl(companyName))]);
  const news = (rss ? parseNewsRss(rss.body, 15) : [])
    .filter((i) => i.title.toLowerCase().includes(name))
    .slice(0, 3)
    .map((i) => feedSignal(i, /fund|rais|series|invest|acqui|partner/i.test(i.title) ? "funding / partnership" : "news"));
  const social = parseHnSearch(hn, companyName).slice(0, 2).map((i) => feedSignal(i, "social mention"));
  return [...news, ...social].filter((s): s is EvidenceSignal => !!s && isWithinWindow(s.sourceDate, windowDays, now));
}

/** Registry firmographics from Wikidata, only for an entity whose website is this domain. */
export async function collectWikidata(tools: AgentTools, companyName: string, domain: string): Promise<CompanyProfile> {
  const ids = searchResultIds(await getJson(tools, wikidataSearchUrl(companyName)));
  if (ids.length === 0) return {};
  const match = matchEntity(await getJson(tools, wikidataEntitiesUrl(ids)), domain);
  if (!match) return {};
  const labelIds = [...match.pendingLabels.hq, ...match.pendingLabels.industry];
  if (labelIds.length === 0) return match.profile;
  const labels = await getJson(tools, wikidataEntitiesUrl(labelIds, "labels"));
  const source = `https://www.wikidata.org/wiki/${match.id}`;
  const hq = labelsFrom(labels, match.pendingLabels.hq)[0];
  const industry = labelsFrom(labels, match.pendingLabels.industry).join(", ");
  return {
    ...match.profile,
    ...(hq ? { hqLocation: { value: hq, sourceUrl: source, method: "registry" as const } } : {}),
    ...(industry ? { industry: { value: industry, sourceUrl: source, method: "registry" as const } } : {}),
  };
}
