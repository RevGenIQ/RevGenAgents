import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionFromRequest } from "@/lib/security/auth";
import { rateLimit } from "@/lib/security/rateLimit";
import { isSuspendedClient } from "@/lib/security/workspaceAccess";
import { apiError } from "@/lib/api/response";
import { deliveredRunAccounts } from "@/lib/enrichment/service";
import { renderAccountsPdf } from "@/lib/pdf/AccountsPdf";

export const runtime = "nodejs";

/** The client's delivered sample accounts (including any approved enrichment) as a designed PDF. */
export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 10, windowMs: 60 * 1000, prefix: "samples_pdf" });
    if (!rl.allowed && rl.response) return rl.response;
    const session = getSessionFromRequest(request);
    if (!session) return apiError("Authentication required.", 401, "UNAUTHORIZED");
    if (session.role !== "client") return apiError("Only clients download their sample PDF.", 403, "FORBIDDEN");

    const supabase = createServerClient();
    if (await isSuspendedClient(supabase, session)) return apiError("This workspace is suspended.", 403, "ACCOUNT_SUSPENDED");
    const { data: ws } = await supabase.from("workspaces").select("id, name, sample_status, sample_run_id").eq("id", session.workspaceId).maybeSingle();
    if (!ws?.sample_run_id || ws.sample_status !== "delivered") return apiError("Your sample is not ready yet.", 409, "NOT_READY");

    const accounts = await deliveredRunAccounts(supabase, ws.id, ws.sample_run_id);
    if (accounts.length === 0) return apiError("There are no delivered accounts to export.", 404, "NO_ACCOUNTS");

    const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const pdf = await renderAccountsPdf(accounts, ws.name, generatedAt);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        // ?inline=1 previews the PDF in the browser instead of downloading it.
        "Content-Disposition": `${request.nextUrl.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="revgeniq-accounts-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Sample PDF failed", err);
    return apiError("Could not build the PDF.", 500, "PDF_ERROR");
  }
}
