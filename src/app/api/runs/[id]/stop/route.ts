import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionFromRequest, verifyWorkspaceAccess } from "@/lib/security/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSessionFromRequest(request);
    const supabase = createServerClient();

    // 1. Fetch run to verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from("research_runs")
      .select("workspace_id")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // 2. Validate tenant access
    const access = verifyWorkspaceAccess(session, existing.workspace_id);
    if (!access.isAuthorized) {
      return access.errorResponse!;
    }

    const { data: run, error } = await supabase
      .from("research_runs")
      .update({
        stop_requested: true,
        status: "stopped",
        current_step: "Stopping research tasks... retaining verified results.",
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !run) {
      return NextResponse.json({ error: error?.message || "Failed to stop run" }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      workspace_id: run.workspace_id,
      actor_email: "user@revgeniq.os",
      action: "run_stopped",
      target_type: "research_run",
      target_id: id,
      details: { retained_leads: run.leads_verified },
    });

    return NextResponse.json({ success: true, run });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to stop run" },
      { status: 500 }
    );
  }
}
