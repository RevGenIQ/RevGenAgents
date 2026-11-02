import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import {
  getSessionFromRequest,
  verifyWorkspaceAccess,
  DEMO_WORKSPACE_ID,
} from "@/lib/security/auth";
import {
  validateBatchRows,
  validateCompanyDomain,
  sanitizeHtml,
} from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF Protection
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    // 2. Rate Limit: 10 import batches per minute
    const rl = rateLimit(request, {
      max: 10,
      windowMs: 60 * 1000,
      prefix: "import_post",
    });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const body = await request.json().catch(() => ({}));

    // Strict multi-tenant scoping: members can ONLY import into their own workspace
    const workspaceId = session
      ? session.role === "admin"
        ? body.workspaceId || session.workspaceId
        : session.workspaceId
      : DEMO_WORKSPACE_ID;

    // 3. Authorization check
    const access = verifyWorkspaceAccess(session, workspaceId);
    if (!access.isAuthorized && access.errorResponse) {
      return access.errorResponse;
    }

    const { rows = [], fileName = "upload.csv" } = body;

    // 4. Batch validation (max 500 rows to prevent DoS)
    const batchValidation = validateBatchRows(rows, 500);
    if (!batchValidation.isValid) {
      return apiError(
        batchValidation.error || "Invalid file rows",
        400,
        "INVALID_BATCH"
      );
    }

    const cleanFileName = sanitizeHtml(String(fileName).slice(0, 100));
    const supabase = createServerClient();

    let insertedCompanies = 0;
    let insertedContacts = 0;
    let insertedSignals = 0;
    let updatedRecords = 0;
    let errorRows = 0;

    for (const row of rows as Record<string, any>[]) {
      try {
        const companyName = sanitizeHtml(
          String(
            row.Company ||
              row.company ||
              row.companyName ||
              row["Company Name"] ||
              "Unnamed Company"
          ).slice(0, 150)
        );

        let rawDomain = String(
          row.Domain || row.domain || row.website || ""
        ).trim();

        const email = String(
          row.Email ||
            row.email ||
            row.workEmail ||
            row["Work Email"] ||
            ""
        )
          .trim()
          .toLowerCase();

        if (!rawDomain && email.includes("@")) {
          rawDomain = email.split("@")[1];
        }

        const domainValidation = validateCompanyDomain(rawDomain);
        if (!domainValidation.isValid && !email) {
          errorRows++;
          continue;
        }

        const domain =
          domainValidation.cleanedDomain ||
          rawDomain.toLowerCase().replace(/[^a-z0-9.-]/g, "");

        // Persona & contact details
        const rawContactName = String(
          row["Contact Name"] || row.contactName || row.name || ""
        ).trim();
        const firstName = sanitizeHtml(
          String(
            row.firstName ||
              row["First Name"] ||
              rawContactName.split(" ")[0] ||
              ""
          ).slice(0, 80)
        );
        const lastName = sanitizeHtml(
          String(
            row.lastName ||
              row["Last Name"] ||
              rawContactName.split(" ").slice(1).join(" ") ||
              ""
          ).slice(0, 80)
        );
        const title = sanitizeHtml(
          String(row.Title || row.title || row.role || "Executive").slice(
            0,
            100
          )
        );
        const personaRole = sanitizeHtml(
          String(
            row["Persona Role"] || row.personaRole || row.persona_role || "Influencer"
          ).slice(0, 50)
        );
        const linkedin = String(
          row.LinkedIn || row.linkedin || row.personalLinkedin || ""
        ).slice(0, 250);
        const city = sanitizeHtml(
          String(row.City || row.city || "").slice(0, 80)
        );
        const country = sanitizeHtml(
          String(row.Country || row.country || "").slice(0, 80)
        );
        const rawScore = parseInt(
          String(row["ICP Score"] || row.icpScore || row.score || "85"),
          10
        );
        const icpScore = isNaN(rawScore) ? 85 : Math.min(100, Math.max(0, rawScore));
        const emailStatus = [
          "deliverable",
          "catch_all",
          "undeliverable",
          "unverified",
        ].includes(row["Email Status"] || row.emailStatus)
          ? row["Email Status"] || row.emailStatus
          : "unverified";

        // Signal fields
        const signalType = sanitizeHtml(
          String(row["Signal Type"] || row.signalType || row.signal_type || "").slice(0, 50)
        );
        const evidence = sanitizeHtml(
          String(row.Evidence || row.evidence || row.supporting_excerpt || "").slice(0, 500)
        );
        const sourceUrl = String(
          row["Source URL"] || row.sourceUrl || row.source_url || ""
        ).trim();
        const sourceDate = String(
          row["Source Date"] || row.sourceDate || row.source_date || ""
        ).trim();
        const confidence = parseFloat(
          String(row.Confidence || row.confidence || "0.90")
        ) || 0.9;

        // Deduplicate company by canonical_domain in this workspace
        let companyId: string;
        const { data: existingCompany } = await supabase
          .from("companies")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("canonical_domain", domain)
          .maybeSingle();

        if (existingCompany) {
          companyId = existingCompany.id;
          updatedRecords++;
        } else {
          const { data: newComp, error: compErr } = await supabase
            .from("companies")
            .insert({
              workspace_id: workspaceId,
              canonical_domain: domain,
              company_name: companyName,
              company_city: city,
              company_country: country,
              icp_score: icpScore,
              icp_fit_reason: "[Origin: imported research] Imported via CSV batch",
            })
            .select("id")
            .single();

          if (compErr || !newComp) {
            errorRows++;
            continue;
          }
          companyId = newComp.id;
          insertedCompanies++;
        }

        // Insert Signal if provided
        if (sourceUrl && evidence) {
          await supabase.from("signals").insert({
            workspace_id: workspaceId,
            company_id: companyId,
            signal_type: signalType || "business_expansion",
            title: `${companyName} - ${signalType || "Operational Milestone"}`,
            supporting_excerpt: evidence,
            evidence_url: sourceUrl,
            event_date: sourceDate || new Date().toISOString().split("T")[0],
            publication_date: sourceDate || null,
            confidence: Math.min(1, Math.max(0, confidence)),
            explanation: "Imported signal from CSV research dataset.",
            source_layer: "Imported Research",
            is_confirmed_fact: true,
          });
          insertedSignals++;
        }

        // Deduplicate contact by work_email within workspace
        if (email && email.includes("@")) {
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("work_email", email)
            .maybeSingle();

          if (!existingContact) {
            await supabase.from("contacts").insert({
              workspace_id: workspaceId,
              company_id: companyId,
              first_name: firstName || "Leader",
              last_name: lastName || "",
              title,
              work_email: email,
              personal_linkedin: linkedin,
              contact_city: city,
              contact_country: country,
              verification_status:
                emailStatus === "deliverable"
                  ? "verified_current"
                  : "unverified",
              email_status: emailStatus,
              icp_score: icpScore,
              icp_reason: `[Origin: imported research] [Role: ${personaRole}] ${title}. Deliverability: ${emailStatus}.`,
            });
            insertedContacts++;
          }
        }
      } catch {
        errorRows++;
      }
    }

    // Log import in audit logs
    await supabase.from("audit_logs").insert({
      workspace_id: workspaceId,
      actor_email: session?.email || "user@revgeniq.os",
      action: "csv_import_completed",
      target_type: "import",
      details: {
        file_name: cleanFileName,
        total_rows: rows.length,
        inserted_companies: insertedCompanies,
        inserted_contacts: insertedContacts,
        inserted_signals: insertedSignals,
        duplicates_updated: updatedRecords,
        errors: errorRows,
        origin: "imported research",
      },
    });

    return apiSuccess({
      stats: {
        totalRows: rows.length,
        insertedCompanies,
        insertedContacts,
        insertedSignals,
        updatedRecords,
        errorRows,
      },
    });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to process import",
      500,
      "IMPORT_PROCESS_ERROR"
    );
  }
}
