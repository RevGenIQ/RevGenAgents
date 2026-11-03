import { describe, expect, it } from "vitest";
import { accountsToCsv, csvCell, deliveryHeaders, icpSignalColumns, parseCsv, uncsvCell } from "../csv";
import { mapRunAccount } from "../runAccount";

const account = mapRunAccount({
  id: "c1",
  company_name: "Acme, Inc.",
  canonical_domain: "acme.com",
  research_status: "done",
  employee_count_band: "420",
  tech_stack: ["Next.js", "HubSpot"],
  data_confidence: 80,
  total_targeted_signals: 2,
  icp_score: 81,
  priority_band: "High Priority",
  why_icp_fit: 'Robotics maker, "fast" growing',
  signals_json: {
    hiring: [{ title: "Hiring 5 AEs", quote: "AE", url: "https://jobs/1", date: "2026-10-01", type: "hiring" }],
    funding_partnership: [{ title: "Raised Series B", quote: "B", url: "https://news/2", date: "2026-09-01", type: "funding round" }],
  },
  field_sources_json: { phone: { value: "+49 1", sourceUrl: "https://acme.com", method: "website" } },
  contacts_json: [{ name: "Dana Weber", title: "VP Ops", email: "dana@acme.com" }],
});

describe("delivery CSV", () => {
  it("names one column pair per ICP signal", () => {
    expect(icpSignalColumns(["Funding round", "hiring for sales"])).toEqual([
      "Funding_Round_Signal",
      "Funding_Round_Signal_Source",
      "Hiring_For_Sales_Signal",
      "Hiring_For_Sales_Signal_Source",
    ]);
    const headers = deliveryHeaders(["Funding round"], true);
    expect(headers.slice(0, 2)).toEqual(["Company_Name", "Company_Website"]);
    expect(headers).toContain("What_To_Pitch");
    expect(headers.at(-1)).toBe("Country");
  });

  it("writes one row per contact, padded to three, and round-trips through the parser", () => {
    const csv = accountsToCsv([account], { requiredSignals: ["Funding round"], includeContacts: true });
    const rows = parseCsv(csv);
    const [header, ...data] = rows;
    expect(data).toHaveLength(3);
    const col = (name: string) => header.indexOf(name);
    expect(data[0][col("Company_Name")]).toBe("Acme, Inc.");
    expect(data[0][col("Company_Website")]).toBe("https://acme.com");
    expect(data[0][col("Company_Number")]).toBe("+49 1");
    expect(data[0][col("Tech_Stack")]).toBe("Next.js, HubSpot");
    expect(data[0][col("Why_ICP_Fit")]).toBe('Robotics maker, "fast" growing');
    expect(data[0][col("Hiring_Signal")]).toBe("Hiring 5 AEs (2026-10-01)");
    expect(data[0][col("Funding_Round_Signal_Source")]).toBe("https://news/2");
    expect(data[0][col("First Name")]).toBe("Dana");
    expect(data[0][col("Number of Contacts")]).toBe("3");
    expect(data[2][col("Email")]).toBe("");
  });

  it("neutralises formula injection and undoes it on import", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(csvCell("+cmd|x")).toBe("'+cmd|x");
    expect(uncsvCell("'=HYPERLINK(1)")).toBe("=HYPERLINK(1)");
    expect(uncsvCell("'quoted")).toBe("'quoted");
  });

  it("parses CRLF, quotes and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
});
