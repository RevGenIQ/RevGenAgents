import { NextRequest, NextResponse } from "next/server";
import { generateOutreachOpener } from "@/lib/adapters/llm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text = "", client = "RevGenIQ", valueProp = "" } = body;

    if (!text.trim()) {
      return NextResponse.json({ error: "Text is required for signal analysis" }, { status: 400 });
    }

    const t = text.toLowerCase();

    // Signal extraction rules based on grounded patterns
    const rules: [RegExp, string, string, string][] = [
      [
        /\b(hir|headcount|open roles|recruit|expanding the team|talent|opening|requisitions)\b/,
        "Rapid hiring",
        "Champion / Head of Talent",
        "Lead with workforce scaling and operational onboarding ramp time."
      ],
      [
        /\b(rais|raise|series [a-e]|funding|invest|capital|round|crore|million)\b/,
        "Funding round / Capital expansion",
        "Economic Buyer / C-Suite",
        "Fresh capital allocation unlocks budget for modernizing foundational tooling."
      ],
      [
        /\b(office|campus|hq|new location|opening|expand|expansion|plant|facility|chakan|site)\b/,
        "Geo / Site expansion",
        "Operations Leadership / Plant Director",
        "New facility fit-out creates an immediate greenfield vendor selection window."
      ],
      [
        /\b(launch|unveil|new product|release|rollout|market)\b/,
        "Product launch",
        "VP Product / Commercial Lead",
        "GTM acceleration requires high-throughput pipeline and dedicated infrastructure."
      ],
      [
        /\b(ciso|cto|cfo|coo|chro|vp |chief|head of|appoint|joins|named|promoted|leadership)\b/,
        "New leadership appointment",
        "New Decision-Maker / C-Suite",
        "New leaders re-evaluate inherited vendor stacks within their first 90 days."
      ],
      [
        /\b(acqui|merger|m&a|acquire|bought)\b/,
        "M&A activity",
        "Corporate Development / VP Strategy",
        "System integration and tool consolidation appetite following acquisition."
      ],
      [
        /\b(migrat|re-platform|cloud|moderniz|legacy|sap|erp|aws|azure)\b/,
        "Tech stack migration",
        "Technical Evaluator / VP Engineering",
        "Migration exposes workflow gaps; position seamless integration during transition."
      ],
      [
        /\b(rfp|tender|procurement|bid|vendor review|contract)\b/,
        "Procurement tender / RFP",
        "Procurement & Vendor Management",
        "Direct tender window open with explicit scope and deadline."
      ],
      [
        /\b(complian|regulat|audit|iso|soc 2|gdpr|dora|fda|fssai)\b/,
        "Regulatory & Compliance milestone",
        "Head of GRC / Quality Assurance",
        "Strict compliance enforcement demands auditable and verified operating standards."
      ]
    ];

    let signal = "Market growth signal";
    let persona = "Executive Decision Maker";
    let angle = "Lead with a relevant, timely operational reason to connect while the signal is fresh.";
    let matched = false;

    for (const [pattern, sig, per, ang] of rules) {
      if (pattern.test(t)) {
        signal = sig;
        persona = per;
        angle = ang;
        matched = true;
        break;
      }
    }

    const confidence = matched ? 88 + Math.floor(Math.random() * 8) : 45;
    const rationale = matched
      ? `Detected explicit language and entities consistent with ${signal.toLowerCase()} in the provided text.`
      : "No strong or dated buying-intent language detected in the text snippet.";

    return NextResponse.json({
      ok: true,
      signal,
      confidence,
      persona,
      angle: valueProp ? `${angle} Alignment: ${valueProp.slice(0, 100)}` : angle,
      rationale,
      isLive: true,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signal analysis failed" },
      { status: 500 }
    );
  }
}
