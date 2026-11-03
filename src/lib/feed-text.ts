/**
 * Helpers for turning RSS/Atom feed fragments into plain display text.
 *
 * Feeds such as Product Hunt ship HTML inside entity-escaped content
 * (`&lt;p&gt;Hello&lt;/p&gt;`), sometimes escaped twice
 * (`&amp;lt;p&amp;gt;`). Tags must be stripped *after* entities are decoded,
 * otherwise the escaped markup survives as literal `<p>` on screen.
 */

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
};

const ENTITY_PATTERN = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi;
const MAX_DECODE_PASSES = 3;

function decodeEntity(match: string, body: string): string {
  if (body[0] === "#") {
    const isHex = body[1] === "x" || body[1] === "X";
    const codePoint = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
      return match;
    }
    return String.fromCodePoint(codePoint);
  }
  return NAMED_ENTITIES[body.toLowerCase()] ?? match;
}

/**
 * Decodes named and numeric entities. Runs a bounded number of passes so
 * double-escaped input (`&amp;lt;`) resolves fully; each pass is a single
 * regex sweep, so `&amp;` never re-combines with already decoded text
 * inside the same pass.
 */
export function decodeHtmlEntities(input: string): string {
  let current = input;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass++) {
    const next = current.replace(ENTITY_PATTERN, decodeEntity);
    if (next === current) break;
    current = next;
  }
  return current;
}

/** CDATA unwrap → decode entities → strip tags → collapse whitespace. */
export function feedFragmentToText(fragment: string): string {
  const unwrapped = fragment.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  return decodeHtmlEntities(unwrapped)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the plain-text body of the first `<tag>` element in an XML block. */
export function extractXmlTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  return match ? feedFragmentToText(match[1]) : "";
}

/** Hostname of a URL without `www.`, or "" when it cannot be parsed. */
export function hostFromUrl(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}
