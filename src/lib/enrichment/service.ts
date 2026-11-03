/**
 * Server-side enrichment workflow: who may see or act on a request, loading a
 * run's accounts, and applying an approved payload to companies and contacts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserSession } from "../security/auth";
import { RUN_ACCOUNT_COLUMNS, mapRunAccount, type RunAccount } from "../accounts/runAccount";
import type { EnrichmentPayload, StagedContact } from "./importCsv";

export type EnrichmentStatus = "requested" | "assigned" | "in_progress" | "submitted" | "approved" | "delivered" | "rejected";

export interface EnrichmentRequestRow {
  id: string;
  workspace_id: string;
  run_id: string | null;
  status: EnrichmentStatus;
  client_note: string | null;
  requested_columns: string[];
  assigned_humagent_id: string | null;
  assigned_humagent_name: string | null;
  admin_note: string | null;
  csv_rows: number | null;
  payload: EnrichmentPayload | null;
  submitted_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export const OPEN_STATUSES: EnrichmentStatus[] = ["requested", "assigned", "in_progress", "submitted", "approved"];

export async function loadRequest(supabase: SupabaseClient, id: string): Promise<EnrichmentRequestRow | null> {
  const { data, error } = await supabase.from("enrichment_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load enrichment request: ${error.message}`);
  return (data as EnrichmentRequestRow) || null;
}

/** Client: own workspace. Humagent: only requests assigned to them. Admin: all. */
export function canView(session: UserSession, req: EnrichmentRequestRow): boolean {
  if (session.role === "admin") return true;
  if (session.role === "humagent") return req.assigned_humagent_id === session.userId;
  return req.workspace_id === session.workspaceId;
}

export function isStaffOnRequest(session: UserSession, req: EnrichmentRequestRow): boolean {
  return session.role === "admin" || (session.role === "humagent" && req.assigned_humagent_id === session.userId);
}

/** Accounts delivered to the client for a run (published rows only). */
export async function deliveredRunAccounts(supabase: SupabaseClient, workspaceId: string, runId: string): Promise<RunAccount[]> {
  const { data, error } = await supabase
    .from("companies")
    .select(RUN_ACCOUNT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("run_id", runId)
    .eq("delivery_stage", "published_to_client")
    .order("icp_score", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Could not load accounts: ${error.message}`);
  return ((data || []) as unknown as Record<string, unknown>[]).map(mapRunAccount);
}

export async function workspaceSignals(supabase: SupabaseClient, workspaceId: string): Promise<string[]> {
  const { data } = await supabase.from("workspaces").select("icp_brief").eq("id", workspaceId).maybeSingle();
  const signals = (data?.icp_brief as Record<string, unknown> | null)?.requiredSignals;
  return Array.isArray(signals) ? signals.map(String) : [];
}

/** Free-text email status -> the contacts.email_status values. */
export function normaliseEmailStatus(raw: string): "deliverable" | "catch_all" | "undeliverable" | "unverified" {
  const s = raw.toLowerCase();
  if (/catch/.test(s)) return "catch_all";
  if (/invalid|undeliver|bounce|bad/.test(s)) return "undeliverable";
  if (/deliver|valid|verified|ok/.test(s)) return "deliverable";
  return "unverified";
}

function contactCard(c: StagedContact): Record<string, unknown> {
  return {
    id: `contact-${c.email || `${c.firstName}-${c.lastName}`}`,
    name: `${c.firstName} ${c.lastName}`.trim(),
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title,
    email: c.email,
    emailStatus: c.emailStatus,
    workDirectPhone: c.workDirectPhone,
    mobilePhone: c.mobilePhone,
    phone: c.workDirectPhone || c.mobilePhone,
    seniority: c.seniority,
    department: c.department,
    subDepartment: c.subDepartment,
    linkedinUrl: c.linkedinUrl,
    address: c.address,
    city: c.city,
    state: c.state,
    country: c.country,
    location: [c.city, c.state, c.country].filter(Boolean).join(", "),
    verificationStatus: normaliseEmailStatus(c.emailStatus) === "deliverable" ? "Email verified" : "Email not verified",
    source: "Humagent enrichment",
  };
}

async function upsertContactRow(supabase: SupabaseClient, workspaceId: string, companyId: string, companyName: string, domain: string, c: StagedContact) {
  const fields = {
    workspace_id: workspaceId,
    company_id: companyId,
    company_name: companyName,
    company_domain: domain,
    first_name: c.firstName || "-",
    last_name: c.lastName || "-",
    title: c.title || "-",
    seniority: c.seniority || null,
    department: c.department || null,
    sub_department: c.subDepartment || null,
    work_email: c.email,
    personal_linkedin: c.linkedinUrl || null,
    mobile_number: c.mobilePhone || null,
    direct_number: c.workDirectPhone || null,
    work_direct_phone: c.workDirectPhone || null,
    contact_address: c.address || null,
    contact_city: c.city || null,
    contact_state: c.state || null,
    contact_country: c.country || null,
    email_status: normaliseEmailStatus(c.emailStatus),
    verification_status: "unverified",
  };
  const { data: existing, error: findErr } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("work_email", c.email)
    .limit(1);
  if (findErr) throw new Error(`Contact lookup failed: ${findErr.message}`);
  const id = existing?.[0]?.id as string | undefined;
  const { error } = id
    ? await supabase.from("contacts").update(fields).eq("id", id)
    : await supabase.from("contacts").insert(fields);
  if (error) throw new Error(`Contact save failed for ${c.email}: ${error.message}`);
}

/**
 * Applies an approved payload: updates (or adds) each company in the client's
 * workspace, merges extra context and field sources, replaces the contact
 * cards, and upserts contacts that have an email. Returns counts for the log.
 */
export async function applyPayload(
  supabase: SupabaseClient,
  req: EnrichmentRequestRow,
  payload: EnrichmentPayload
): Promise<{ companies: number; added: number; contacts: number }> {
  let added = 0;
  let contactCount = 0;
  for (const company of payload.companies) {
    const { data: row, error: findErr } = await supabase
      .from("companies")
      .select("id, company_name, extra_context_json, field_sources_json")
      .eq("workspace_id", req.workspace_id)
      .eq("canonical_domain", company.domain)
      .maybeSingle();
    if (findErr) throw new Error(`Company lookup failed for ${company.domain}: ${findErr.message}`);

    const staged = payload.contacts.filter((c) => c.domain === company.domain);
    const humagentSources = Object.fromEntries(
      Object.keys(company.columns).map((col) => [col, { value: String(company.columns[col] ?? ""), sourceUrl: "", method: "humagent" }])
    );
    const update = {
      ...company.columns,
      extra_context_json: { ...((row?.extra_context_json as object) || {}), ...company.extra },
      field_sources_json: { ...((row?.field_sources_json as object) || {}), ...humagentSources },
      ...(staged.length ? { contacts_json: staged.map(contactCard) } : {}),
      updated_at: new Date().toISOString(),
    };

    let companyId = row?.id as string | undefined;
    if (companyId) {
      const { error } = await supabase.from("companies").update(update).eq("id", companyId);
      if (error) throw new Error(`Company update failed for ${company.domain}: ${error.message}`);
    } else {
      const { data: inserted, error } = await supabase
        .from("companies")
        .insert({
          ...update,
          workspace_id: req.workspace_id,
          canonical_domain: company.domain,
          company_name: company.name,
          run_id: req.run_id,
          delivery_stage: "published_to_client",
          research_status: "done",
        })
        .select("id")
        .single();
      if (error || !inserted) throw new Error(`Could not add ${company.domain}: ${error?.message}`);
      companyId = inserted.id as string;
      added++;
    }

    for (const c of staged.filter((s) => s.email)) {
      await upsertContactRow(supabase, req.workspace_id, companyId, company.name, company.domain, c);
      contactCount++;
    }
  }
  return { companies: payload.companies.length, added, contacts: contactCount };
}

export async function postChannelNotice(supabase: SupabaseClient, workspaceId: string, content: string, metadata: Record<string, unknown>) {
  const { error } = await supabase.from("workspace_messages").insert({
    workspace_id: workspaceId,
    sender_role: "system",
    sender_name: "RevGen IQ",
    message_type: "system",
    content,
    metadata,
  });
  if (error) console.error("Enrichment channel notice failed", error.message);
}
