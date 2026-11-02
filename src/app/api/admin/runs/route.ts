import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/security/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createServerClient } from "@/lib/supabase/server";


export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "admin") {
      return apiError("Forbidden: Super Admin privileges required.", 403, "FORBIDDEN");
    }

    const supabase = createServerClient();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const workspaceId = searchParams.get("workspaceId") || "";

    let query = supabase
      .from("research_runs")
      .select("*, workspaces(name, domain)")
      .order("created_at", { ascending: false });

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: runs, error } = await query;

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    let formattedRuns = (runs || []).map((r: any) => ({
      ...r,
      workspace_name: r.workspaces?.name || "Acme Growth AI",
      workspace_domain: r.workspaces?.domain || "acmegrowth.com",
    }));

    if (search) {
      const lower = search.toLowerCase();
      formattedRuns = formattedRuns.filter(
        (r) =>
          r.name?.toLowerCase().includes(lower) ||
          r.workspace_name?.toLowerCase().includes(lower) ||
          r.current_step?.toLowerCase().includes(lower)
      );
    }

    return apiSuccess({ runs: formattedRuns });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to fetch global runs",
      500,
      "ADMIN_RUNS_ERROR"
    );
  }
}
