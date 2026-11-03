import { describe, expect, it } from "vitest";
import { firstInteger, isoDateOrNull, profileColumns, usdAmount } from "../companyColumns";

const f = (value: string) => ({ value, sourceUrl: "https://acme.com", method: "website" as const });

describe("company column mapping", () => {
  it("parses numbers, dates and USD amounts conservatively", () => {
    expect(firstInteger("1,200 employees")).toBe(1200);
    expect(firstInteger("unknown")).toBeNull();
    expect(isoDateOrNull("2026-03")).toBe("2026-03-01");
    expect(isoDateOrNull("2026-13-01")).toBeNull();
    expect(isoDateOrNull("March 2026")).toBeNull();
    expect(usdAmount("$40M")).toBe(40_000_000);
    expect(usdAmount("USD 1.2 billion")).toBe(1_200_000_000);
    expect(usdAmount("€40M")).toBeNull();
  });

  it("maps a profile and signals to companies columns", () => {
    const cols = profileColumns(
      { employeeCount: f("420"), foundedYear: f("2015"), techStack: f("Next.js, HubSpot"), email: f("hi@acme.com"), phone: f("+49 1"), lastRaisedAt: f("2026-09") },
      [{ signalType: "hiring", title: "Hiring AEs", quote: "AE", sourceUrl: "https://jobs/1", sourceDate: "2026-10-01" }]
    );
    expect(cols).toMatchObject({
      employee_count: 420,
      employee_count_band: "420",
      founded_year: 2015,
      tech_stack: ["Next.js", "HubSpot"],
      company_email_phone: "hi@acme.com / +49 1",
      last_raised_at: "2026-09-01",
      total_targeted_signals: 1,
    });
    expect((cols.signals_json as Record<string, unknown[]>).hiring).toHaveLength(1);
    expect((cols.field_sources_json as Record<string, { sourceUrl: string }>).employeeCount.sourceUrl).toBe("https://acme.com");
  });
});
