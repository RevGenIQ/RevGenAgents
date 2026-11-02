import { after, NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getPendingReview, isLangGraphEngine, resumeProspectingRun } from "@/lib/agents";
import { driveRun } from "@/lib/agents/continuation";
import { reviewResumeSchema } from "@/lib/agents/types";
import { getSessionFromRequest, verifyWorkspaceAccess, type UserSession } from "@/lib/security/auth";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { rateLimit } from "@/lib/security/rateLimit";
import { isValidUUID } from "@/lib/security/validator";
import { canAccessWorkspace } from "@/lib/security/workspaceAccess";
import { apiError, apiSuccess } from "@/lib/api/response";

// The resumed graph (publishToClient, finalize) runs inside after().
export const maxDuration = 300;

const AWAITING_REVIEW_PREFIX = "Awaiting Humagent review";

type ServerSupabase = ReturnType<typeof createServerClient>;

/**
 * Only the Admin or a Humagent assigned/allocated to the run's workspace may
 * review (P0-5). Returns the run's workspace id, or an error response.
 */
async function authorizeReviewer(
  supabase: ServerSupabase,
  session: UserSession | null,
  runId: string
): Promise<{ workspaceId: string } | { response: ReturnType<typeof apiError> }> {
  if (!session) return { response: apiError("Authentication required.", 401, "UNAUTHORIZED") };
  if (session.role !== "admin" && session.role !== "humagent") {
    return { response: apiError("Only the assigned Humagent or the Admin can review runs.", 403, "FORBIDDEN") };
  }

  const { data: run, error } = await supabase
    .from("research_runs")
    .select("workspace_id")
    .eq("id", runId)
    .maybeSingle();
  if (error) return { response: apiError(error.message, 500, "DB_ERROR") };
  if (!run) return { response: apiError("Run not found", 404, "RUN_NOT_FOUND") };

  if (session.role === "admin") {
    const access = verifyWorkspaceAccess(session, run.workspace_id);
    if (!access.isAuthorized && access.errorResponse) return { response: access.errorResponse };
  } else if (!(await canAccessWorkspace(supabase, session, run.workspace_id))) {
    return { response: apiError("This workspace is not assigned to you.", 403, "FORBIDDEN") };
  }
  return { workspaceId: run.workspace_id };
}

/** Returns the candidate cards the run is paused on. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = rateLimit(request, { max: 60, windowMs: 60 * 1000, prefix: "run_review_get" });
    if (!rl.allowed && rl.response) return rl.response;

    const { id } = await params;
    if (!isValidUUID(id)) return apiError("Invalid run identifier", 400, "INVALID_RUN_ID");

    const supabase = createServerClient();
    const auth = await authorizeReviewer(supabase, getSessionFromRequest(request), id);
    if ("response" in auth) return auth.response;

    if (!isLangGraphEngine()) return apiError("The LangGraph engine is not enabled.", 409, "ENGINE_DISABLED");
    const pending = await getPendingReview(id);
    return apiSuccess({ review: pending });
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Failed to load review", 500, "RUN_REVIEW_ERROR");
  }
}

/** Submits {decisions:[{companyId, action}]} and resumes the paused graph. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    const rl = rateLimit(request, { max: 20, windowMs: 60 * 1000, prefix: "run_review_post" });
    if (!rl.allowed && rl.response) return rl.response;

    const { id } = await params;
    if (!isValidUUID(id)) return apiError("Invalid run identifier", 400, "INVALID_RUN_ID");

    const session = getSessionFromRequest(request);
    const supabase = createServerClient();
    const auth = await authorizeReviewer(supabase, session, id);
    if ("response" in auth) return auth.response;

    if (!isLangGraphEngine()) return apiError("The LangGraph engine is not enabled.", 409, "ENGINE_DISABLED");

    const body = await request.json().catch(() => null);
    const parsed = reviewResumeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Body must be {decisions:[{companyId, action:'approve'|'reject'}]}.", 400, "INVALID_DECISIONS");
    }

    const pending = await getPendingReview(id);
    if (!pending) return apiError("Run is not awaiting review.", 409, "NOT_AWAITING_REVIEW");

    const cardIds = new Set(pending.cards.map((c) => c.companyId));
    const unknown = parsed.data.decisions.filter((d) => !cardIds.has(d.companyId));
    if (unknown.length > 0) {
      return apiError("Decisions reference accounts that are not in this review.", 400, "UNKNOWN_ACCOUNTS");
    }

    // Atomic claim: only the first submission moves the run off the review step,
    // so two reviewers cannot resume the same interrupt twice.
    const { data: claimed, error: claimErr } = await supabase
      .from("research_runs")
      .update({ current_step: "Applying Humagent review decisions..." })
      .eq("id", id)
      .like("current_step", `${AWAITING_REVIEW_PREFIX}%`)
      .select("id")
      .maybeSingle();
    if (claimErr) return apiError(claimErr.message, 500, "DB_ERROR");
    if (!claimed) return apiError("This review has already been submitted.", 409, "REVIEW_ALREADY_SUBMITTED");

    const { error: auditErr } = await supabase.from("audit_logs").insert({
      workspace_id: auth.workspaceId,
      actor_email: session?.email || "unknown",
      action: "run_review_submitted",
      target_type: "research_run",
      target_id: id,
      details: {
        approved: parsed.data.decisions.filter((d) => d.action === "approve").length,
        rejected: parsed.data.decisions.filter((d) => d.action === "reject").length,
      },
    });
    if (auditErr) console.error("Review audit log insert failed:", auditErr.message);

    after(async () => {
      try {
        await driveRun(id, () => resumeProspectingRun(id, parsed.data));
      } catch (e) {
        console.error("Review resume error:", e);
      }
    });

    return apiSuccess({ accepted: true, runId: id, decisions: parsed.data.decisions.length }, 202);
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Failed to submit review", 500, "RUN_REVIEW_ERROR");
  }
}
