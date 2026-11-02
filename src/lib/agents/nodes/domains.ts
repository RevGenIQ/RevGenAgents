/**
 * Domain normalisation and matching used by dedupeFilter and loadContext.
 */

/** Hosts that are publishers or platforms, never a prospect's own domain. */
export const GENERIC_HOSTS = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "reddit.com",
  "quora.com",
  "medium.com",
  "crunchbase.com",
  "bloomberg.com",
  "reuters.com",
  "wikipedia.org",
  "youtube.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "github.com",
  "google.com",
  "yahoo.com",
  "prnewswire.com",
  "businesswire.com",
  "globenewswire.com",
];

/** "https://www.Acme.co.uk/about" -> "acme.co.uk"; returns "" when nothing usable remains. */
export function normalizeDomain(input: string): string {
  const cleaned = (input || "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#:].*$/, "")
    .replace(/\.$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(cleaned) ? cleaned : "";
}

/** True when `domain` equals an entry or is a subdomain of one. */
export function matchesDomain(domain: string, list: string[]): boolean {
  return list.some((entry) => entry && (domain === entry || domain.endsWith(`.${entry}`)));
}

export function isGenericHost(domain: string): boolean {
  return matchesDomain(domain, GENERIC_HOSTS);
}
