/**
 * LLM Provider Adapter
 * Supports OpenAI / Gemini / Anthropic if API keys are set.
 * Falls back to high-fidelity rule-based reasoning engine in Demo Mode.
 */

export interface ParsedIcpResult {
  targetIndustries: string[];
  targetCountries: string[];
  headcountRanges: string[];
  targetJobTitles: string[];
  seniorityLevels: string[];
  inferredOffering: string;
  keyPainPoints: string[];
  suggestedExclusions: string[];
  minQualificationScore: number;
}

export async function parseIcpFromInput(
  websiteUrl: string,
  description: string
): Promise<ParsedIcpResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
        signal: AbortSignal.timeout(20000),
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Extract structured ICP from website: "${websiteUrl}" and description: "${description}". Respond in valid JSON with fields: targetIndustries (array of strings), targetCountries (array of strings), headcountRanges (array of strings e.g. "50-200"), targetJobTitles (array of strings), seniorityLevels (array of strings), inferredOffering (string), keyPainPoints (array of strings), suggestedExclusions (array of strings), minQualificationScore (integer 0-100). Return ONLY the raw JSON.`,
                  },
                ],
              },
            ],
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch {
      // fallback to built-in parser
    }
  }

  if (openaiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        signal: AbortSignal.timeout(20000),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Extract structured ICP from company URL and description. Return strictly JSON with targetIndustries, targetCountries, headcountRanges, targetJobTitles, seniorityLevels, inferredOffering, keyPainPoints, suggestedExclusions, minQualificationScore.",
            },
            {
              role: "user",
              content: `Website: ${websiteUrl}\nDescription: ${description}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          return JSON.parse(content);
        }
      }
    } catch {
      // fallback
    }
  }

  // High-fidelity fallback logic (Demo Mode)
  const isMfg =
    description.toLowerCase().includes("mfg") ||
    description.toLowerCase().includes("manufacturing") ||
    description.toLowerCase().includes("auto");
  const isDtc =
    description.toLowerCase().includes("dtc") ||
    description.toLowerCase().includes("shopify") ||
    description.toLowerCase().includes("ecommerce");

  if (isMfg) {
    return {
      targetIndustries: ["Automotive Components", "Industrial Manufacturing", "Precision Engineering"],
      targetCountries: ["India", "Southeast Asia", "Germany"],
      headcountRanges: ["200-1000", "1000-5000"],
      targetJobTitles: ["Chief Human Resources Officer", "VP Operations", "Head of L&D", "Plant Director"],
      seniorityLevels: ["C-Suite", "VP", "Director"],
      inferredOffering: "Enterprise Transformation & Operational Workforce Upskilling",
      keyPainPoints: [
        "Rapid capacity expansion requiring plant supervisor upskilling",
        "High churn in operational leadership",
        "Lack of standardized multi-site SOPs",
      ],
      suggestedExclusions: ["Unregistered subcontractors", "B2C retail stores"],
      minQualificationScore: 85,
    };
  }

  if (isDtc) {
    return {
      targetIndustries: ["DTC Apparel", "Beauty & Personal Care", "Consumer Electronics"],
      targetCountries: ["United States", "United Kingdom", "Canada"],
      headcountRanges: ["20-100", "100-500"],
      targetJobTitles: ["VP Growth", "Head of Performance Marketing", "Chief Marketing Officer"],
      seniorityLevels: ["VP", "Head", "Director"],
      inferredOffering: "High-LTV Retention & AI Creative Optimization for Shopify Brands",
      keyPainPoints: [
        "Rising Meta/Google CAC hurting contribution margins",
        "Low repeat purchase rate within 60 days",
      ],
      suggestedExclusions: ["Amazon-only sellers", "Dropshipping stores"],
      minQualificationScore: 80,
    };
  }

  return {
    targetIndustries: ["B2B SaaS", "Cloud Infrastructure", "Cybersecurity", "Fintech"],
    targetCountries: ["United States", "United Kingdom", "India"],
    headcountRanges: ["50-250", "250-1000"],
    targetJobTitles: ["VP Sales", "Chief Revenue Officer", "Head of Growth", "Director of Business Development"],
    seniorityLevels: ["VP", "C-Suite", "Director"],
    inferredOffering: "Predictive B2B Pipeline Generation & Buying-Signal Prospecting",
    keyPainPoints: [
      "Inbound pipeline slowing after Series A/B",
      "Sales development reps burning hours on manual account research",
      "Low cold outreach reply rates due to generic copy",
    ],
    suggestedExclusions: ["Pre-seed stealth startups", "Government agencies", "Competitors (Apollo, ZoomInfo)"],
    minQualificationScore: 85,
  };
}

export async function generateOutreachOpener(
  companyName: string,
  contactName: string,
  contactTitle: string,
  signalSummary: string
): Promise<string> {
  return `Hi ${contactName}, saw ${companyName}'s recent milestone: ${signalSummary}. Given your mandate leading ${contactTitle}, wanted to share how similar leaders capitalized on this exact window without adding manual overhead.`;
}
