/**
 * Wikidata (CC0) firmographics. An entity is accepted only when its official
 * website (P856) is on the company's domain, so a same-named company is never
 * mixed in. Item-valued claims (HQ, industry) need a second call for labels.
 */

import type { CompanyProfile, ProfileField } from "./types";

const API = "https://www.wikidata.org/w/api.php";

export function wikidataSearchUrl(companyName: string): string {
  return `${API}?action=wbsearchentities&format=json&language=en&type=item&limit=5&search=${encodeURIComponent(companyName)}`;
}

export function wikidataEntitiesUrl(ids: string[], props = "claims|labels"): string {
  return `${API}?action=wbgetentities&format=json&languages=en&props=${encodeURIComponent(props)}&ids=${ids.map(encodeURIComponent).join("|")}`;
}

export function searchResultIds(json: unknown): string[] {
  const list = (json as { search?: Array<{ id?: unknown }> })?.search;
  return Array.isArray(list) ? list.map((s) => String(s.id || "")).filter((id) => /^Q\d+$/.test(id)) : [];
}

type Claims = Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;

function claimValues(claims: Claims, prop: string): unknown[] {
  return (claims[prop] || []).map((c) => c.mainsnak?.datavalue?.value).filter((v) => v !== undefined);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export interface WikidataMatch {
  id: string;
  profile: CompanyProfile;
  /** Item ids whose English labels are still needed: HQ and industry. */
  pendingLabels: { hq: string[]; industry: string[] };
}

/** Picks the entity whose official website is on `domain` and reads its literal claims. */
export function matchEntity(json: unknown, domain: string): WikidataMatch | null {
  const entities = (json as { entities?: Record<string, { id: string; claims?: Claims }> })?.entities || {};
  const target = domain.replace(/^www\./, "").toLowerCase();
  const entity = Object.values(entities).find((e) =>
    claimValues(e.claims || {}, "P856").some((v) => {
      const h = hostOf(String(v));
      return h === target || h.endsWith(`.${target}`);
    })
  );
  if (!entity) return null;

  const claims = entity.claims || {};
  const source = `https://www.wikidata.org/wiki/${entity.id}`;
  const f = (value: string | undefined): ProfileField | undefined =>
    value ? { value, sourceUrl: source, method: "registry" } : undefined;

  const inception = claimValues(claims, "P571")[0] as { time?: string } | undefined;
  const employees = claimValues(claims, "P1128")[0] as { amount?: string } | undefined;
  const revenue = claimValues(claims, "P2139")[0] as { amount?: string; unit?: string } | undefined;
  const linkedinId = claimValues(claims, "P4264")[0];
  const twitterId = claimValues(claims, "P2002")[0];
  const facebookId = claimValues(claims, "P2013")[0];
  const itemIds = (prop: string) =>
    claimValues(claims, prop)
      .map((v) => String((v as { id?: string })?.id || ""))
      .filter(Boolean);

  const profile: CompanyProfile = {
    foundedYear: f(inception?.time?.match(/^[+-](\d{4})/)?.[1]),
    employeeCount: f(employees?.amount ? String(Math.round(Math.abs(Number(employees.amount)))) : undefined),
    annualRevenue: f(
      revenue?.amount
        ? `${Math.round(Math.abs(Number(revenue.amount))).toLocaleString("en-US")}${revenue.unit?.endsWith("/Q4917") ? " USD" : ""}`
        : undefined
    ),
    linkedinUrl: f(linkedinId ? `https://www.linkedin.com/company/${String(linkedinId)}` : undefined),
    twitterUrl: f(twitterId ? `https://x.com/${String(twitterId)}` : undefined),
    facebookUrl: f(facebookId ? `https://www.facebook.com/${String(facebookId)}` : undefined),
  };
  return {
    id: entity.id,
    profile: Object.fromEntries(Object.entries(profile).filter(([, v]) => v)) as CompanyProfile,
    pendingLabels: { hq: itemIds("P159"), industry: itemIds("P452") },
  };
}

export function labelsFrom(json: unknown, ids: string[]): string[] {
  const entities = (json as { entities?: Record<string, { labels?: { en?: { value?: string } } }> })?.entities || {};
  return ids.map((id) => entities[id]?.labels?.en?.value || "").filter(Boolean);
}
