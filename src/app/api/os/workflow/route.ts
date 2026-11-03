import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, UUID_PATTERN } from "@/lib/security/auth";
import { createServerClient } from "@/lib/supabase/server";
import { generateIdSuffix, resolvePassword } from "@/lib/security/credentials";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { rateLimit } from "@/lib/security/rateLimit";
import { canAccessWorkspace, isSuspendedClient } from "@/lib/security/workspaceAccess";

function mapDbCompanyToRecord(row: any) {
  const scoring = row.scoring_json || {
    icpFitScore: row.icp_score || 88,
    intentScore: 86,
    verifyScore: 40,
    verificationPct: 40,
    intentBasis: row.icp_fit_reason || "Matched ICP + Signal Verification",
    windowLabel: "Active Window",
  };

  return {
    id: row.id,
    leadNumber: row.lead_number || "01/05",
    workspaceId: row.workspace_id,
    clientCompanyName: row.company_aliases?.[0] || "Client Workspace",
    deliveryType: (row.delivery_batch_type || "sample") as "sample" | "daily",
    deliveryDayLabel: row.delivery_day_label || "Sample Card",
    stage: (row.delivery_stage || "human_agent_queue") as
      | "admin_prospecting"
      | "human_agent_queue"
      | "published_to_client",
    inputCompanyName: row.company_name || "",
    companyWebsite: row.canonical_domain || "",
    companyNumber: row.company_number || "",
    employeeCount: row.employee_count_band || String(row.employee_count || ""),
    companyIndustry: row.industry || "",
    subSector: row.sub_sector || row.industry || "",
    segment: row.segment_status || "Enterprise · STATUS: QUALIFIED",
    location: [row.company_city, row.company_state, row.company_country]
      .filter(Boolean)
      .join(", "),
    campusAddress: row.campus_address || row.company_city || "",
    techStack: Array.isArray(row.tech_stack)
      ? row.tech_stack
      : Array.isArray(row.company_technologies)
      ? row.company_technologies
      : [],
    companyLinkedinUrl: row.linkedin_url || row.company_linkedin || "",
    companyTwitterUrl: row.twitter_url || "",
    companyType: row.company_type || "Private / Public Enterprise",
    companyRevenue: row.company_revenue || "",
    companyDescription: row.overview || "",
    companyLogo:
      row.company_logo ||
      (row.company_name ? row.company_name.slice(0, 3).toUpperCase() : "CO"),
    foundedYear: row.founded_year ? String(row.founded_year) : "",
    companyEmailPhone: row.company_email_phone || "",
    scoring,
    priority: (row.priority_band || "High Priority") as
      | "High Priority"
      | "Medium Priority"
      | "Watchlist",
    signalsMatching: {
      targetedSignalBrave: row.signal_targeted_brave || {
        summary: "",
        sourceUrl: "",
        date: "",
      },
      hiringSignalGoogleCareers: row.signal_hiring_google_careers || {
        summary: "",
        sourceUrl: "",
        date: "",
      },
      investmentsFundingTavily: row.signal_funding_tavily || {
        summary: "",
        sourceUrl: "",
        date: "",
      },
      newsArticleCrawler: row.signal_news_crawler || {
        summary: "",
        sourceUrl: "",
        date: "",
      },
      socialMediaVerified: row.signal_social_verified || {
        slug: "",
        profileUrl: "",
        verifyChecked: false,
        recentPostSummary: "",
        recentPostUrl: "",
        date: "",
      },
    },
    recentBuyingSignalHeadline: row.recent_buying_signal_headline || "",
    recentBuyingSignalBody: row.recent_buying_signal_body || "",
    potentialPainPoint: row.potential_pain_point || "",
    recommendedOpener: row.recommended_opener || "",
    checkpointsCleared:
      row.checkpoints_cleared || "✓ Checkpoints Verified",
    contacts: Array.isArray(row.contacts_json) ? row.contacts_json : [],
    evidenceLinks: Array.isArray(row.evidence_links_json)
      ? row.evidence_links_json
      : [],
    reviewedByClient: !!row.reviewed_by_client,
    exportedByClient: !!row.exported_by_client,
    clientFeedback: row.client_feedback || undefined,
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

const CLIENT_TIERS = ["trial", "premium", "suspended"] as const;
type ClientTier = (typeof CLIENT_TIERS)[number];

function mapDbWorkspaceToRecord(ws: any) {
  const defaultChannel = `RevGenAIx${String(ws.name || "Client").replace(
    /[^a-zA-Z0-9]/g,
    ""
  )}`;
  return {
    id: ws.id,
    companyName: ws.name,
    companyDomain: ws.domain,
    primaryEmail: ws.primary_email || "",
    generatedLoginId: ws.generated_login_id || "",
    generatedPassword: ws.generated_password || "",
    plan: "Pilot · ~5 Samples (<24h) + ~35 Cards/Mo" as const,
    status: (ws.approval_status === "approved" ? "Active" : "Paused") as
      | "Active"
      | "Onboarding"
      | "Paused",
    createdAt: ws.created_at || new Date().toISOString(),
    spokespersons: Array.isArray(ws.spokespersons) ? ws.spokespersons : [],
    assignedHumagentId: ws.assigned_humagent_id || "",
    assignedHumagentName: ws.assigned_humagent_name || "",
    assignedHumagentEmail: ws.assigned_humagent_email || "",
    channelName: ws.channel_name || defaultChannel,
    activeTalkyRoomId: ws.channel_name || defaultChannel,
    activeTalkyRoomUrl: "",
    icpBrief: ws.icp_brief || null,
    dncEntries: Array.isArray(ws.dnc_entries) ? ws.dnc_entries : [],
    tier: (CLIENT_TIERS as readonly string[]).includes(ws.plan) ? (ws.plan as ClientTier) : "trial",
    sampleStatus: ws.sample_status || "not_claimed",
    sampleRunId: ws.sample_run_id || null,
    registeredVia: ws.registered_via === "self" ? "self" : "admin",
  };
}

function mapDbMessageToRecord(row: any) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    senderRole: row.sender_role as "admin" | "humagent" | "client" | "system",
    senderName: row.sender_name || "Participant",
    senderEmail: row.sender_email || "",
    messageType: (row.message_type || "text") as
      | "text"
      | "google_meet"
      | "appointment"
      | "document"
      | "payment"
      | "icp_upgrade"
      | "system",
    content: row.content || "",
    metadata: row.metadata || {},
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function forbidden(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 403 });
}

const MESSAGE_TYPES = new Set(["text", "google_meet", "appointment", "document", "payment"]);
const METADATA_KEYS = [
  "meetUrl",
  "appointmentDate",
  "appointmentTime",
  "agenda",
  "docTitle",
  "docUrl",
  "paymentAmount",
  "paymentStatus",
] as const;
const URL_METADATA_KEYS = new Set(["meetUrl", "docUrl"]);

/** Keeps only known metadata fields as short strings; URLs must be http(s). */
function sanitizeMessageMetadata(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  return METADATA_KEYS.reduce<Record<string, string>>((acc, key) => {
    const value = source[key];
    if (typeof value !== "string" || !value.trim()) return acc;
    const trimmed = value.trim().slice(0, 500);
    if (URL_METADATA_KEYS.has(key) && !/^https?:\/\//i.test(trimmed) && /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      return acc;
    }
    return { ...acc, [key]: trimmed };
  }, {});
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 }
      );
    }
    const isAdmin = session.role === "admin";
    const supabase = createServerClient();
    if (await isSuspendedClient(supabase, session)) {
      return NextResponse.json({ ok: false, error: "This workspace is suspended." }, { status: 403 });
    }

    const [
      { data: wsRows },
      { data: reqRows },
      { data: humRows },
      { data: compRows },
      { data: msgRows },
    ] = await Promise.all([
      supabase
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("client_access_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("humagent_users")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("workspace_messages")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

    let workspaces = (wsRows || []).map(mapDbWorkspaceToRecord);
    let accounts = (compRows || []).map(mapDbCompanyToRecord);
    let messages = (msgRows || []).map(mapDbMessageToRecord);
    const accessRequests = reqRows || [];
    const humagents = humRows || [];

    // Role-based filtering. Only admins see every tenant; any other role is
    // scoped down, and unknown roles get the most restrictive (client) view.
    if (session.role === "humagent") {
      const myHum = humagents.find((h: any) => h.id === session.userId);
      const allocatedIds: string[] = Array.isArray(
        myHum?.allocated_workspace_ids
      )
        ? myHum.allocated_workspace_ids
        : [];
      workspaces = workspaces.filter(
        (w) =>
          w.assignedHumagentId === session.userId ||
          allocatedIds.includes(w.id)
      );
      const allowedWsIds = new Set(workspaces.map((w) => w.id));
      accounts = accounts.filter((a) => allowedWsIds.has(a.workspaceId));
      messages = messages.filter((m) => allowedWsIds.has(m.workspaceId));
    } else if (!isAdmin) {
      workspaces = workspaces.filter((w) => w.id === session.workspaceId);
      accounts = accounts.filter(
        (a) =>
          a.workspaceId === session.workspaceId &&
          a.stage === "published_to_client"
      );
      messages = messages.filter((m) => m.workspaceId === session.workspaceId);
    }

    // Stored credentials are visible to the admin only.
    if (!isAdmin) {
      workspaces = workspaces.map((w) => ({ ...w, generatedPassword: "" }));
    }
    const visibleHumagents = isAdmin
      ? humagents
      : session.role === "humagent"
      ? humagents
          .filter((h: any) => h.id === session.userId)
          .map((h: any) => ({ ...h, password_plain: "" }))
      : [];

    // Extract ICP submissions from workspaces that have submitted an icpBrief
    const icpSubmissions = workspaces
      .filter((w) => w.icpBrief && Object.keys(w.icpBrief).length > 0)
      .map((w) => ({
        ...w.icpBrief,
        id: w.icpBrief.id || `icp-${w.id}`,
        workspaceId: w.id,
        companyName: w.companyName,
        companyDomain: w.companyDomain,
        dncEntries: w.dncEntries || [],
      }));

    return NextResponse.json({
      ok: true,
      workspaces,
      accessRequests: isAdmin ? accessRequests : [],
      humagents: visibleHumagents,
      icpSubmissions,
      accounts,
      messages,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to load workflow state" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    const rl = rateLimit(request, { max: 120, windowMs: 60 * 1000, prefix: "os_workflow_post" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;
    const supabase = createServerClient();
    if (await isSuspendedClient(supabase, session)) {
      return NextResponse.json({ ok: false, error: "This workspace is suspended." }, { status: 403 });
    }

    // 1. Admin approves a Client Access Request OR creates a Client directly
    if (
      action === "approve_client_request" ||
      action === "approve_access_request" ||
      action === "create_client_direct"
    ) {
      if (session.role !== "admin") {
        return NextResponse.json(
          {
            ok: false,
            error: "Only Admin can create or approve Client credentials.",
          },
          { status: 403 }
        );
      }

      let companyName = String(body.companyName || "").trim();
      let companyDomain = String(body.companyDomain || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "");
      let spokespersonName = String(
        body.spokespersonName || body.fullName || ""
      ).trim();
      let workEmail = String(body.workEmail || body.email || "")
        .trim()
        .toLowerCase();
      let jobTitle = String(body.jobTitle || "Company Spokesperson").trim();
      const assignedHumagentId =
        body.assignedHumagentId || body.allocatedHumagentId || null;
      const requestId = body.requestId || null;

      if (requestId) {
        const { data: reqRow } = await supabase
          .from("client_access_requests")
          .select("*")
          .eq("id", requestId)
          .single();
        if (!reqRow) {
          return NextResponse.json(
            { ok: false, error: "Access request not found." },
            { status: 404 }
          );
        }
        companyName = reqRow.company_name;
        companyDomain = reqRow.company_domain;
        spokespersonName = reqRow.spokesperson_name;
        workEmail = reqRow.work_email;
        jobTitle = reqRow.job_title || "Company Spokesperson";
      }

      if (!companyName || !companyDomain) {
        return NextResponse.json(
          { ok: false, error: "Company Name and Domain are required." },
          { status: 400 }
        );
      }

      const prefix = companyName
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 3)
        .toUpperCase()
        .padEnd(3, "X");
      const randSuffix = generateIdSuffix();
      const generatedLoginId =
        body.customLoginId?.trim() || `${prefix}-CLIENT-${randSuffix}`;
      const generatedPassword = resolvePassword(body.customPassword);

      let humName = "";
      let humEmail = "";
      if (assignedHumagentId) {
        const { data: humRow } = await supabase
          .from("humagent_users")
          .select("*")
          .eq("id", assignedHumagentId)
          .maybeSingle();
        if (humRow) {
          humName = humRow.full_name;
          humEmail = humRow.email;
        }
      }

      const slug = `${companyDomain.replace(/[^a-z0-9]/g, "-")}-${randSuffix}`;
      const cleanChannelName =
        String(body.channelName || "").trim() ||
        `RevGenAIx${companyName.replace(/[^a-zA-Z0-9]/g, "")}`;

      const spokespersons = workEmail
        ? [
            {
              id: `sp-${Date.now()}`,
              fullName: spokespersonName || workEmail.split("@")[0],
              email: workEmail,
              title: jobTitle,
              joinedAt: new Date().toISOString(),
            },
          ]
        : [];

      const { data: createdWs, error: wsErr } = await supabase
        .from("workspaces")
        .insert({
          name: companyName,
          slug,
          domain: companyDomain,
          primary_email: workEmail,
          generated_login_id: generatedLoginId,
          generated_password: generatedPassword,
          approval_status: "approved",
          assigned_humagent_id: assignedHumagentId || null,
          assigned_humagent_name: humName,
          assigned_humagent_email: humEmail,
          channel_name: cleanChannelName,
          talky_room_id: cleanChannelName,
          talky_room_url: "",
          spokespersons,
        })
        .select("*")
        .single();

      if (wsErr) {
        return NextResponse.json(
          { ok: false, error: wsErr.message },
          { status: 500 }
        );
      }

      // Seed initial Welcome Message into the dedicated Workspace Collaboration Channel
      if (createdWs) {
        await supabase.from("workspace_messages").insert({
          workspace_id: createdWs.id,
          sender_role: "system",
          sender_name: "RevGen AI System",
          sender_email: "system@revgenai.com",
          message_type: "system",
          content: `Welcome to #${cleanChannelName}! This dedicated workspace channel connects ${companyName} (Client), ${
            humName || "your allocated Humagent"
          } (Human Verification Specialist), and the RevGen AI Admin Supervisor. Use this channel to share Google Meet links, schedule appointments, review the ~5 Sample Cards (<24h SLA), coordinate the ~35-Card 1-Month delivery schedule, upgrade ICP criteria, and manage billing/payout milestones.`,
          metadata: {},
        });
      }

      if (assignedHumagentId && createdWs) {
        const { data: humRow } = await supabase
          .from("humagent_users")
          .select("allocated_workspace_ids")
          .eq("id", assignedHumagentId)
          .maybeSingle();
        const prevIds = Array.isArray(humRow?.allocated_workspace_ids)
          ? humRow.allocated_workspace_ids
          : [];
        if (!prevIds.includes(createdWs.id)) {
          await supabase
            .from("humagent_users")
            .update({ allocated_workspace_ids: [...prevIds, createdWs.id] })
            .eq("id", assignedHumagentId);
        }
      }

      if (requestId && createdWs) {
        await supabase
          .from("client_access_requests")
          .update({
            status: "approved",
            workspace_id: createdWs.id,
            generated_login_id: generatedLoginId,
            generated_password: generatedPassword,
            assigned_humagent_id: assignedHumagentId || null,
            assigned_humagent_name: humName,
            assigned_humagent_email: humEmail,
            approved_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return NextResponse.json({
        ok: true,
        workspaceId: createdWs.id,
        generatedLoginId,
        generatedPassword,
        workspace: mapDbWorkspaceToRecord(createdWs),
        credentials: {
          companyName,
          workEmail,
          generatedLoginId,
          generatedPassword,
          channelName: cleanChannelName,
        },
      });
    }

    // 2. Admin rejects a Client Access Request
    if (
      action === "reject_client_request" ||
      action === "reject_access_request"
    ) {
      if (session.role !== "admin") {
        return NextResponse.json(
          { ok: false, error: "Forbidden" },
          { status: 403 }
        );
      }
      await supabase
        .from("client_access_requests")
        .update({ status: "rejected" })
        .eq("id", body.requestId);
      return NextResponse.json({ ok: true });
    }

    // 3. Admin creates a Human Agent (Humagent) credential
    if (action === "create_humagent") {
      if (session.role !== "admin") {
        return NextResponse.json(
          { ok: false, error: "Only Admin can create Humagent credentials." },
          { status: 403 }
        );
      }

      const fullName = String(body.fullName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const loginId =
        String(body.loginId || "").trim() || `HUM-AGENT-${generateIdSuffix()}`;
      const passwordPlain = resolvePassword(body.password);
      const allocatedWorkspaceIds = Array.isArray(body.allocatedWorkspaceIds)
        ? body.allocatedWorkspaceIds
        : [];

      if (!fullName || !email) {
        return NextResponse.json(
          { ok: false, error: "Humagent full name and email are required." },
          { status: 400 }
        );
      }

      const { data: hum, error: humErr } = await supabase
        .from("humagent_users")
        .insert({
          full_name: fullName,
          email,
          login_id: loginId,
          password_plain: passwordPlain,
          status: "active",
          allocated_workspace_ids: allocatedWorkspaceIds,
        })
        .select("*")
        .single();

      if (humErr) {
        return NextResponse.json(
          { ok: false, error: humErr.message },
          { status: 500 }
        );
      }

      if (allocatedWorkspaceIds.length > 0 && hum) {
        await supabase
          .from("workspaces")
          .update({
            assigned_humagent_id: hum.id,
            assigned_humagent_name: hum.full_name,
            assigned_humagent_email: hum.email,
          })
          .in("id", allocatedWorkspaceIds);
      }

      return NextResponse.json({ ok: true, humagent: hum });
    }

    // 4. Admin allocates a Humagent to a Client Workspace
    if (action === "set_client_plan") {
      if (session.role !== "admin") {
        return NextResponse.json({ ok: false, error: "Only the Admin can change a client's plan." }, { status: 403 });
      }
      const workspaceId = String(body.workspaceId || "");
      const tier = String(body.tier || "");
      if (!UUID_PATTERN.test(workspaceId) || !(CLIENT_TIERS as readonly string[]).includes(tier)) {
        return NextResponse.json({ ok: false, error: "A workspace and a plan (trial, premium or suspended) are required." }, { status: 400 });
      }
      const { data: updated, error: planErr } = await supabase
        .from("workspaces")
        .update({ plan: tier, updated_at: new Date().toISOString() })
        .eq("id", workspaceId)
        .select("id, name")
        .maybeSingle();
      if (planErr) return NextResponse.json({ ok: false, error: planErr.message }, { status: 500 });
      if (!updated) return NextResponse.json({ ok: false, error: "Workspace not found." }, { status: 404 });

      const notice: Record<string, string> = {
        premium: "Your workspace is now on the Premium plan. Request more leads any time from the dashboard or here in the channel.",
        trial: "Your workspace is on the free trial plan.",
        suspended: "This workspace has been suspended. Please contact RevGen IQ support.",
      };
      const { error: noteErr } = await supabase.from("workspace_messages").insert({
        workspace_id: workspaceId,
        sender_role: "system",
        sender_name: "RevGen IQ",
        message_type: "system",
        content: notice[tier],
        metadata: { event: "plan_changed", tier },
      });
      if (noteErr) console.error("Plan change message failed", noteErr.message);
      return NextResponse.json({ ok: true, workspaceId, tier });
    }

    if (action === "allocate_humagent") {
      if (session.role !== "admin") {
        return NextResponse.json(
          {
            ok: false,
            error: "Only Admin can allocate a Humagent to a Client.",
          },
          { status: 403 }
        );
      }

      const { workspaceId, humagentId } = body;
      if (!humagentId) {
        await supabase
          .from("workspaces")
          .update({
            assigned_humagent_id: null,
            assigned_humagent_name: "",
            assigned_humagent_email: "",
          })
          .eq("id", workspaceId);
        return NextResponse.json({ ok: true });
      }

      const { data: hum } = await supabase
        .from("humagent_users")
        .select("*")
        .eq("id", humagentId)
        .single();

      if (!hum) {
        return NextResponse.json(
          { ok: false, error: "Humagent not found." },
          { status: 404 }
        );
      }

      await supabase
        .from("workspaces")
        .update({
          assigned_humagent_id: hum.id,
          assigned_humagent_name: hum.full_name,
          assigned_humagent_email: hum.email,
        })
        .eq("id", workspaceId);

      const prevIds = Array.isArray(hum.allocated_workspace_ids)
        ? hum.allocated_workspace_ids
        : [];
      if (!prevIds.includes(workspaceId)) {
        await supabase
          .from("humagent_users")
          .update({ allocated_workspace_ids: [...prevIds, workspaceId] })
          .eq("id", hum.id);
      }

      await supabase.from("workspace_messages").insert({
        workspace_id: workspaceId,
        sender_role: "system",
        sender_name: "RevGen AI System",
        sender_email: "system@revgenai.com",
        message_type: "system",
        content: `Admin allocated Humagent "${hum.full_name}" (${hum.email}) to this workspace channel.`,
        metadata: {},
      });

      return NextResponse.json({ ok: true });
    }

    // 5. Admin renames a Workspace Channel (ONLY Admin is permitted)
    if (action === "rename_workspace_channel") {
      if (session.role !== "admin") {
        return NextResponse.json(
          {
            ok: false,
            error: "Only the Admin has authority to name or rename workspace channels.",
          },
          { status: 403 }
        );
      }

      const workspaceId = String(body.workspaceId || "").trim();
      const rawName = String(body.channelName || "")
        .trim()
        .replace(/^#+/, "");
      if (!workspaceId || !rawName) {
        return NextResponse.json(
          { ok: false, error: "Workspace ID and Channel Name are required." },
          { status: 400 }
        );
      }

      const { error: upErr } = await supabase
        .from("workspaces")
        .update({
          channel_name: rawName,
          talky_room_id: rawName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);

      if (upErr) {
        return NextResponse.json(
          { ok: false, error: upErr.message },
          { status: 500 }
        );
      }

      await supabase.from("workspace_messages").insert({
        workspace_id: workspaceId,
        sender_role: "system",
        sender_name: "RevGen AI System",
        sender_email: session.email,
        message_type: "system",
        content: `Admin updated the channel name to #${rawName}.`,
        metadata: {},
      });

      return NextResponse.json({ ok: true, channelName: rawName });
    }

    // 6. Send a real-time message in a Workspace Collaboration Channel
    if (action === "send_workspace_message") {
      const targetWsId =
        session.role === "client" ? session.workspaceId : body.workspaceId;
      const content = String(body.content || "").trim();
      const messageType = String(body.messageType || "text");
      const metadata = sanitizeMessageMetadata(body.metadata);

      if (!targetWsId || !content) {
        return NextResponse.json(
          { ok: false, error: "Workspace and message content are required." },
          { status: 400 }
        );
      }

      if (!MESSAGE_TYPES.has(messageType) || content.length > 5000) {
        return NextResponse.json(
          { ok: false, error: "Unsupported message type or message too long." },
          { status: 400 }
        );
      }

      if (!(await canAccessWorkspace(supabase, session, targetWsId))) {
        return forbidden("You are not allocated to this client workspace channel.");
      }

      const { data: insertedMsg, error: msgErr } = await supabase
        .from("workspace_messages")
        .insert({
          workspace_id: targetWsId,
          sender_role: session.role,
          sender_name: session.fullName || session.email,
          sender_email: session.email,
          message_type: messageType,
          content,
          metadata,
        })
        .select("*")
        .single();

      if (msgErr) {
        return NextResponse.json(
          { ok: false, error: msgErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: mapDbMessageToRecord(insertedMsg),
      });
    }

    // 7. Client submits or upgrades ICP & DNC Brief
    if (action === "submit_icp") {
      const targetWsId =
        session.role === "client" ? session.workspaceId : body.workspaceId;
      const { icpBrief, dncEntries } = body;

      if (!(await canAccessWorkspace(supabase, session, String(targetWsId || "")))) {
        return forbidden("You cannot update the ICP for this workspace.");
      }

      const { error: upErr } = await supabase
        .from("workspaces")
        .update({
          icp_brief: icpBrief || {},
          dnc_entries: dncEntries || [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetWsId);

      if (upErr) {
        return NextResponse.json(
          { ok: false, error: upErr.message },
          { status: 500 }
        );
      }

      // Post automatic ICP Upgrade notification to the Workspace Chat Channel
      const industries = Array.isArray(icpBrief?.targetIndustries)
        ? icpBrief.targetIndustries.join(", ")
        : "Target Industries";
      const geos = Array.isArray(icpBrief?.geographies)
        ? icpBrief.geographies.join(", ")
        : "Target Geographies";
      const signals = Array.isArray(icpBrief?.requiredSignals)
        ? icpBrief.requiredSignals.join(", ")
        : "Buying Signals";

      await supabase.from("workspace_messages").insert({
        workspace_id: targetWsId,
        sender_role: "client",
        sender_name: session.fullName || session.email,
        sender_email: session.email,
        message_type: "icp_upgrade",
        content: `ICP & Growth Brief submitted/upgraded: Offering "${
          icpBrief?.offering || "B2B Solution"
        }" targeting ${industries} in ${geos}. Active signals: ${signals}. Exclusions: ${
          Array.isArray(dncEntries) ? dncEntries.length : 0
        } DNC domains. ATLAS 10-Layer Search initiated (~5 Sample Cards in <24h max, followed by ~35 Cards over 1 Month).`,
        metadata: {
          icpSummary: `${industries} · ${geos} · ${signals}`,
        },
      });

      return NextResponse.json({ ok: true });
    }

    // 8. Admin creates an Enriched Prospect Account & dispatches to Humagent Queue
    if (action === "create_prospect_account") {
      if (session.role !== "admin") {
        return NextResponse.json(
          { ok: false, error: "Only Admin can run Agentic Prospecting." },
          { status: 403 }
        );
      }

      const acc = body.account;
      const { data: inserted, error: insErr } = await supabase
        .from("companies")
        .insert({
          workspace_id: acc.workspaceId,
          canonical_domain: acc.companyWebsite,
          company_name: acc.inputCompanyName,
          company_aliases: [acc.clientCompanyName || "Client"],
          industry: acc.companyIndustry,
          sub_sector: acc.subSector,
          segment_status: acc.segment,
          employee_count_band: acc.employeeCount,
          company_city: acc.location,
          campus_address: acc.campusAddress,
          tech_stack: acc.techStack || [],
          linkedin_url: acc.companyLinkedinUrl,
          twitter_url: acc.companyTwitterUrl,
          company_type: acc.companyType,
          company_revenue: acc.companyRevenue,
          overview: acc.companyDescription,
          company_logo: acc.companyLogo,
          founded_year: Number(acc.foundedYear) || 2010,
          company_number: acc.companyNumber,
          company_email_phone: acc.companyEmailPhone,
          icp_score: acc.scoring?.icpFitScore || 88,
          icp_fit_reason: acc.scoring?.intentBasis || "",
          scoring_json: acc.scoring || {},
          priority_band: acc.priority || "High Priority",
          lead_number: acc.leadNumber || "01/05",
          signal_targeted_brave: acc.signalsMatching?.targetedSignalBrave || {},
          signal_hiring_google_careers:
            acc.signalsMatching?.hiringSignalGoogleCareers || {},
          signal_funding_tavily:
            acc.signalsMatching?.investmentsFundingTavily || {},
          signal_news_crawler: acc.signalsMatching?.newsArticleCrawler || {},
          signal_social_verified:
            acc.signalsMatching?.socialMediaVerified || {},
          recent_buying_signal_headline: acc.recentBuyingSignalHeadline,
          recent_buying_signal_body: acc.recentBuyingSignalBody,
          potential_pain_point: acc.potentialPainPoint,
          recommended_opener: acc.recommendedOpener,
          checkpoints_cleared: acc.checkpointsCleared,
          contacts_json: acc.contacts || [],
          evidence_links_json: acc.evidenceLinks || [],
          delivery_stage: acc.stage || "human_agent_queue",
          delivery_batch_type: acc.deliveryType || "sample",
          delivery_day_label: acc.deliveryDayLabel || "Sample Card",
          reviewed_by_client: false,
          exported_by_client: false,
        })
        .select("*")
        .single();

      if (insErr) {
        return NextResponse.json(
          { ok: false, error: insErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        account: mapDbCompanyToRecord(inserted),
      });
    }

    // 9. Humagent / Client / Admin updates an Account (Contacts enrichment, Publish to Client, Review/Export checkmarks)
    if (action === "update_account") {
      const accountObj = body.account || null;
      const accountId = String(body.accountId || accountObj?.id || "");
      const updates = body.updates || accountObj || {};

      const { data: existingAccount } = await supabase
        .from("companies")
        .select("workspace_id, delivery_stage")
        .eq("id", accountId)
        .maybeSingle();
      if (!existingAccount) {
        return NextResponse.json(
          { ok: false, error: "Account not found." },
          { status: 404 }
        );
      }
      if (!(await canAccessWorkspace(supabase, session, existingAccount.workspace_id))) {
        return forbidden("You cannot update accounts in this workspace.");
      }

      // Clients may only record their own review state; contacts and delivery
      // stage are edited by the Admin and allocated Humagent. The client UI sends
      // the whole record, so staff-only fields are ignored rather than rejected.
      const isStaff = session.role === "admin" || session.role === "humagent";
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (isStaff && updates.contacts !== undefined)
        dbUpdates.contacts_json = updates.contacts;
      if (isStaff && updates.stage !== undefined)
        dbUpdates.delivery_stage = updates.stage;
      if (isStaff && updates.segment !== undefined)
        dbUpdates.segment_status = updates.segment;
      if (isStaff && updates.deliveryDayLabel !== undefined)
        dbUpdates.delivery_day_label = updates.deliveryDayLabel;
      if (isStaff && updates.checkpointsCleared !== undefined)
        dbUpdates.checkpoints_cleared = updates.checkpointsCleared;
      if (updates.reviewedByClient !== undefined)
        dbUpdates.reviewed_by_client = updates.reviewedByClient;
      if (updates.exportedByClient !== undefined)
        dbUpdates.exported_by_client = updates.exportedByClient;
      if (updates.clientFeedback !== undefined)
        dbUpdates.client_feedback = updates.clientFeedback;

      const { data: updatedRow, error: upErr } = await supabase
        .from("companies")
        .update(dbUpdates)
        .eq("id", accountId)
        .select("*")
        .single();

      if (upErr) {
        return NextResponse.json(
          { ok: false, error: upErr.message },
          { status: 500 }
        );
      }

      // If Humagent just published this account to the client, post an update in the workspace chat channel
      const justPublished =
        isStaff &&
        updates.stage === "published_to_client" &&
        existingAccount.delivery_stage !== "published_to_client";
      if (justPublished && updatedRow) {
        const contactCount = Array.isArray(updatedRow.contacts_json)
          ? updatedRow.contacts_json.length
          : 0;
        await supabase.from("workspace_messages").insert({
          workspace_id: updatedRow.workspace_id,
          sender_role: session.role === "humagent" ? "humagent" : "system",
          sender_name: session.fullName || "Humagent QA",
          sender_email: session.email,
          message_type: "system",
          content: `Published verified Account Brief: ${updatedRow.company_name} (${updatedRow.canonical_domain}) with ${contactCount} verified decision-maker contacts (${updatedRow.delivery_day_label}). Ready for review in Account Intelligence!`,
          metadata: {},
        });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported workflow action" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Workflow action error" },
      { status: 500 }
    );
  }
}
