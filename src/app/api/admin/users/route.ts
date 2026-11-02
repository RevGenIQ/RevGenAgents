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

    // Fetch all workspaces and their stats
    const { data: workspaces, error: wsErr } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false });

    if (wsErr) {
      return apiError(wsErr.message, 500, "DB_ERROR");
    }

    // Map real workspaces with their actual database metrics
    const tenantList = workspaces || [];
    const tenantsWithMetrics = await Promise.all(
      tenantList.map(async (ws) => {
        // Fetch run count
        const { count: runCount } = await supabase
          .from("research_runs")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", ws.id);

        // Fetch contacts count
        const { count: contactCount } = await supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", ws.id);

        // Fetch usage
        const { data: usage } = await supabase
          .from("usage_events")
          .select("tokens_used, cost_usd")
          .eq("workspace_id", ws.id);

        let creditsUsed = 0;
        (usage || []).forEach((u) => {
          creditsUsed += Number(u.tokens_used || 0);
        });

        // Fetch members
        const { data: members } = await supabase
          .from("workspace_members")
          .select("business_email, role")
          .eq("workspace_id", ws.id)
          .limit(1);

        const primaryEmail = members?.[0]?.business_email || `admin@${ws.domain || "workspace.internal"}`;

        return {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          domain: ws.domain || "domain-pending.com",
          created_at: ws.created_at,
          ownerEmail: primaryEmail,
          status: "active",
          planTier: "Enterprise Scale",
          creditsUsed: creditsUsed,
          creditsLimit: 50000,
          totalSearches: runCount || 0,
          totalLeadsExtracted: contactCount || 0,
          lastActive: ws.updated_at || ws.created_at,
        };
      })
    );

    return apiSuccess({ tenants: tenantsWithMetrics });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to fetch admin users",
      500,
      "ADMIN_USERS_ERROR"
    );
  }
}
