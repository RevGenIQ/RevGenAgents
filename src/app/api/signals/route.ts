import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { getSessionFromRequest, verifyWorkspaceAccess, DEMO_WORKSPACE_ID } from "@/lib/security/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 80, windowMs: 60 * 1000, prefix: "signals_get" });
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

    const signalType = searchParams.get("signalType") || "";
    const minConfidence = Math.min(1, Math.max(0, parseFloat(searchParams.get("minConfidence") || "0")));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    const supabase = createServerClient();
    let query = supabase
      .from("signals")
      .select("*, companies(company_name, canonical_domain)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (signalType) {
      query = query.eq("signal_type", signalType);
    }

    if (minConfidence > 0) {
      query = query.gte("confidence", minConfidence);
    }

    const { data: signals, error } = await query;

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    const formatted = (signals || []).map((s: any) => ({
      ...s,
      company_name: s.companies?.company_name || s.company_name || "Unknown Company",
      company_domain: s.companies?.canonical_domain || s.company_domain || "",
    }));

    return apiSuccess({ signals: formatted });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to fetch signals",
      500,
      "SIGNALS_FETCH_ERROR"
    );
  }
}
