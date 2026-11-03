import React from "react";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { mapRunAccount } from "../../accounts/runAccount";
import { AccountsPdf, pdfSafe } from "../AccountsPdf";

describe("accounts PDF", () => {
  it("maps typography to Latin-1 and drops unsupported characters", () => {
    expect(pdfSafe("Health‑tech “fast” — growth… ✓")).toBe('Health-tech "fast" - growth...');
  });

  it("renders a cover plus one page per account", async () => {
    const account = mapRunAccount({
      id: "1",
      company_name: "CleverTap",
      canonical_domain: "clevertap.com",
      research_status: "done",
      industry: "Marketing software",
      icp_score: 72,
      why_icp_fit: "Indian SaaS company growing its sales team.",
      signals_json: { hiring: [{ title: "Hiring AEs", quote: "AE", url: "https://jobs.example/1", date: "2026-10-01", type: "hiring" }] },
      contacts_json: [{ name: "Dana Weber", title: "VP Sales", email: "dana@clevertap.com", emailStatus: "Valid" }],
    });
    const pdf = await renderToBuffer(<AccountsPdf accounts={[account]} clientName="QA Signup Co" generatedAt="3 November 2026" />);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  }, 30000);
});
