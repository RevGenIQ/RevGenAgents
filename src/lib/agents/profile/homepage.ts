/**
 * Deterministic extraction from a company's own web pages: schema.org JSON-LD
 * (Organization), social profile links, tel:/mailto: links and meta tags.
 * No LLM is involved, so every value is exactly what the page says.
 */

import type { CompanyProfile, ProfileField } from "./types";

const ORG_TYPES = new Set(["organization", "corporation", "localbusiness", "onlinebusiness", "company", "ngo", "educationalorganization"]);

function field(value: unknown, sourceUrl: string): ProfileField | undefined {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return text ? { value: text.slice(0, 500), sourceUrl, method: "website" } : undefined;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function metaContent(html: string, name: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
    "i"
  );
  const m = re.exec(html);
  return decodeEntities((m?.[1] ?? m?.[2] ?? "").trim());
}

/** Flattens JSON-LD blocks (including @graph arrays) into individual objects. */
export function jsonLdObjects(html: string): Record<string, unknown>[] {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks.flatMap((b) => {
    try {
      const parsed: unknown = JSON.parse(b[1].trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const graph = (item as { "@graph"?: unknown })["@graph"];
        return Array.isArray(graph) ? (graph as Record<string, unknown>[]) : [item as Record<string, unknown>];
      });
    } catch {
      return [];
    }
  });
}

function isOrg(o: Record<string, unknown>): boolean {
  const t = o["@type"];
  const types = (Array.isArray(t) ? t : [t]).map((x) => String(x || "").toLowerCase());
  return types.some((x) => ORG_TYPES.has(x));
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href=["']([^"'#][^"']*)["']/gi)].map((m) => decodeEntities(m[1].trim()));
}

/** Company (not personal) social profile URLs. */
export function socialLinks(urls: string[]): { linkedin?: string; facebook?: string; twitter?: string } {
  const pick = (re: RegExp) => urls.find((u) => re.test(u));
  return {
    linkedin: pick(/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/(company|school|showcase)\/[^/?#]+/i),
    facebook: pick(/^https?:\/\/(www\.|m\.)?facebook\.com\/(?!sharer|share|dialog|plugins|tr\b)[^/?#]+/i),
    twitter: pick(/^https?:\/\/(www\.)?(twitter|x)\.com\/(?!intent|share|home|search|hashtag)[A-Za-z0-9_]{1,15}\/?$/i),
  };
}

function cleanSocial(url: string | undefined): string | undefined {
  return url ? url.split(/[?#]/)[0].replace(/\/+$/, "") : undefined;
}

/** Extracts every deterministic profile field from one page of the company's site. */
export function parseCompanyPage(html: string, pageUrl: string): CompanyProfile {
  const orgs = jsonLdObjects(html).filter(isOrg);
  const org = orgs[0] || {};
  const address = (org.address && typeof org.address === "object" ? org.address : {}) as Record<string, unknown>;
  const links = hrefs(html);
  const sameAs = Array.isArray(org.sameAs) ? (org.sameAs as unknown[]).map(String) : typeof org.sameAs === "string" ? [org.sameAs] : [];
  const social = socialLinks([...sameAs, ...links]);

  const tel = links.find((h) => /^tel:/i.test(h))?.replace(/^tel:/i, "").replace(/\s+/g, " ").trim();
  const mail = links
    .find((h) => /^mailto:/i.test(h))
    ?.replace(/^mailto:/i, "")
    .split("?")[0]
    .trim();

  const founded = String(org.foundingDate || "").match(/\b(1[89]\d{2}|20\d{2})\b/)?.[1];
  const employees = (org.numberOfEmployees && typeof org.numberOfEmployees === "object"
    ? (org.numberOfEmployees as Record<string, unknown>).value
    : org.numberOfEmployees) as unknown;
  const city = address.addressLocality;
  const region = address.addressRegion;
  const country = typeof address.addressCountry === "object" && address.addressCountry
    ? (address.addressCountry as Record<string, unknown>).name
    : address.addressCountry;
  const hq = [address.streetAddress, city, region, country].filter((x) => typeof x === "string" && x.trim()).join(", ");
  const keywords = metaContent(html, "keywords");

  const profile: CompanyProfile = {
    description: field(org.description || metaContent(html, "description") || metaContent(html, "og:description"), pageUrl),
    linkedinUrl: field(cleanSocial(social.linkedin), pageUrl),
    facebookUrl: field(cleanSocial(social.facebook), pageUrl),
    twitterUrl: field(cleanSocial(social.twitter), pageUrl),
    phone: field(org.telephone || tel, pageUrl),
    email: field(org.email ? String(org.email).replace(/^mailto:/i, "") : mail, pageUrl),
    foundedYear: field(founded, pageUrl),
    employeeCount: field(employees, pageUrl),
    city: field(city, pageUrl),
    state: field(region, pageUrl),
    country: field(country, pageUrl),
    hqLocation: field(hq, pageUrl),
    keywords: field(keywords, pageUrl),
  };
  return Object.fromEntries(Object.entries(profile).filter(([, v]) => v)) as CompanyProfile;
}

/** Visible text of a page (scripts, styles and tags removed), for LLM extraction and quote checks. */
export function pageText(html: string, maxChars = 6000): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

/** Same-site links that usually hold company facts (about, contact, careers). */
export function discoverInfoPages(html: string, baseUrl: string): { about?: string; contact?: string; careers?: string } {
  const base = new URL(baseUrl);
  const internal = hrefs(html)
    .map((h) => {
      try {
        return new URL(h, base);
      } catch {
        return null;
      }
    })
    .filter((u): u is URL => !!u && u.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, ""));
  const find = (re: RegExp) => internal.find((u) => re.test(u.pathname))?.toString();
  return {
    about: find(/^\/(about|about-us|company|who-we-are)\/?$/i),
    contact: find(/^\/(contact|contact-us)\/?$/i),
    careers: find(/^\/(careers|jobs|join-us|work-with-us)\/?$/i),
  };
}
