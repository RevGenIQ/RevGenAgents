import { describe, expect, it } from "vitest";
import { accountsToCsv, parseCsv, toCsv } from "../../accounts/csv";
import { mapRunAccount } from "../../accounts/runAccount";
import { domainOf, parseEnrichmentCsv } from "../importCsv";

describe("enrichment CSV import", () => {
  it("normalises websites to domains", () => {
    expect(domainOf("https://www.Acme.com/about")).toBe("acme.com");
    expect(domainOf("acme.io")).toBe("acme.io");
    expect(domainOf("")).toBe("");
  });

  it("round-trips an exported CSV after a Humagent fills in contacts and extra context", () => {
    const account = mapRunAccount({ id: "1", company_name: "Acme", canonical_domain: "acme.com", research_status: "done", employee_count_band: "420" });
    const exported = parseCsv(accountsToCsv([account], { requiredSignals: [], includeContacts: true }));
    const headers = [...exported[0], "Budget Owner Notes"];
    const col = (n: string) => headers.indexOf(n);
    const rows = exported.slice(1).map((r) => [...r, ""]);
    rows[0][col("First Name")] = "Dana";
    rows[0][col("Last Name")] = "Weber";
    rows[0][col("Email")] = "dana@acme.com";
    rows[0][col("Founded_Year")] = "2015";
    rows[0][col("Total Funding")] = "$40M";
    rows[0][col("Budget Owner Notes")] = "Owns the sales tooling budget";
    rows[1][col("First Name")] = "Sam";
    rows[1][col("Email")] = "not-an-email";
    const csv = toCsv(headers, rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))));

    const result = parseEnrichmentCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [company] = result.payload.companies;
    expect(company.domain).toBe("acme.com");
    expect(company.columns).toMatchObject({ founded_year: 2015, total_funding_usd: 40_000_000, employee_count_band: "420", employee_count: 420 });
    expect(company.extra).toEqual({ "Budget Owner Notes": "Owns the sales tooling budget" });
    expect(result.payload.contacts.map((c) => [c.firstName, c.email])).toEqual([["Dana", "dana@acme.com"], ["Sam", ""]]);
    expect(result.payload.warnings[0]).toMatch(/not a valid email/);
  });

  it("rejects files without the required columns or rows", () => {
    expect(parseEnrichmentCsv("Name,Email\r\nAcme,a@b.com\r\n")).toEqual({ ok: false, error: "Missing required columns: Company_Name, Company_Website." });
    expect(parseEnrichmentCsv("Company_Name,Company_Website\r\n")).toMatchObject({ ok: false });
    const noSite = parseEnrichmentCsv("Company_Name,Company_Website\r\nAcme,\r\n");
    expect(noSite).toEqual({ ok: false, error: "No rows had a valid Company_Website." });
  });

  it("does not let a CSV overwrite agent scores or signals", () => {
    const csv = "Company_Name,Company_Website,ICP_Score,Hiring_Signal,Why_ICP_Fit\r\nAcme,acme.com,99,Fake hiring,Strong fit\r\n";
    const result = parseEnrichmentCsv(csv);
    expect(result.ok && result.payload.companies[0].columns).toEqual({ why_icp_fit: "Strong fit" });
  });
});
