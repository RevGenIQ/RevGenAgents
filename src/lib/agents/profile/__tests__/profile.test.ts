import { describe, expect, it } from "vitest";
import { EMPTY_ICP } from "../../state";
import { naicsLabel, sicLabel } from "../codes";
import { adjustedScore, parseBand, priorityFor, ruleScore } from "../scoring";
import { detectJobBoard, jobBoardApiUrl, parseHnSearch, parseJobBoard, parseNewsRss } from "../feeds";
import { discoverInfoPages, pageText, parseCompanyPage } from "../homepage";
import { categorizeSignal, groupSignals } from "../signalCategories";
import { detectTech, emailProviderFromMx } from "../techStack";
import { dataConfidence, mergeProfiles, missingRequired } from "../types";
import { labelsFrom, matchEntity, searchResultIds } from "../wikidata";

const HOME = `<!doctype html><html><head>
<meta name="description" content="Acme builds warehouse robots &amp; fleet software.">
<meta name="keywords" content="robotics, warehouse automation">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Acme"},
{"@type":"Organization","name":"Acme Robotics","foundingDate":"2015-03-01","telephone":"+49 89 1234",
"numberOfEmployees":{"@type":"QuantitativeValue","value":420},
"address":{"@type":"PostalAddress","streetAddress":"Leopoldstr. 1","addressLocality":"Munich","addressRegion":"Bavaria","addressCountry":"DE"},
"sameAs":["https://www.linkedin.com/company/acme-robotics/","https://x.com/acmerobotics"]}]}</script>
<script src="/_next/static/chunks/main.js"></script><script src="https://js.hs-scripts.com/123.js"></script>
</head><body><a href="/about">About</a><a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a>
<a href="https://www.facebook.com/acmerobotics">Facebook</a><a href="mailto:hello@acme-robotics.com?subject=Hi">Mail</a>
<a href="https://boards.greenhouse.io/acmerobotics">Careers</a><p>We ship robots.</p><style>.x{}</style></body></html>`;

describe("company page parsing", () => {
  it("reads JSON-LD, social links, contact links and meta tags", () => {
    const p = parseCompanyPage(HOME, "https://acme-robotics.com/");
    expect(p.foundedYear?.value).toBe("2015");
    expect(p.employeeCount?.value).toBe("420");
    expect(p.city?.value).toBe("Munich");
    expect(p.hqLocation?.value).toBe("Leopoldstr. 1, Munich, Bavaria, DE");
    expect(p.linkedinUrl?.value).toBe("https://www.linkedin.com/company/acme-robotics");
    expect(p.twitterUrl?.value).toBe("https://x.com/acmerobotics");
    expect(p.facebookUrl?.value).toBe("https://www.facebook.com/acmerobotics");
    expect(p.email?.value).toBe("hello@acme-robotics.com");
    expect(p.description?.value).toBe("Acme builds warehouse robots & fleet software.");
    expect(p.keywords?.value).toBe("robotics, warehouse automation");
    expect(Object.values(p).every((f) => f?.sourceUrl === "https://acme-robotics.com/" && f.method === "website")).toBe(true);
  });

  it("extracts visible text and same-site info pages", () => {
    expect(pageText(HOME)).toContain("We ship robots.");
    expect(pageText(HOME)).not.toContain("_next");
    expect(discoverInfoPages(HOME, "https://www.acme-robotics.com/").about).toBe("https://www.acme-robotics.com/about");
  });
});

describe("tech detection", () => {
  it("matches HTML and header signatures once each", () => {
    const tech = detectTech(HOME, { Server: "cloudflare", "CF-Ray": "abc" }).map((t) => t.name);
    expect(tech).toEqual(expect.arrayContaining(["Next.js", "HubSpot", "Cloudflare"]));
    expect(tech.filter((t) => t === "Cloudflare")).toHaveLength(1);
  });

  it("names the email platform from MX hosts", () => {
    expect(emailProviderFromMx(["acme-robotics-com.mail.protection.outlook.com."])).toBe("Microsoft 365");
    expect(emailProviderFromMx(["mx.example.net"])).toBeNull();
  });
});

describe("signal feeds", () => {
  it("parses Google News RSS and strips the publisher suffix", () => {
    const xml = `<rss><channel><item><title>Acme Robotics raises $40M Series B - TechCrunch</title>
      <link>https://news.google.com/rss/articles/abc</link><pubDate>Tue, 15 Sep 2026 08:00:00 GMT</pubDate>
      <source url="https://techcrunch.com">TechCrunch</source></item></channel></rss>`;
    expect(parseNewsRss(xml)).toEqual([
      { title: "Acme Robotics raises $40M Series B", url: "https://news.google.com/rss/articles/abc", publishedDate: "2026-09-15", source: "TechCrunch" },
    ]);
  });

  it("finds a job board and normalises its postings", () => {
    const board = detectJobBoard(HOME);
    expect(board).toEqual({ kind: "greenhouse", token: "acmerobotics" });
    expect(jobBoardApiUrl(board!)).toBe("https://boards-api.greenhouse.io/v1/boards/acmerobotics/jobs");
    const jobs = parseJobBoard(board!, {
      jobs: [{ title: "Account Executive", absolute_url: "https://boards.greenhouse.io/acmerobotics/jobs/1", location: { name: "Berlin" }, updated_at: "2026-10-01T10:00:00Z" }],
    });
    expect(jobs).toEqual([{ title: "Account Executive", url: "https://boards.greenhouse.io/acmerobotics/jobs/1", location: "Berlin", postedDate: "2026-10-01", department: "" }]);
    expect(parseJobBoard({ kind: "lever", token: "x" }, [{ text: "SDR", hostedUrl: "https://jobs.lever.co/x/1", createdAt: Date.UTC(2026, 9, 2), categories: { location: "Remote" } }])[0].postedDate).toBe("2026-10-02");
  });

  it("keeps only HN stories that name the company", () => {
    const items = parseHnSearch({ hits: [{ title: "Show HN: Acme Robotics fleet SDK", objectID: "9", created_at: "2026-10-05T00:00:00Z" }, { title: "Unrelated", objectID: "8" }] }, "Acme Robotics");
    expect(items).toEqual([{ title: "Show HN: Acme Robotics fleet SDK", url: "https://news.ycombinator.com/item?id=9", publishedDate: "2026-10-05", source: "Hacker News" }]);
  });
});

describe("wikidata", () => {
  const entities = {
    entities: {
      Q1: { id: "Q1", claims: { P856: [{ mainsnak: { datavalue: { value: "https://other.com" } } }] } },
      Q2: {
        id: "Q2",
        claims: {
          P856: [{ mainsnak: { datavalue: { value: "https://www.acme-robotics.com/" } } }],
          P571: [{ mainsnak: { datavalue: { value: { time: "+2015-00-00T00:00:00Z" } } } }],
          P1128: [{ mainsnak: { datavalue: { value: { amount: "+420" } } } }],
          P159: [{ mainsnak: { datavalue: { value: { id: "Q1726" } } } }],
        },
      },
    },
  };

  it("only accepts the entity whose official website is the company domain", () => {
    const m = matchEntity(entities, "acme-robotics.com");
    expect(m?.id).toBe("Q2");
    expect(m?.profile.foundedYear).toEqual({ value: "2015", sourceUrl: "https://www.wikidata.org/wiki/Q2", method: "registry" });
    expect(m?.profile.employeeCount?.value).toBe("420");
    expect(m?.pendingLabels.hq).toEqual(["Q1726"]);
    expect(matchEntity(entities, "unknown.io")).toBeNull();
  });

  it("reads search ids and labels", () => {
    expect(searchResultIds({ search: [{ id: "Q2" }, { id: "bad" }] })).toEqual(["Q2"]);
    expect(labelsFrom({ entities: { Q1726: { labels: { en: { value: "Munich" } } } } }, ["Q1726"])).toEqual(["Munich"]);
  });
});

describe("profile merging and codes", () => {
  it("keeps the first source's value per field and scores completeness", () => {
    const web = { website: { value: "https://acme.com", sourceUrl: "https://acme.com", method: "website" as const } };
    const wiki = {
      website: { value: "https://wrong.com", sourceUrl: "w", method: "registry" as const },
      foundedYear: { value: "2015", sourceUrl: "w", method: "registry" as const },
    };
    const merged = mergeProfiles(web, wiki);
    expect(merged.website?.value).toBe("https://acme.com");
    expect(merged.foundedYear?.value).toBe("2015");
    expect(dataConfidence(merged)).toBe(20);
    expect(missingRequired(merged)).not.toContain("foundedYear");
  });

  it("labels only codes on the official lists", () => {
    expect(naicsLabel("54")).toBe("NAICS 54 Professional, Scientific, and Technical Services");
    expect(naicsLabel("541511")).toBe("");
    expect(sicLabel("I (70-89)")).toBe("SIC Division I (70-89) Services");
  });
});

describe("signal categories", () => {
  const base = { quote: "q", sourceUrl: "https://acme.com/news", sourceDate: "2026-09-01" };
  it("sorts signals into the five CSV columns", () => {
    expect(categorizeSignal({ ...base, signalType: "hiring", title: "Hiring 5 AEs" })).toBe("hiring");
    expect(categorizeSignal({ ...base, signalType: "funding round", title: "Raised Series B" })).toBe("funding_partnership");
    expect(categorizeSignal({ ...base, signalType: "launch", title: "New product", sourceUrl: "https://news.ycombinator.com/item?id=1" })).toBe("social");
    expect(categorizeSignal({ ...base, signalType: "expansion", title: "New office in Pune" })).toBe("news");
    expect(categorizeSignal({ ...base, signalType: "tech adoption", title: "Uses Salesforce" })).toBe("icp");
    const grouped = groupSignals([
      { ...base, signalType: "hiring", title: "a", sourceDate: "2026-01-01" },
      { ...base, signalType: "hiring", title: "b", sourceDate: "2026-05-01" },
    ]);
    expect(grouped.hiring.map((s) => s.title)).toEqual(["b", "a"]);
  });
});

describe("rules-first scoring", () => {
  const icp = { ...EMPTY_ICP, industries: ["Industrial robotics"], geographies: ["Germany"], employeeBands: ["200-1000"] };
  const candidate = { name: "Acme Robotics", domain: "acme-robotics.com", industry: "Industrial robotics", country: "Germany", whyItMatches: "", sources: [] };
  const now = new Date("2026-11-02T00:00:00Z");
  const sig = (signalType: string, sourceDate: string) => ({ signalType, title: signalType, quote: "q", sourceUrl: `https://x.com/${signalType}`, sourceDate });

  it("awards each part and explains misses", () => {
    const profile = { employeeCount: { value: "420", sourceUrl: "s", method: "website" as const } };
    const s = ruleScore(icp, candidate, profile, [sig("hiring", "2026-10-20"), sig("funding", "2026-06-01")], now);
    expect(s.icpMatch).toBe(30);
    expect(s.signals).toBe(20);
    expect(s.timing).toBe(20);
    expect(s.total).toBe(s.icpMatch + s.signals + s.completeness + s.timing);
    const off = ruleScore({ ...icp, geographies: ["India"] }, candidate, {}, [], now);
    expect(off.icpMatch).toBe(16);
    expect(off.notes).toEqual(expect.arrayContaining(["Location is outside the ICP geographies.", "Company size unknown."]));
  });

  it("clamps the model's adjustment to ±10 and 0-100", () => {
    const rule = { icpMatch: 30, signals: 30, completeness: 20, timing: 15, total: 95, notes: [] };
    expect(adjustedScore(rule, 40)).toBe(100);
    expect(adjustedScore(rule, -40)).toBe(85);
    expect(priorityFor(80)).toBe("High");
    expect(priorityFor(60)).toBe("Medium");
    expect(parseBand("1,000+")).toEqual([1000, Number.POSITIVE_INFINITY]);
  });
});
