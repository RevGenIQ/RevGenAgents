import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { getSessionFromRequest, verifyWorkspaceAccess, DEMO_WORKSPACE_ID } from "@/lib/security/auth";
import { sanitizeSearchQuery } from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 80, windowMs: 60 * 1000, prefix: "companies_get" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const searchParams = request.nextUrl.searchParams;

    // Strict multi-tenant resolution: members can ONLY query their own workspace
    const workspaceId = session
      ? (session.role === "admin" ? (searchParams.get("workspaceId") || session.workspaceId) : session.workspaceId)
      : (searchParams.get("workspaceId") || DEMO_WORKSPACE_ID);

    const access = verifyWorkspaceAccess(session, workspaceId);
    if (!access.isAuthorized && access.errorResponse) {
      return access.errorResponse;
    }

    const rawSearch = searchParams.get("search") || "";
    const cleanSearch = sanitizeSearchQuery(rawSearch);
    const rawIndustry = searchParams.get("industry") || "";
    const cleanIndustry = sanitizeSearchQuery(rawIndustry);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const offset = (page - 1) * limit;

    const supabase = createServerClient();
    let query = supabase
      .from("companies")
      .select("*", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .order("icp_score", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (rawSearch.trim()) {
      // PostgREST .or() filter parser treats '(' and ')' as grouping delimiters and ',' as separator.
      // Extract base company name before parens (e.g. "Tata Advanced Systems Ltd" from "Tata Advanced Systems Ltd (TASL)")
      const baseName = (rawSearch.split("(")[0] || "").replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
      const safeFull = rawSearch.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
      const parenMatch = rawSearch.match(/\((.*?)\)/)?.[1]?.trim();
      const acronym = (parenMatch && parenMatch.length >= 2 && parenMatch.length <= 6 && !/^(india|group|ltd|pvt)$/i.test(parenMatch)) ? parenMatch : null;
      
      const searchTokens = Array.from(new Set([baseName, acronym, safeFull].filter((t): t is string => Boolean(t && t.length >= 2))));

      if (searchTokens.length > 0) {
        const orClauses = searchTokens.flatMap((t) => [
          `company_name.ilike.%${t}%`,
          `canonical_domain.ilike.%${t}%`,
          `company_city.ilike.%${t}%`
        ]);

        query = query.or(Array.from(new Set(orClauses)).join(","));
      }
    }

    if (cleanIndustry) {
      query = query.ilike("industry", `%${cleanIndustry}%`);
    }

    const { data: companies, count, error } = await query;

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    return apiSuccess({
      companies: companies || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to fetch companies",
      500,
      "COMPANIES_FETCH_ERROR"
    );
  }
}
