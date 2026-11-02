import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import {
  getSessionFromRequest,
  verifyWorkspaceAccess,
  DEMO_WORKSPACE_ID,
} from "@/lib/security/auth";
import { sanitizeForCsv } from "@/lib/security/validator";
import { apiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    // 1. Rate Limit: 20 export requests per minute
    const rl = rateLimit(request, {
      max: 20,
      windowMs: 60 * 1000,
      prefix: "export_get",
    });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const searchParams = request.nextUrl.searchParams;

    // Strict multi-tenant resolution: members can ONLY export their own workspace
    const workspaceId = session
      ? session.role === "admin"
        ? searchParams.get("workspaceId") || session.workspaceId
        : session.workspaceId
      : searchParams.get("workspaceId") || DEMO_WORKSPACE_ID;

    // 2. Authorization check
    const access = verifyWorkspaceAccess(session, workspaceId);
    if (!access.isAuthorized && access.errorResponse) {
      return access.errorResponse;
    }

    const minScore = Math.min(
      100,
      Math.max(0, parseInt(searchParams.get("minScore") || "0", 10))
    );
    const verificationStatus = searchParams.get("verificationStatus") || "";

    const supabase = createServerClient();
    let query = supabase
      .from("contacts")
      .select(
        "*, companies(company_name, canonical_domain, industry, employee_count, company_city, company_country, icp_fit_reason)"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (minScore > 0) {
      query = query.gte("icp_score", minScore);
    }

    if (verificationStatus) {
      query = query.eq("verification_status", verificationStatus);
    }

    const { data: contacts, error } = await query;

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    // Fetch primary signals for these companies
    const companyIds = Array.from(
      new Set(
        (contacts || []).map((c: any) => c.company_id).filter(Boolean)
      )
    );
    const signalsByCompany: Record<string, any> = {};
    if (companyIds.length > 0) {
      const { data: sigs } = await supabase
        .from("signals")
        .select("*")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false });

      if (sigs) {
        for (const s of sigs) {
          if (!signalsByCompany[s.company_id]) {
            signalsByCompany[s.company_id] = s;
          }
        }
      }
    }

    // Comprehensive 15-column roundtrip CSV schema
    const headers = [
      "Company",
      "Domain",
      "Origin",
      "ICP Score",
      "Signal Type",
      "Evidence",
      "Source URL",
      "Source Date",
      "Confidence",
      "Contact Name",
      "Title",
      "Persona Role",
      "Email",
      "Email Status",
      "Country",
    ];

    // Build rows safely escaping formula injection
    const rows = (contacts || []).map((c: any) => {
      const origin =
        c.icp_reason?.includes("imported research") ||
        c.companies?.icp_fit_reason?.includes("imported research")
          ? "imported research"
          : "live run";

      let personaRole = "Influencer";
      const roleMatch = c.icp_reason?.match(/\[Role:\s*([^\]]+)\]/i);
      if (roleMatch) {
        personaRole = roleMatch[1].trim();
      } else if (c.title) {
        const t = c.title.toLowerCase();
        if (
          t.includes("ceo") ||
          t.includes("cfo") ||
          t.includes("president") ||
          t.includes("managing director") ||
          t.includes("vp")
        ) {
          personaRole = "Economic Buyer";
        } else if (
          t.includes("head") ||
          t.includes("director") ||
          t.includes("cto")
        ) {
          personaRole = "Champion";
        } else if (
          t.includes("security") ||
          t.includes("compliance") ||
          t.includes("procurement")
        ) {
          personaRole = "Blocker";
        }
      }

      const sig = signalsByCompany[c.company_id];
      const signalType = sig?.signal_type || "";
      const evidence = sig?.supporting_excerpt || "";
      const sourceUrl = sig?.evidence_url || "";
      const sourceDate = sig?.publication_date || sig?.event_date || "";
      const confidence =
        sig?.confidence !== undefined ? String(sig.confidence) : "";

      return [
        sanitizeForCsv(c.companies?.company_name || c.company_name || ""),
        sanitizeForCsv(c.companies?.canonical_domain || c.company_domain || ""),
        sanitizeForCsv(origin),
        sanitizeForCsv(c.icp_score || 0),
        sanitizeForCsv(signalType),
        sanitizeForCsv(evidence),
        sanitizeForCsv(sourceUrl),
        sanitizeForCsv(sourceDate),
        sanitizeForCsv(confidence),
        sanitizeForCsv(`${c.first_name || ""} ${c.last_name || ""}`.trim()),
        sanitizeForCsv(c.title || ""),
        sanitizeForCsv(personaRole),
        sanitizeForCsv(c.work_email || ""),
        sanitizeForCsv(c.email_status || "unverified"),
        sanitizeForCsv(c.contact_country || c.companies?.company_country || ""),
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="revgeniq_leads_${
          new Date().toISOString().split("T")[0]
        }.csv"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to generate CSV export",
      500,
      "EXPORT_ERROR"
    );
  }
}
