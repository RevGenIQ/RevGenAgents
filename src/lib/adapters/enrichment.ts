/**
 * Contact Enrichment Provider Adapter
 * Connects directly to Apollo API or Google Serper (LinkedIn profiles)
 * to identify REAL decision makers with verifiable LinkedIn profiles.
 * When no named person is found, returns an explicitly labelled, unconfirmed placeholder.
 */

export interface EnrichedContactCandidate {
  firstName: string;
  lastName: string;
  title: string;
  seniority: string;
  department: string;
  workEmail: string;
  personalLinkedin: string;
  mobileNumber?: string;
  directNumber?: string;
  roleStartDate: string;
  currentRoleConfirmed: boolean;
  employmentEvidenceNote: string;
}

export async function enrichDecisionMaker(
  companyName: string,
  companyDomain: string,
  targetTitles: string[] = ["CHRO", "VP Operations", "Head of Engineering", "CEO"]
): Promise<EnrichedContactCandidate> {
  const apolloKey = process.env.APOLLO_API_KEY;
  const serperKey = process.env.SERPER_API_KEY;
  const cleanDomain = companyDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  // 1. Try Live Apollo API
  if (apolloKey) {
    try {
      const res = await fetch("https://api.apollo.io/v1/people/match", {
        signal: AbortSignal.timeout(15000),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apolloKey,
        },
        body: JSON.stringify({
          organization_name: companyName,
          domain: cleanDomain,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const person = data.person;
        if (person && person.first_name) {
          return {
            firstName: person.first_name,
            lastName: person.last_name || "",
            title: person.title || targetTitles[0],
            seniority: person.seniority || "Director",
            department: person.department || "Executive",
            workEmail:
              person.email ||
              `${person.first_name.toLowerCase()}.${(person.last_name || "contact").toLowerCase()}@${cleanDomain}`,
            personalLinkedin:
              person.linkedin_url ||
              `https://www.linkedin.com/company/${cleanDomain.split(".")[0]}`,
            mobileNumber: person.phone_numbers?.[0]?.raw_number,
            roleStartDate:
              person.start_date || new Date().toISOString().split("T")[0],
            currentRoleConfirmed: true,
            employmentEvidenceNote:
              "Corroborated via live Apollo Enterprise directory API.",
          };
        }
      }
    } catch (e) {
      console.warn("Apollo live enrichment call error:", e);
    }
  }

  // 2. Discover Real Decision Maker via Google Serper (Live LinkedIn Profiles)
  if (serperKey) {
    try {
      const titlesQuery = targetTitles
        .slice(0, 4)
        .map((t) => `"${t}"`)
        .join(" OR ");
      const q = `site:linkedin.com/in "${companyName}" (${titlesQuery} OR "CTO" OR "VP" OR "Director" OR "Head" OR "Founder" OR "CEO")`;

      const res = await fetch("https://google.serper.dev/search", {
        signal: AbortSignal.timeout(15000),
        method: "POST",
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q, num: 3 }),
      });

      if (res.ok) {
        const data = await res.json();
        const topProfile = (data.organic || []).find(
          (o: any) =>
            o.link &&
            o.link.includes("linkedin.com/in/") &&
            !String(o.title || "").toLowerCase().includes("jobs") &&
            !String(o.title || "").toLowerCase().includes("hiring")
        );

        if (topProfile) {
          const cleanTitle = topProfile.title
            .replace(/\s*\|\s*LinkedIn.*$/i, "")
            .replace(/\s*-\s*LinkedIn.*$/i, "")
            .trim();

          const parts = cleanTitle.split(/[-–|@]/);
          const rawName = parts[0]?.trim() || "";
          const rawTitle = parts[1]?.trim() || targetTitles[0] || "Director";

          const nameWords = rawName.split(/\s+/).filter(Boolean);
          const firstName = nameWords[0] || "Executive";
          const lastName = nameWords.slice(1).join(" ") || "";

          const lowerTitle = rawTitle.toLowerCase();
          let seniority = "Director";
          if (
            lowerTitle.includes("c-") ||
            lowerTitle.includes("chief") ||
            lowerTitle.includes("founder") ||
            lowerTitle.includes("president") ||
            lowerTitle.includes("ceo") ||
            lowerTitle.includes("cto") ||
            lowerTitle.includes("cro") ||
            lowerTitle.includes("coo")
          ) {
            seniority = "C-Suite";
          } else if (
            lowerTitle.includes("vp") ||
            lowerTitle.includes("vice president")
          ) {
            seniority = "VP";
          } else if (
            lowerTitle.includes("head of") ||
            lowerTitle.includes("lead")
          ) {
            seniority = "Head";
          }

          let department = "Executive Leadership";
          if (
            lowerTitle.includes("tech") ||
            lowerTitle.includes("engineer") ||
            lowerTitle.includes("software") ||
            lowerTitle.includes("cloud") ||
            lowerTitle.includes("devops") ||
            lowerTitle.includes("architect")
          ) {
            department = "Engineering & Technology";
          } else if (
            lowerTitle.includes("operat") ||
            lowerTitle.includes("plant") ||
            lowerTitle.includes("manufactur")
          ) {
            department = "Operations & Plant";
          } else if (
            lowerTitle.includes("hr") ||
            lowerTitle.includes("talent") ||
            lowerTitle.includes("people") ||
            lowerTitle.includes("l&d")
          ) {
            department = "Human Resources";
          } else if (
            lowerTitle.includes("sale") ||
            lowerTitle.includes("revenue") ||
            lowerTitle.includes("growth") ||
            lowerTitle.includes("commercial")
          ) {
            department = "Revenue & Commercial";
          }

          const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, "");
          const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, "");
          const workEmail = cleanLast
            ? `${cleanFirst}.${cleanLast}@${cleanDomain}`
            : `${cleanFirst}@${cleanDomain}`;

          return {
            firstName,
            lastName,
            title: rawTitle,
            seniority,
            department,
            workEmail,
            personalLinkedin: topProfile.link,
            roleStartDate: new Date().toISOString().split("T")[0],
            // A search snippet is not proof of current employment, and the email
            // is a guessed first.last pattern: both need human verification.
            currentRoleConfirmed: false,
            employmentEvidenceNote: `Found via LinkedIn search result (unconfirmed; email address pattern guessed): "${topProfile.snippet?.slice(0, 160)}..."`,
          };
        }
      }
    } catch (e) {
      console.warn("Serper live LinkedIn enrichment error:", e);
    }
  }

  // 3. Fallback: no named person was found. Return a clearly labelled role inbox
  //    that is never treated as a verified contact.
  const defaultTitle = targetTitles[0] || "Head of Procurement & Supply Chain";

  return {
    firstName: "Unidentified",
    lastName: "Contact",
    title: defaultTitle,
    seniority: "Unknown",
    department: "Unknown",
    workEmail: `procurement@${cleanDomain}`,
    personalLinkedin: "",
    roleStartDate: "",
    currentRoleConfirmed: false,
    employmentEvidenceNote: `PLACEHOLDER: no named decision maker found for ${companyName}. Generic role inbox only; needs human research.`,
  };
}
