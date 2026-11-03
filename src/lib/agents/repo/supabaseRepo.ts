/**
 * Supabase implementation of AgentRepo (service-role client, server-side only).
 * Column names follow supabase/migrations/20261016_full_production_schema.sql and
 * 20261031_phase1_revgeniq_os_schema.sql. Every Supabase error is raised as an
 * AgentRepoError; writes are idempotent so a resumed or retried run cannot duplicate rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentRepoError, type AgentRepo } from "../deps";
import { profileColumns } from "./companyColumns";

type PgError = { message: string } | null;

function check(operation: string, error: PgError): void {
  if (error) throw new AgentRepoError(operation, error.message);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function createSupabaseRepo(supabase: SupabaseClient): AgentRepo {
  return {
    async getRun(runId) {
      const { data, error } = await supabase
        .from("research_runs")
        .select("id, workspace_id, status, target_count, min_icp_score, icp_input")
        .eq("id", runId)
        .maybeSingle();
      check("getRun", error);
      if (!data) return null;
      return {
        id: data.id,
        workspaceId: data.workspace_id,
        status: data.status,
        targetCount: Number(data.target_count) || 5,
        minIcpScore: Number(data.min_icp_score) || 80,
        icpInput: asRecord(data.icp_input) || {},
      };
    },

    async getWorkspace(workspaceId) {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, icp_brief, dnc_entries")
        .eq("id", workspaceId)
        .maybeSingle();
      check("getWorkspace", error);
      if (!data) return null;
      return {
        id: data.id,
        name: data.name || "",
        icpBrief: asRecord(data.icp_brief),
        dncEntries: Array.isArray(data.dnc_entries) ? data.dnc_entries : [],
      };
    },

    async listDeliveredDomains(workspaceId) {
      const { data, error } = await supabase
        .from("companies")
        .select("canonical_domain")
        .eq("workspace_id", workspaceId)
        .eq("delivery_stage", "published_to_client");
      check("listDeliveredDomains", error);
      return (data || []).map((r) => String(r.canonical_domain || "")).filter(Boolean);
    },

    async isStopRequested(runId) {
      const { data, error } = await supabase
        .from("research_runs")
        .select("stop_requested")
        .eq("id", runId)
        .maybeSingle();
      check("isStopRequested", error);
      return !!data?.stop_requested;
    },

    async updateRun(runId, patch) {
      const { error } = await supabase
        .from("research_runs")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", runId);
      check("updateRun", error);
    },

    async recordTask(task) {
      const finished = task.status === "completed" || task.status === "failed";
      const { data, error } = await supabase
        .from("research_tasks")
        .insert({
          run_id: task.runId,
          workspace_id: task.workspaceId,
          task_type: task.taskType,
          company_name: task.companyName,
          company_domain: task.companyDomain,
          status: task.status,
          output_data: task.output,
          completed_at: finished ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      check("recordTask", error);
      return data?.id ?? null;
    },

    async completeTask(taskId, status, output) {
      const { error } = await supabase
        .from("research_tasks")
        .update({ status, output_data: output, completed_at: new Date().toISOString() })
        .eq("id", taskId);
      check("completeTask", error);
    },

    async upsertCompany(row) {
      // delivery_stage is deliberately omitted: new rows take the column default
      // (human_agent_queue) and an existing row keeps its current stage.
      const { data, error } = await supabase
        .from("companies")
        .upsert(
          {
            workspace_id: row.workspaceId,
            canonical_domain: row.domain,
            company_name: row.name,
            industry: row.industry,
            company_country: row.country,
            overview: row.overview,
            icp_score: row.icpScore,
            icp_fit_reason: row.fitReason,
            scoring_json: row.scoring,
            priority_band: row.priorityBand,
            recent_buying_signal_headline: row.signalHeadline,
            recent_buying_signal_body: row.signalBody,
            potential_pain_point: row.painPoint,
            recommended_opener: row.opener,
            contacts_json: row.contactsJson,
            evidence_links_json: row.evidenceJson,
            company_technologies: { source: "langgraph_run", run_id: row.runId },
            ...profileColumns(row.profile, row.signals),
            why_icp_fit: row.whyIcpFit || null,
            what_to_pitch: row.whatToPitch || null,
            research_status: "done",
            run_id: row.runId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,canonical_domain" }
        )
        .select("id")
        .single();
      check("upsertCompany", error);
      if (!data?.id) throw new AgentRepoError("upsertCompany", "No id returned");
      // A row created as a live-grid draft joins the review queue; published rows keep their stage.
      const { error: stageErr } = await supabase
        .from("companies")
        .update({ delivery_stage: "human_agent_queue" })
        .eq("id", data.id)
        .in("delivery_stage", ["researching", "discarded"]);
      check("upsertCompany.stage", stageErr);
      return data.id;
    },

    async markResearching(row) {
      const { error: insertErr } = await supabase.from("companies").upsert(
        {
          workspace_id: row.workspaceId,
          canonical_domain: row.domain,
          company_name: row.name,
          delivery_stage: "researching",
          research_status: "researching",
          run_id: row.runId,
        },
        { onConflict: "workspace_id,canonical_domain", ignoreDuplicates: true }
      );
      check("markResearching.insert", insertErr);
      const { error } = await supabase
        .from("companies")
        .update({ research_status: "researching", run_id: row.runId })
        .eq("workspace_id", row.workspaceId)
        .eq("canonical_domain", row.domain);
      check("markResearching.update", error);
    },

    async markDiscarded(workspaceId, domain, reason) {
      const { error } = await supabase
        .from("companies")
        .update({ research_status: "done", delivery_stage: "discarded", icp_score: null, icp_fit_reason: reason.slice(0, 500) })
        .eq("workspace_id", workspaceId)
        .eq("canonical_domain", domain)
        .in("delivery_stage", ["researching", "discarded"]);
      check("markDiscarded", error);
    },

    async upsertContact(row) {
      const fields = {
        workspace_id: row.workspaceId,
        company_id: row.companyId,
        company_name: row.companyName,
        company_domain: row.companyDomain,
        first_name: row.firstName,
        last_name: row.lastName,
        title: row.title,
        seniority: row.seniority,
        department: row.department,
        work_email: row.workEmail,
        personal_linkedin: row.linkedinUrl,
        mobile_number: row.phone,
        contact_country: row.country,
        role_start_date: row.roleStartDate,
        verification_status: row.verificationStatus,
        verified_at: row.verificationStatus === "verified_current" ? new Date().toISOString() : null,
        email_status: row.emailStatus,
        icp_score: row.icpScore,
        icp_reason: row.icpReason,
      };
      // contacts has no unique constraint on (workspace_id, work_email): select, then update or insert.
      const { data: existing, error: findErr } = await supabase
        .from("contacts")
        .select("id")
        .eq("workspace_id", row.workspaceId)
        .eq("work_email", row.workEmail)
        .order("created_at", { ascending: true })
        .limit(1);
      check("upsertContact.find", findErr);

      const existingId = existing?.[0]?.id as string | undefined;
      if (existingId) {
        const { error } = await supabase.from("contacts").update(fields).eq("id", existingId);
        check("upsertContact.update", error);
        return existingId;
      }
      const { data, error } = await supabase.from("contacts").insert(fields).select("id").single();
      check("upsertContact.insert", error);
      if (!data?.id) throw new AgentRepoError("upsertContact", "No id returned");
      return data.id;
    },

    async insertSignals(workspaceId, companyId, rows) {
      const unique = rows.filter((r, i) => rows.findIndex((o) => o.sourceUrl === r.sourceUrl) === i);
      if (unique.length === 0) return 0;
      const { data: existing, error: findErr } = await supabase
        .from("signals")
        .select("evidence_url")
        .eq("company_id", companyId)
        .in(
          "evidence_url",
          unique.map((r) => r.sourceUrl)
        );
      check("insertSignals.find", findErr);
      const known = new Set((existing || []).map((r) => String(r.evidence_url)));
      const fresh = unique.filter((r) => !known.has(r.sourceUrl));
      if (fresh.length === 0) return 0;

      const { error } = await supabase.from("signals").insert(
        fresh.map((r) => ({
          workspace_id: workspaceId,
          company_id: companyId,
          signal_type: r.signalType,
          title: r.title,
          supporting_excerpt: r.quote,
          evidence_url: r.sourceUrl,
          event_date: r.sourceDate,
          publication_date: r.sourceDate,
          confidence: r.confidence,
          explanation: r.explanation,
          is_confirmed_fact: true,
          source_layer: "Web & News",
        }))
      );
      check("insertSignals.insert", error);
      return fresh.length;
    },

    async upsertDossier(row) {
      const fields = {
        workspace_id: row.workspaceId,
        company_id: row.companyId,
        target_contact_id: row.targetContactId,
        summary: row.summary,
        icp_score: row.icpScore,
        icp_score_breakdown: row.breakdown,
        buying_window_days: row.windowDays,
        priority_tier: row.tier,
        key_triggers: row.triggers,
        recommended_opener: row.opener,
        talking_points: row.talkingPoints,
        status: "ready",
        updated_at: new Date().toISOString(),
      };
      const { data: existing, error: findErr } = await supabase
        .from("dossiers")
        .select("id")
        .eq("workspace_id", row.workspaceId)
        .eq("company_id", row.companyId)
        .order("created_at", { ascending: true })
        .limit(1);
      check("upsertDossier.find", findErr);

      const existingId = existing?.[0]?.id as string | undefined;
      if (existingId) {
        const { error } = await supabase.from("dossiers").update(fields).eq("id", existingId);
        check("upsertDossier.update", error);
        return existingId;
      }
      const { data, error } = await supabase.from("dossiers").insert(fields).select("id").single();
      check("upsertDossier.insert", error);
      if (!data?.id) throw new AgentRepoError("upsertDossier", "No id returned");
      return data.id;
    },

    async publishCompanies(workspaceId, companyIds) {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("companies")
        .update({ delivery_stage: "published_to_client", updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .in("id", companyIds)
        .select("id, company_name, canonical_domain");
      check("publishCompanies", error);
      return (data || []).map((r) => ({ id: r.id, name: r.company_name, domain: r.canonical_domain }));
    },

    async postSystemMessage(workspaceId, content, metadata) {
      const { error } = await supabase.from("workspace_messages").insert({
        workspace_id: workspaceId,
        sender_role: "system",
        sender_name: "RevGen AI System",
        sender_email: "system@revgenai.com",
        message_type: "system",
        content,
        metadata,
      });
      check("postSystemMessage", error);
    },

    async insertUsageEvents(rows) {
      if (rows.length === 0) return;
      const { error } = await supabase.from("usage_events").insert(
        rows.map((r) => ({
          workspace_id: r.workspaceId,
          run_id: r.runId,
          provider: r.provider,
          event_type: r.eventType,
          tokens_used: r.tokensUsed,
          api_calls: r.apiCalls,
          cost_usd: r.costUsd,
        }))
      );
      check("insertUsageEvents", error);
    },

    async insertAuditLog(row) {
      const { error } = await supabase.from("audit_logs").insert({
        workspace_id: row.workspaceId,
        actor_email: row.actorEmail,
        action: row.action,
        target_type: row.targetType,
        target_id: row.targetId,
        details: row.details,
      });
      check("insertAuditLog", error);
    },
  };
}
