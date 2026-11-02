import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { getSessionFromRequest, verifyWorkspaceAccess, DEMO_WORKSPACE_ID } from "@/lib/security/auth";
import { isValidUUID } from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 80, windowMs: 60 * 1000, prefix: "dossiers_get" });
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

    const companyId = searchParams.get("companyId");
    const supabase = createServerClient();

    let query = supabase
      .from("dossiers")
      .select("*, companies(*), contacts(*)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (companyId && isValidUUID(companyId)) {
      query = query.eq("company_id", companyId);
    }

    const { data: dossiers, error } = await query;

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    const formatted = (dossiers || []).map((d: any) => ({
      ...d,
      company_name: d.companies?.company_name || "Unknown Company",
      company_domain: d.companies?.canonical_domain || "",
      target_contact_name: d.contacts
        ? `${d.contacts.first_name || ""} ${d.contacts.last_name || ""}`.trim()
        : "Unassigned",
      target_contact_title: d.contacts?.title || "",
      target_contact_email: d.contacts?.work_email || "",
      target_contact_linkedin: d.contacts?.personal_linkedin || "",
    }));

    return apiSuccess({ dossiers: formatted });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to fetch dossiers",
      500,
      "DOSSIERS_FETCH_ERROR"
    );
  }
}
