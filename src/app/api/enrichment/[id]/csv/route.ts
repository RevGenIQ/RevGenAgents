import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionFromRequest, UUID_PATTERN } from "@/lib/security/auth";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { rateLimit } from "@/lib/security/rateLimit";
import { apiError, apiSuccess } from "@/lib/api/response";
import { accountsToCsv } from "@/lib/accounts/csv";
import { parseEnrichmentCsv } from "@/lib/enrichment/importCsv";
import { deliveredRunAccounts, isStaffOnRequest, loadRequest, postChannelNotice, workspaceSignals } from "@/lib/enrichment/service";

const MAX_UPLOAD_BYTES = 2_000_000;

async function staffRequest(request: NextRequest, id: string) {
  const session = getSessionFromRequest(request);
  if (!session) return { error: apiError("Authentication required.", 401, "UNAUTHORIZED") };
  if (!UUID_PATTERN.test(id)) return { error: apiError("Invalid request id.", 400, "INVALID_ID") };
  const supabase = createServerClient();
  const req = await loadRequest(supabase, id);
  if (!req || !isStaffOnRequest(session, req)) return { error: apiError("Request not found.", 404, "NOT_FOUND") };
  return { session, supabase, req };
}

/** The delivery CSV for the request's accounts, with blank contact rows for the Humagent to fill. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rl = rateLimit(request, { max: 30, windowMs: 60 * 1000, prefix: "enrichment_csv_get" });
    if (!rl.allowed && rl.response) return rl.response;
    const ctx = await staffRequest(request, (await params).id);
    if ("error" in ctx) return ctx.error;
    const { supabase, req } = ctx;
    if (!req.run_id) return apiError("This request has no research run.", 409, "NO_RUN");

    const [accounts, signals] = await Promise.all([
      deliveredRunAccounts(supabase, req.workspace_id, req.run_id),
      workspaceSignals(supabase, req.workspace_id),
    ]);
    const extraHeaders = [...new Set(accounts.flatMap((a) => Object.keys(a.extraContext)))];
    const csv = accountsToCsv(accounts, { requiredSignals: signals, includeContacts: true, extraHeaders });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="enrichment-${req.id.slice(0, 8)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Enrichment CSV export failed", err);
    return apiError("Could not build the CSV.", 500, "CSV_ERROR");
  }
}

/** Uploads the enriched CSV. It is validated and staged on the request until the Admin approves it. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;
    const rl = rateLimit(request, { max: 10, windowMs: 60 * 1000, prefix: "enrichment_csv_post" });
    if (!rl.allowed && rl.response) return rl.response;
    const ctx = await staffRequest(request, (await params).id);
    if ("error" in ctx) return ctx.error;
    const { session, supabase, req } = ctx;
    if (!["assigned", "in_progress", "submitted"].includes(req.status)) {
      return apiError("This request is not open for uploads.", 409, "INVALID_STATE");
    }

    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_UPLOAD_BYTES) return apiError("The file is too large (2 MB max).", 413, "TOO_LARGE");
    const text = await request.text();
    if (text.length > MAX_UPLOAD_BYTES) return apiError("The file is too large (2 MB max).", 413, "TOO_LARGE");

    const parsed = parseEnrichmentCsv(text);
    if (!parsed.ok) return apiError(parsed.error, 400, "INVALID_CSV");

    const { error } = await supabase
      .from("enrichment_requests")
      .update({
        status: "submitted",
        payload: parsed.payload,
        csv_rows: text.split(/\r?\n/).length - 1,
        submitted_at: new Date().toISOString(),
        submitted_by: session.email,
        admin_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.id)
      .in("status", ["assigned", "in_progress", "submitted"]);
    if (error) return apiError("Could not save the upload.", 500, "DB_ERROR");

    await postChannelNotice(
      supabase,
      req.workspace_id,
      "Enriched accounts were submitted and are being reviewed by the Admin.",
      { event: "enrichment_submitted", requestId: req.id }
    );
    return apiSuccess({
      staged: { companies: parsed.payload.companies.length, contacts: parsed.payload.contacts.length },
      warnings: parsed.payload.warnings,
    });
  } catch (err) {
    console.error("Enrichment CSV upload failed", err);
    return apiError("Could not process the CSV.", 500, "CSV_ERROR");
  }
}
