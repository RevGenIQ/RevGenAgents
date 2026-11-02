import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { AWAITING_REVIEW_PREFIX } from "@/lib/agents/types";
import { getSessionFromRequest } from "@/lib/security/auth";
import { rateLimit } from "@/lib/security/rateLimit";
import { listAccessibleWorkspaceIds } from "@/lib/security/workspaceAccess";
import { apiError, apiSuccess } from "@/lib/api/response";

/**
 * Runs paused at humagentReview that the caller may review: every workspace for
 * the Admin, only assigned/allocated workspaces for a Humagent.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 60, windowMs: 60 * 1000, prefix: "runs_pending_review" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    if (!session) return apiError("Authentication required.", 401, "UNAUTHORIZED");
    if (session.role !== "admin" && session.role !== "humagent") {
      return apiError("Only the Admin or a Humagent can review runs.", 403, "FORBIDDEN");
    }

    const supabase = createServerClient();
    const workspaceIds = await listAccessibleWorkspaceIds(supabase, session);
    if (workspaceIds && workspaceIds.length === 0) return apiSuccess({ runs: [] });

    let query = supabase
      .from("research_runs")
      .select("id, workspace_id, name, current_step, leads_found, leads_verified, updated_at")
      .eq("status", "running")
      .like("current_step", `${AWAITING_REVIEW_PREFIX}%`)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (workspaceIds) query = query.in("workspace_id", workspaceIds);

    const { data: runs, error } = await query;
    if (error) return apiError(error.message, 500, "DB_ERROR");

    const runWorkspaceIds = Array.from(new Set((runs || []).map((r) => r.workspace_id)));
    const { data: workspaces, error: wsError } = runWorkspaceIds.length
      ? await supabase.from("workspaces").select("id, name").in("id", runWorkspaceIds)
      : { data: [], error: null };
    if (wsError) return apiError(wsError.message, 500, "DB_ERROR");

    const names = new Map((workspaces || []).map((w) => [w.id, w.name]));
    return apiSuccess({
      runs: (runs || []).map((r) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        workspaceName: names.get(r.workspace_id) || "Client workspace",
        name: r.name,
        currentStep: r.current_step,
        leadsFound: r.leads_found,
        leadsVerified: r.leads_verified,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Failed to load runs awaiting review", 500, "PENDING_REVIEW_ERROR");
  }
}
