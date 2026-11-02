import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { getSessionFromRequest, verifyWorkspaceAccess } from "@/lib/security/auth";
import { isValidUUID } from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Rate Limit
    const rl = rateLimit(request, { max: 80, windowMs: 60 * 1000, prefix: "run_detail_get" });
    if (!rl.allowed && rl.response) return rl.response;

    const { id } = await params;
    if (!isValidUUID(id)) {
      return apiError("Invalid run identifier", 400, "INVALID_ID");
    }

    const supabase = createServerClient();

    // 2. Fetch run
    const { data: run, error: runError } = await supabase
      .from("research_runs")
      .select("*")
      .eq("id", id)
      .single();

    if (runError || !run) {
      return apiError("Run not found", 404, "NOT_FOUND");
    }

    // 3. Authorization check (prevent BOLA/IDOR)
    const session = getSessionFromRequest(request);
    if (session) {
      const access = verifyWorkspaceAccess(session, run.workspace_id);
      if (!access.isAuthorized && access.errorResponse) {
        return access.errorResponse;
      }
    }

    // 4. Fetch operational tasks for this run
    const { data: tasks } = await supabase
      .from("research_tasks")
      .select("*")
      .eq("run_id", id)
      .order("created_at", { ascending: true });

    // 5. Fetch companies, signals, contacts, dossiers, drafts (enforce dataset separation)
    const datasetTag = (run.icp_input as Record<string, any>)?.dataset ||
      (run.name?.includes("Extrieve") ? "EXTRIEVE_BFSI_2026-10-28" :
       run.name?.includes("HDL") || run.name?.includes("HTL") ? "HDL_HFCL_2026-10-20" : null);

    let compQuery = supabase
      .from("companies")
      .select("*")
      .eq("workspace_id", run.workspace_id);

    if (datasetTag) {
      compQuery = compQuery.ilike("icp_fit_reason", `%${datasetTag}%`).order("icp_score", { ascending: false });
    } else {
      compQuery = compQuery.order("created_at", { ascending: false }).limit(run.target_count || 10);
    }
    const { data: companies } = await compQuery;

    // 6. Fetch signals
    let sigQuery = supabase
      .from("signals")
      .select("*")
      .eq("workspace_id", run.workspace_id);

    if (datasetTag) {
      sigQuery = sigQuery.ilike("explanation", `%${datasetTag}%`).order("created_at", { ascending: false });
    } else {
      sigQuery = sigQuery.order("created_at", { ascending: false });
    }
    const { data: signals } = await sigQuery;

    // 7. Fetch contacts
    let contQuery = supabase
      .from("contacts")
      .select("*")
      .eq("workspace_id", run.workspace_id);

    if (datasetTag === "EXTRIEVE_BFSI_2026-10-28") {
      // Extrieve source has zero contacts
    } else if (datasetTag === "HDL_HFCL_2026-10-20") {
      contQuery = contQuery.ilike("icp_reason", `%${datasetTag}%`).order("created_at", { ascending: false });
    } else {
      contQuery = contQuery.order("created_at", { ascending: false });
    }
    const { data: contacts } = datasetTag === "EXTRIEVE_BFSI_2026-10-28"
      ? { data: [] }
      : await contQuery;

    // 8. Fetch dossiers
    let dosQuery = supabase
      .from("dossiers")
      .select("*")
      .eq("workspace_id", run.workspace_id);

    if (datasetTag === "EXTRIEVE_BFSI_2026-10-28") {
      dosQuery = dosQuery.ilike("summary", `%${datasetTag}%`);
    } else if (datasetTag === "HDL_HFCL_2026-10-20" && companies && companies.length > 0) {
      const htlIds = companies.map((c: any) => c.id);
      dosQuery = dosQuery.in("company_id", htlIds);
    } else {
      dosQuery = dosQuery.order("created_at", { ascending: false });
    }
    const { data: dossiers } = await dosQuery;

    // 9. Fetch drafts
    const { data: drafts } = await supabase
      .from("outreach_drafts")
      .select("*")
      .eq("workspace_id", run.workspace_id)
      .order("created_at", { ascending: false });

    return apiSuccess({
      run,
      tasks: tasks || [],
      companies: companies || [],
      signals: signals || [],
      contacts: contacts || [],
      dossiers: dossiers || [],
      drafts: drafts || [],
    });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to fetch run details",
      500,
      "RUN_DETAIL_ERROR"
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isValidUUID(id)) {
      return apiError("Invalid run identifier", 400, "INVALID_ID");
    }

    const supabase = createServerClient();

    // Delete associated research tasks first
    await supabase.from("research_tasks").delete().eq("run_id", id);

    // Delete the run record
    const { error } = await supabase.from("research_runs").delete().eq("id", id);
    if (error) {
      return apiError(error.message, 500, "DELETE_ERROR");
    }

    return apiSuccess({ message: "Research run deleted successfully", deletedId: id });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to delete run",
      500,
      "RUN_DELETE_ERROR"
    );
  }
}
