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

    // 1. Total Workspaces
    const { count: workspaceCount } = await supabase
      .from("workspaces")
      .select("*", { count: "exact", head: true });

    // 2. Total Research Runs
    const { count: totalRuns } = await supabase
      .from("research_runs")
      .select("*", { count: "exact", head: true });

    // 3. Completed Runs
    const { count: completedRuns } = await supabase
      .from("research_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    // 4. Total Verified Contacts
    const { count: totalContacts } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true });

    // 5. Total Signals Captured
    const { count: totalSignals } = await supabase
      .from("signals")
      .select("*", { count: "exact", head: true });

    // 6. Usage & MCP Telemetry
    const { data: usageRecords } = await supabase
      .from("usage_events")
      .select("provider, tokens_used, cost_usd, api_calls");

    let totalTokens = 0;
    let totalCostUsd = 0;
    let totalApiCalls = 0;

    (usageRecords || []).forEach((r) => {
      totalTokens += Number(r.tokens_used || 0);
      totalCostUsd += Number(r.cost_usd || 0);
      totalApiCalls += Number(r.api_calls || 1);
    });

    // 7. Security & Audit summary
    const { data: recentAudits } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    const activeRuns = Math.max(0, (totalRuns || 0) - (completedRuns || 0));

    return apiSuccess({
      overview: {
        totalWorkspaces: workspaceCount || 0,
        totalRuns: totalRuns || 0,
        completedRuns: completedRuns || 0,
        totalContacts: totalContacts || 0,
        totalSignals: totalSignals || 0,
        totalTokens: totalTokens,
        totalCostUsd: Number(totalCostUsd.toFixed(2)),
        totalApiCalls: totalApiCalls,
        activeAutonomousAgents: activeRuns,
        securityThreatsBlocked: 0,
        rateLimitViolationsPrevented: 0,
      },
      recentAudits: recentAudits || [],
    });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to load admin overview",
      500,
      "ADMIN_OVERVIEW_ERROR"
    );
  }
}
