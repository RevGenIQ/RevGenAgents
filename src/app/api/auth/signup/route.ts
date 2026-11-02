import { NextRequest } from "next/server";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import {
  validateCompanyEmail,
  validateCompanyDomain,
  sanitizeHtml,
} from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) {
      return csrf.errorResponse;
    }

    const body = await request.json().catch(() => ({}));
    const {
      fullName = "",
      email = "",
      companyDomain = "",
      companyName = "",
      jobTitle = "",
      phone = "",
      prospectingGoal = "",
    } = body;

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedDomain = String(companyDomain).trim().toLowerCase();
    const cleanFullName = sanitizeHtml(String(fullName).trim());
    const cleanCompanyName = sanitizeHtml(String(companyName).trim());
    const cleanJobTitle = sanitizeHtml(String(jobTitle).trim());
    const cleanPhone = sanitizeHtml(String(phone).trim());
    const cleanGoal = sanitizeHtml(String(prospectingGoal).trim());

    if (!trimmedEmail || !cleanFullName) {
      return apiError("Full name and working email are required.", 400, "MISSING_FIELDS");
    }

    const emailValidation = validateCompanyEmail(trimmedEmail);
    if (!emailValidation.isValid) {
      return apiError(
        emailValidation.error || "Please register using your company working email address.",
        400,
        "INVALID_COMPANY_EMAIL"
      );
    }

    let domainToValidate = trimmedDomain || emailValidation.domain || "";
    const domainValidation = validateCompanyDomain(domainToValidate);
    if (!domainValidation.isValid) {
      return apiError(
        domainValidation.error || "A valid company domain is required.",
        400,
        "INVALID_COMPANY_DOMAIN"
      );
    }

    const cleanDomain = domainValidation.cleanedDomain!;
    const finalCompanyName =
      cleanCompanyName || cleanDomain.split(".")[0].toUpperCase();

    const supabase = createServerClient();

    // Check if there is already a pending request for this email
    const { data: existingReq } = await supabase
      .from("client_access_requests")
      .select("id, status")
      .eq("work_email", trimmedEmail)
      .maybeSingle();

    if (existingReq) {
      if (existingReq.status === "approved") {
        return apiError(
          "Your company request has already been approved by Admin! Please sign in using the generated credentials sent to your email.",
          400,
          "ALREADY_APPROVED"
        );
      }
      return apiSuccess({
        pendingApproval: true,
        message:
          "Your request is already in the Admin approval queue. Once the Admin approves your request, your generated Login ID & Password will be sent to your email.",
      });
    }

    const { error: insertErr } = await supabase.from("client_access_requests").insert({
      company_name: finalCompanyName,
      company_domain: cleanDomain,
      spokesperson_name: cleanFullName,
      work_email: trimmedEmail,
      job_title: cleanJobTitle || "Company Spokesperson",
      phone: cleanPhone,
      prospecting_goal:
        cleanGoal || "B2B Account Prospecting & Verified Decision-Maker Enrichment",
      status: "pending",
    });

    if (insertErr) {
      return apiError(insertErr.message, 500, "DB_INSERT_ERROR");
    }

    return apiSuccess(
      {
        pendingApproval: true,
        message: `Access request submitted for ${finalCompanyName} (${trimmedEmail}). Once the Admin approves your request, your generated Login ID & Password will be sent to ${trimmedEmail}.`,
      },
      201
    );
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to submit registration request",
      500,
      "REGISTRATION_ERROR"
    );
  }
}
