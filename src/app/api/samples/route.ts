import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionFromRequest } from "@/lib/security/auth";
import { rateLimit } from "@/lib/security/rateLimit";
import { isSuspendedClient } from "@/lib/security/workspaceAccess";
import { apiError, apiSuccess } from "@/lib/api/response";
import { RUN_ACCOUNT_COLUMNS, mapRunAccount } from "@/lib/accounts/runAccount";

/**
 * The client's free-sample state: plan, sample status, the sample run's
 * progress and its accounts. While the run is going this includes draft rows
 * (so the live grid can show research in progress); afterwards only the
 * accounts that were delivered.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 90, windowMs: 60 * 1000, prefix: "samples_get" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    if (!session) return apiError("Authentication required.", 401, "UNAUTHORIZED");
    if (session.role !== "client") return apiError("Samples belong to client workspaces.", 403, "FORBIDDEN");

    const supabase = createServerClient();
    if (await isSuspendedClient(supabase, session)) return apiError("This workspace is suspended.", 403, "ACCOUNT_SUSPENDED");

    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .select("id, plan, sample_status, sample_run_id, icp_brief")
      .eq("id", session.workspaceId)
      .maybeSingle();
    if (wsErr) return apiError("Could not load your workspace.", 500, "DB_ERROR");
    if (!ws) return apiError("Workspace not found.", 404, "NOT_FOUND");

    let run: Record<string, unknown> | null = null;
    let accounts: ReturnType<typeof mapRunAccount>[] = [];
    if (ws.sample_run_id) {
      const [{ data: runRow }, { data: rows, error: rowsErr }] = await Promise.all([
        supabase
          .from("research_runs")
          .select("id, status, progress_percent, current_step, leads_found, error_message, created_at, completed_at")
          .eq("id", ws.sample_run_id)
          .eq("workspace_id", ws.id)
          .maybeSingle(),
        supabase
          .from("companies")
          .select(RUN_ACCOUNT_COLUMNS)
          .eq("workspace_id", ws.id)
          .eq("run_id", ws.sample_run_id)
          .order("created_at", { ascending: true }),
      ]);
      if (rowsErr) return apiError("Could not load your sample accounts.", 500, "DB_ERROR");
      run = runRow;
      const all = ((rows || []) as unknown as Record<string, unknown>[]).map(mapRunAccount);
      const finished = ws.sample_status === "delivered";
      accounts = finished ? all.filter((a) => a.stage === "published_to_client") : all;
    }

    return apiSuccess({
      tier: ws.plan,
      sampleStatus: ws.sample_status,
      hasIcp: !!ws.icp_brief && Object.keys(ws.icp_brief as object).length > 0,
      icpBrief: ws.icp_brief || null,
      run,
      accounts,
    });
  } catch (err: unknown) {
    console.error("Sample status failed", err);
    return apiError("Could not load your samples.", 500, "SAMPLES_ERROR");
  }
}
