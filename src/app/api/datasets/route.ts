import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionFromRequest, verifyWorkspaceAccess, DEMO_WORKSPACE_ID } from "@/lib/security/auth";
import { rateLimit } from "@/lib/security/rateLimit";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 80, windowMs: 60 * 1000, prefix: "datasets_get" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = session
      ? (session.role === "admin" ? (searchParams.get("workspaceId") || session.workspaceId) : session.workspaceId)
      : (searchParams.get("workspaceId") || DEMO_WORKSPACE_ID);

    const access = verifyWorkspaceAccess(session, workspaceId);
    if (!access.isAuthorized && access.errorResponse) {
      return access.errorResponse;
    }

    const supabase = createServerClient();
    const { data: profiles, error } = await supabase
      .from("icp_profiles")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    // Canonical dataset configuration map (fallback if not in profile criteria)
    const DATASET_SELLER_MAP: Record<string, { seller_name: string; seller_domain: string; campaign: string }> = {
      "EXTRIEVE_BFSI_2026-10-28": {
        seller_name: "Extrieve",
        seller_domain: "extrieve.com",
        campaign: "Extrieve - BFSI AI Prospecting",
      },
      "HDL_HFCL_2026-10-20": {
        seller_name: "HTL Ltd (HFCL Group)",
        seller_domain: "htllimited.com",
        campaign: "HTL Strategic Account Delivery",
      },
    };

    const datasets = (profiles || [])
      .map((p) => {
        const c = (p.criteria as Record<string, any>) || {};
        const tag = c.dataset || (p.name?.includes("Extrieve") ? "EXTRIEVE_BFSI_2026-10-28" : "HDL_HFCL_2026-10-20");
        const mapEntry = DATASET_SELLER_MAP[tag] || {
          seller_name: c.seller_name || p.name?.split("-")[0]?.trim() || "Seller",
          seller_domain: c.seller_domain || "",
          campaign: p.name || "Analyst Research Delivery",
        };

        return {
          id: p.id,
          name: p.name,
          dataset: tag,
          seller_name: c.seller_name || mapEntry.seller_name,
          seller_domain: c.seller_domain || mapEntry.seller_domain,
          campaign: mapEntry.campaign,
          accounts_count: c.accounts_count || (tag === "EXTRIEVE_BFSI_2026-10-28" ? 124 : 25),
          signals_count: c.signals_count || (tag === "EXTRIEVE_BFSI_2026-10-28" ? 305 : 64),
          contacts_count: c.contacts_count ?? (tag === "EXTRIEVE_BFSI_2026-10-28" ? 0 : 168),
          personas: c.personas || [],
          exclusions: c.exclusions || [],
          created_at: p.created_at,
        };
      })
      .filter((d) => d.dataset);

    const requestedDataset = searchParams.get("dataset");
    let companies: any[] = [];
    let signals: any[] = [];

    if (requestedDataset) {
      const { data: compData } = await supabase
        .from("companies")
        .select("*")
        .eq("workspace_id", workspaceId)
        .ilike("icp_fit_reason", `%${requestedDataset}%`)
        .order("icp_score", { ascending: false });
      companies = compData || [];

      const { data: sigData } = await supabase
        .from("signals")
        .select("*")
        .eq("workspace_id", workspaceId)
        .ilike("explanation", `%${requestedDataset}%`)
        .order("created_at", { ascending: false });
      signals = sigData || [];
    }

    return apiSuccess({
      datasets,
      companies,
      signals,
    });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to fetch datasets",
      500,
      "DATASETS_ERROR"
    );
  }
}
