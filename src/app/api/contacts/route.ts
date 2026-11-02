import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { getSessionFromRequest, verifyWorkspaceAccess, DEMO_WORKSPACE_ID } from "@/lib/security/auth";
import { sanitizeSearchQuery, isValidUUID } from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    // 1. Rate Limit
    const rl = rateLimit(request, { max: 80, windowMs: 60 * 1000, prefix: "contacts_get" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const searchParams = request.nextUrl.searchParams;

    // Strict multi-tenant resolution: members can ONLY query their own workspace
    const workspaceId = session
      ? (session.role === "admin" ? (searchParams.get("workspaceId") || session.workspaceId) : session.workspaceId)
      : (searchParams.get("workspaceId") || DEMO_WORKSPACE_ID);

    // 2. Authorization check
    const access = verifyWorkspaceAccess(session, workspaceId);
    if (!access.isAuthorized && access.errorResponse) {
      return access.errorResponse;
    }

    const rawSearch = searchParams.get("search") || "";
    const cleanSearch = sanitizeSearchQuery(rawSearch);
    const verificationStatus = searchParams.get("verificationStatus") || "";
    const emailStatus = searchParams.get("emailStatus") || "";
    const companyId = searchParams.get("companyId") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));
    const offset = (page - 1) * limit;

    const supabase = createServerClient();
    let query = supabase
      .from("contacts")
      .select("*, companies(company_name, canonical_domain, industry)", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .order("icp_score", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (companyId && isValidUUID(companyId)) {
      query = query.eq("company_id", companyId);
    }

    if (verificationStatus) {
      query = query.eq("verification_status", verificationStatus);
    }

    if (emailStatus) {
      query = query.eq("email_status", emailStatus);
    }

    // Secure search query against injection (includes company_name, baseName and acronym)
    if (rawSearch.trim()) {
      const baseName = (rawSearch.split("(")[0] || "").replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
      const safeFull = rawSearch.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
      const parenMatch = rawSearch.match(/\((.*?)\)/)?.[1]?.trim();
      const acronym = (parenMatch && parenMatch.length >= 2 && parenMatch.length <= 6 && !/^(india|group|ltd|pvt)$/i.test(parenMatch)) ? parenMatch : null;
      const searchTokens = Array.from(new Set([baseName, acronym, safeFull].filter((t): t is string => Boolean(t && t.length >= 2))));

      if (searchTokens.length > 0) {
        const orClauses = searchTokens.flatMap((t) => [
          `first_name.ilike.%${t}%`,
          `last_name.ilike.%${t}%`,
          `title.ilike.%${t}%`,
          `work_email.ilike.%${t}%`,
          `company_name.ilike.%${t}%`
        ]);

        query = query.or(Array.from(new Set(orClauses)).join(","));
      }
    }

    const { data: contacts, count, error } = await query;

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    // Flatten company fields
    const formatted = (contacts || []).map((c: any) => ({
      ...c,
      company_name: c.companies?.company_name || c.company_name || "Unassigned",
      company_domain: c.companies?.canonical_domain || c.company_domain || "",
      industry: c.companies?.industry || "",
    }));

    return apiSuccess({
      contacts: formatted,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to fetch contacts",
      500,
      "CONTACTS_FETCH_ERROR"
    );
  }
}
