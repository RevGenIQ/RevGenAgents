import { after, NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { executeResearchRun } from "@/lib/engine/researchRunner";
import { getSessionFromRequest, verifyWorkspaceAccess } from "@/lib/security/auth";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { isValidUUID } from "@/lib/security/validator";

// Research runs execute inside after(); give them the longest window the platform allows.
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid run identifier" }, { status: 400 });
    }
    const session = getSessionFromRequest(request);
    const supabase = createServerClient();

    // Fetch existing run
    const { data: existing, error: fetchErr } = await supabase
      .from("research_runs")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Validate tenant authorization
    const access = verifyWorkspaceAccess(session, existing.workspace_id);
    if (!access.isAuthorized) {
      return access.errorResponse!;
    }

    const { data: run, error } = await supabase
      .from("research_runs")
      .update({
        status: "queued",
        stop_requested: false,
        retry_count: (existing.retry_count || 0) + 1,
        progress_percent: 5,
        current_step: "Retrying research run with reset budget...",
        error_message: null,
      })
      .eq("id", id)
      // Only finished runs can be retried; filtering in the UPDATE makes this atomic,
      // so two concurrent retries cannot both start an executor.
      .in("status", ["completed", "stopped", "failed"])
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to retry run" }, { status: 500 });
    }
    if (!run) {
      return NextResponse.json({ error: "Run is already queued or running." }, { status: 409 });
    }

    // after() keeps the serverless invocation alive until the run finishes
    // (up to maxDuration); a detached promise would be frozen after the response.
    after(async () => {
      try {
        await executeResearchRun(id);
      } catch (e) {
        console.error("Retry run error:", e);
      }
    });

    await supabase.from("audit_logs").insert({
      workspace_id: run.workspace_id,
      actor_email: session?.email || "unknown",
      action: "run_retried",
      target_type: "research_run",
      target_id: id,
      details: { attempt: run.retry_count },
    });

    return NextResponse.json({ success: true, run });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to retry run" },
      { status: 500 }
    );
  }
}
