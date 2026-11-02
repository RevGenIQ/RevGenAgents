import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { executeResearchRun } from "@/lib/engine/researchRunner";
import { rateLimit } from "@/lib/security/rateLimit";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { getSessionFromRequest, verifyWorkspaceAccess, DEMO_WORKSPACE_ID } from "@/lib/security/auth";
import { sanitizeHtml } from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    // 1. Rate Limit: 60 requests/min
    const rl = rateLimit(request, { max: 60, windowMs: 60 * 1000, prefix: "runs_get" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const searchParams = request.nextUrl.searchParams;

    // Strict multi-tenant resolution: members can ONLY query their own workspace
    const requestedWorkspaceId = session
      ? (session.role === "admin" ? (searchParams.get("workspaceId") || session.workspaceId) : session.workspaceId)
      : (searchParams.get("workspaceId") || DEMO_WORKSPACE_ID);

    // 2. Authorization check
    const access = verifyWorkspaceAccess(session, requestedWorkspaceId);
    if (!access.isAuthorized && access.errorResponse) {
      return access.errorResponse;
    }

    const supabase = createServerClient();
    const { data: runs, error } = await supabase
      .from("research_runs")
      .select("*")
      .eq("workspace_id", requestedWorkspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    return apiSuccess({ runs: runs || [] });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to fetch runs",
      500,
      "RUNS_FETCH_ERROR"
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF Verification
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    // 2. Rate Limit: 15 search launches per minute
    const rl = rateLimit(request, { max: 15, windowMs: 60 * 1000, prefix: "runs_post" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const body = await request.json().catch(() => ({}));

    // Strict multi-tenant scoping: members can ONLY insert into their own workspace
    const targetWorkspaceId = session
      ? (session.role === "admin" ? (body.workspaceId || session.workspaceId) : session.workspaceId)
      : DEMO_WORKSPACE_ID;

    // 3. Authorization check
    const access = verifyWorkspaceAccess(session, targetWorkspaceId);
    if (!access.isAuthorized && access.errorResponse) {
      return access.errorResponse;
    }

    const {
      name,
      targetCount = 5,
      minIcpScore = 80,
      includeDm = true,
      maximizeCoverage = true,
      liveSearch = false,
      icpInput = {},
    } = body;

    // 4. Input Validation & Bounds Checking
    const boundedTargetCount = Math.min(Math.max(1, Number(targetCount) || 5), 50);
    const boundedIcpScore = Math.min(Math.max(50, Number(minIcpScore) || 80), 99);
    const cleanName = sanitizeHtml(
      String(
        name ||
        `Search: ${icpInput.website || icpInput.description?.slice(0, 30) || "Targeted Accounts"}`
      ).trim()
    );

    const supabase = createServerClient();
    const { data: newRun, error } = await supabase
      .from("research_runs")
      .insert({
        workspace_id: targetWorkspaceId,
        name: cleanName,
        status: "queued",
        target_count: boundedTargetCount,
        min_icp_score: boundedIcpScore,
        include_dm: Boolean(includeDm),
        maximize_coverage: Boolean(maximizeCoverage),
        live_search: Boolean(liveSearch),
        icp_input: icpInput,
        progress_percent: 0,
        current_step: "Run queued. Orchestrating research tasks...",
        leads_found: 0,
        leads_verified: 0,
        stop_requested: false,
      })
      .select()
      .single();

    if (error || !newRun) {
      return apiError(error?.message || "Failed to create run", 500, "DB_INSERT_ERROR");
    }

    // Trigger background research execution asynchronously without blocking HTTP response
    (async () => {
      try {
        await executeResearchRun(newRun.id);
      } catch (e) {
        console.error("Background run error:", e);
      }
    })();

    // Audit log
    await supabase.from("audit_logs").insert({
      workspace_id: targetWorkspaceId,
      actor_email: session?.email || "user@revgeniq.os",
      action: "run_created",
      target_type: "research_run",
      target_id: newRun.id,
      details: {
        name: cleanName,
        target_count: boundedTargetCount,
        min_icp_score: boundedIcpScore,
      },
    });

    return apiSuccess({ run: newRun }, 201);
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to trigger run",
      500,
      "RUN_TRIGGER_ERROR"
    );
  }
}
