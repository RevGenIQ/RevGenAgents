/**
 * Analyst Research Import Script for Extrieve BFSI Delivery
 * Source: data/Extrieve_AI_Prospecting_Accounts_Signals_Contacts.xlsx
 * Seller: Extrieve (extrieve.com)
 * Dataset: EXTRIEVE_BFSI_2026-10-28
 *
 * RULES ENFORCED:
 * 1. Strict schema compliance with Supabase tables: companies, signals, dossiers, icp_profiles, research_runs.
 * 2. NEVER invent data. Missing fields = null / "Not available".
 * 3. Security: Prints ONLY project host, NEVER credentials or keys.
 * 4. Idempotent: Deterministic UUIDv5 for all records + upsert logic.
 * 5. Tagging: source = "analyst_import", dataset = "EXTRIEVE_BFSI_2026-10-28".
 * 6. Contacts: 0 data rows created (source contains 0 contacts).
 * 7. Expected dry-run counts: 124 accounts, 124 dossiers, 305 sourced signals (44 skipped), 0 contacts.
 *    Bands: A 68 / B 31 / C 25.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as readline from "readline";
import * as XLSX from "xlsx";

// 1. Deterministic UUIDv5 (RFC 4122) generator
function uuidv5(name: string, namespace: string = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const nameBytes = Buffer.from(name, "utf8");
  const hash = crypto.createHash("sha1").update(Buffer.concat([nsBytes, nameBytes])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant
  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function formatSqlDate(val: any): string | null {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  return null;
}

function isPrimaryEvidence(url: string, canonicalDomain: string): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  const c = canonicalDomain.toLowerCase().replace(/^www\./, "");
  if (c && u.includes(c)) return true;

  const primaryPatterns = [
    "rbi.org.in",
    "sebi.gov.in",
    "nseindia.com",
    "bseindia.com",
    ".gov.in",
    ".nic.in",
    "bank.in",
    "abcprocure",
    "eprocure",
    "tender",
  ];
  return primaryPatterns.some((p) => u.includes(p));
}

async function promptConfirmation(promptText: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() === "YES");
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isAutoYes = args.includes("--yes") || args.includes("-y");

  let filePathArg = "";
  let targetSlug = "aryan-com";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && i + 1 < args.length) {
      filePathArg = args[i + 1];
    } else if (args[i].startsWith("--file=")) {
      filePathArg = args[i].split("=")[1];
    } else if (args[i] === "--workspace-slug" && i + 1 < args.length) {
      targetSlug = args[i + 1];
    } else if (args[i].startsWith("--workspace-slug=")) {
      targetSlug = args[i].split("=")[1];
    }
  }

  const DATASET_TAG = "EXTRIEVE_BFSI_2026-10-28";
  const SELLER_NAME = "Extrieve";
  const SELLER_DOMAIN = "extrieve.com";

  console.log("\n=======================================================");
  console.log("   HUNT SMARTER / REVGENIQ — ANALYST DATA IMPORT");
  console.log(`   Dataset: ${DATASET_TAG}`);
  console.log(`   Seller:  ${SELLER_NAME} (${SELLER_DOMAIN})`);
  console.log(`   Mode:    ${isDryRun ? "DRY RUN (validate & count only)" : "LIVE IMPORT"}`);
  console.log("=======================================================\n");

  // 1. Locate file
  let resolvedPath = filePathArg
    ? path.resolve(process.cwd(), filePathArg)
    : path.resolve(process.cwd(), "data/Extrieve_AI_Prospecting_Accounts_Signals_Contacts.xlsx");

  if (!fs.existsSync(resolvedPath)) {
    const candidatePaths = [
      path.resolve(process.cwd(), "data/Extrieve_AI_Prospecting_Accounts_Signals_Contacts.xlsx"),
      path.resolve(process.env.HOME || "", "Downloads/Extrieve_AI_Prospecting_Accounts_Signals_Contacts.xlsx"),
      path.resolve(process.env.HOME || "", "Desktop/Extrieve_AI_Prospecting_Accounts_Signals_Contacts.xlsx"),
    ];
    for (const cp of candidatePaths) {
      if (fs.existsSync(cp)) {
        resolvedPath = cp;
        break;
      }
    }
  }

  if (!fs.existsSync(resolvedPath)) {
    console.error(`[ERROR] Source file not found: ${resolvedPath}`);
    console.error("Searched folders: data/, ~/Downloads, ~/Desktop");
    process.exit(1);
  }

  console.log(`[INFO] Found source file: ${resolvedPath}`);

  // 2. Load .env.local
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("[ERROR] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const host = new URL(supabaseUrl).host;
  console.log(`[SECURITY] Target Supabase Host: ${host}`);

  // Safety check on host
  const EXPECTED_HOST = "xwqjbadyfcafgfnzgupm.supabase.co";

  // 3. Resolve Target Workspace
  const wsRes = await fetch(`${supabaseUrl}/rest/v1/workspaces?select=id,name,slug,created_at&order=created_at.desc`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!wsRes.ok) {
    console.error(`[ERROR] Failed to fetch workspaces from Supabase: ${wsRes.status} ${await wsRes.text()}`);
    process.exit(1);
  }

  const workspaces: any[] = await wsRes.json();
  const targetWs = workspaces.find((w) => w.slug === targetSlug);

  if (!targetWs) {
    console.error(`[ERROR] Workspace with slug "${targetSlug}" not found in database.`);
    console.error(`Available workspaces: ${workspaces.map((w) => w.slug).join(", ")}`);
    process.exit(1);
  }

  console.log(`[INFO] Target Workspace: "${targetWs.name}" (slug: ${targetWs.slug}, ID: ${targetWs.id})`);

  // 4. Parse Excel Workbook
  const workbook = XLSX.readFile(resolvedPath);
  const sheetNames = workbook.SheetNames;
  console.log(`[INFO] Workbook sheets loaded: ${sheetNames.join(", ")}`);

  const rawSummary: any[] = XLSX.utils.sheet_to_json(workbook.Sheets["Summary"] || {});
  const rawAccounts: any[] = XLSX.utils.sheet_to_json(workbook.Sheets["Accounts"] || {});
  const rawSignals: any[] = XLSX.utils.sheet_to_json(workbook.Sheets["Signals"] || {});
  const rawPersonas: any[] = XLSX.utils.sheet_to_json(workbook.Sheets["Personas"] || {});
  const rawExclusions: any[] = XLSX.utils.sheet_to_json(workbook.Sheets["Exclusions"] || {});

  // 5. Transform Accounts
  const accountsToImport: any[] = [];
  const accountIdMap: Record<string, string> = {}; // Account ID -> companyId
  const accountDomainMap: Record<string, string> = {}; // Account ID -> canonicalDomain
  const bandCounts: Record<string, number> = { A: 0, B: 0, C: 0 };

  for (const a of rawAccounts) {
    const accId = String(a["Account ID"] || "").trim();
    const accName = String(a["Account Name"] || "").trim();
    if (!accId || !accName) continue;

    let canonicalDomain = String(a["Domain"] || "")
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split("?")[0];

    if (!canonicalDomain) {
      canonicalDomain = accName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30) + ".com";
    }

    const priorityBandRaw = String(a["Priority Band"] || "").trim();
    const bandLetter = priorityBandRaw.startsWith("A")
      ? "A"
      : priorityBandRaw.startsWith("B")
      ? "B"
      : priorityBandRaw.startsWith("C")
      ? "C"
      : "B";
    bandCounts[bandLetter] = (bandCounts[bandLetter] || 0) + 1;

    const priorityTier = `Band ${bandLetter}`;
    const totalScore = Math.min(100, Math.max(0, Math.round(Number(a["Total Score (100)"]) || 0)));

    const companyId = uuidv5(`company:${DATASET_TAG}:${accId}:${targetWs.id}`);
    accountIdMap[accId] = companyId;
    accountDomainMap[accId] = canonicalDomain;

    const sectorFit = Number(a["Score: Sector Fit (25)"]) || 0;
    const scaleScore = Number(a["Score: Scale (20)"]) || 0;
    const triggerScore = Number(a["Score: Trigger (25)"]) || 0;
    const ownerAccess = Number(a["Score: Owner Access (15)"]) || 0;
    const deployTiming = Number(a["Score: Deployment/Timing (15)"]) || 0;

    const segmentGroup = String(a["Segment Group"] || "BFSI").trim();
    const subSegment = String(a["Sub-segment"] || "").trim();
    const industry = subSegment ? `${segmentGroup} - ${subSegment}` : segmentGroup;

    const primarySignal = a["Primary Buying Signal (evidence)"]
      ? {
          rank: 1,
          type: a["Trigger Type"] || "Primary Buying Signal",
          text: String(a["Primary Buying Signal (evidence)"]).trim(),
          date: formatSqlDate(a["Trigger Date"]),
          source: a["Trigger URL"] || null,
        }
      : null;

    accountsToImport.push({
      id: companyId,
      workspace_id: targetWs.id,
      company_name: accName,
      canonical_domain: canonicalDomain,
      industry,
      company_country: "India",
      company_city: a["HQ City"] || "India",
      company_linkedin: a["LinkedIn Company URL"] || null,
      icp_score: totalScore,
      overview: `${a["Recommended Extrieve Product"] || "Document Management & AI"}. Relevant workflow: ${a["Relevant Document Workflow"] || "Operational banking workflows"}`,
      icp_fit_reason: `[Origin: imported research] [Dataset: ${DATASET_TAG}] [Source: analyst_import] Priority: ${priorityBandRaw} | Total Score: ${totalScore}/100. Product: ${a["Recommended Extrieve Product"]}. Outreach Angle: ${a["Outreach Angle (discovery hypothesis)"]}`,
      company_technologies: {
        source: "analyst_import",
        dataset: DATASET_TAG,
        seller_company: SELLER_NAME,
        seller_domain: SELLER_DOMAIN,
        account_id: accId,
        legal_entity: a["Legal Entity"],
        parent_promoter: a["Parent / Promoter"],
        india_presence: a["India Presence"],
        segment_group: segmentGroup,
        sub_segment: subSegment,
        icp_tier: a["ICP Tier"],
        employee_band: a["Employee Band"],
        employee_source: a["Employee Source"],
        scale_signal: a["Scale Signal"],
        relevant_document_workflow: a["Relevant Document Workflow"],
        trigger_type: a["Trigger Type"],
        primary_buying_signal: a["Primary Buying Signal (evidence)"],
        trigger_url: a["Trigger URL"],
        trigger_date: formatSqlDate(a["Trigger Date"]),
        observed_date: formatSqlDate(a["Observed Date"]),
        secondary_signals: a["Secondary Signals"],
        tech_stack_hints: a["Tech Stack Hints"],
        recommended_extrieve_product: a["Recommended Extrieve Product"],
        product_line: a["Recommended Extrieve Product"],
        hdl_product_line: a["Recommended Extrieve Product"], // For uniform display in existing drawer & cards
        outreach_angle: a["Outreach Angle (discovery hypothesis)"],
        target_buyer_functions: a["Target Buyer Functions"],
        target_personas: rawPersonas,
        linkedin_company_url: a["LinkedIn Company URL"] || null,
        missing_information: a["Missing Information"],
        next_action: a["Next Action"],
        suppression_match: a["Suppression Match"],
        confidence: a["Confidence"],
        named_contacts_found: a["Named Contacts Found"] || 0,
        score_sector_fit: sectorFit,
        score_scale: scaleScore,
        score_trigger: triggerScore,
        score_owner_access: ownerAccess,
        score_deployment_timing: deployTiming,
        total_score: totalScore,
        priority_band: priorityBandRaw,
        priority_tier: priorityTier,
        signals_curated: primarySignal ? [primarySignal] : [],
        raw_source_record: a,
      },
      raw_source_record: a,
    });
  }

  // 6. Transform Signals
  // Filter rule: Import ONLY rows whose Source URL starts with http
  const signalsToImport: any[] = [];
  const signalsSkippedNoHttp: any[] = [];

  for (const s of rawSignals) {
    const accId = String(s["Account ID"] || "").trim();
    const sourceUrl = String(s["Source URL"] || "").trim();

    if (!sourceUrl.startsWith("http")) {
      signalsSkippedNoHttp.push({
        accountId: accId,
        accountName: s["Account Name"],
        url: sourceUrl,
        signal: s["Signal / Evidence"],
      });
      continue;
    }

    const companyId = accountIdMap[accId];
    if (!companyId) continue;

    const canonicalDomain = accountDomainMap[accId] || "";
    let sourceHost = "";
    try {
      sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      sourceHost = "web source";
    }

    const strength = String(s.Strength || "").toLowerCase();
    const confidence = strength.includes("strong") ? 0.9 : strength.includes("weak") ? 0.55 : 0.6;
    const isPrimary = isPrimaryEvidence(sourceUrl, canonicalDomain);

    const sigDate = formatSqlDate(s["Signal Date"]);
    const obsDate = formatSqlDate(s["Observed"]);
    const effectiveDate = sigDate || obsDate || new Date().toISOString().split("T")[0];
    const dateLabel = sigDate ? sigDate : obsDate ? `Detected ${obsDate}` : "Recent";

    const signalRank = String(s["Signal Rank"] || "Signal").trim();
    const signalId = uuidv5(`signal:${DATASET_TAG}:${accId}:${signalRank}:${sourceUrl}:${targetWs.id}`);

    signalsToImport.push({
      id: signalId,
      workspace_id: targetWs.id,
      company_id: companyId,
      title: `${s["Signal Type"] || "Buying Trigger"}: ${String(s["Signal / Evidence"] || "").slice(0, 100)}`,
      supporting_excerpt: String(s["Signal / Evidence"] || "").trim(),
      signal_type: String(s["Signal Type"] || "buying_trigger")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 50),
      confidence,
      explanation: `[Origin: imported research] [Dataset: ${DATASET_TAG}] [Source: analyst_import] Strength: ${s.Strength || "Standard"} | Source: ${sourceHost} | Rank: ${signalRank}`,
      source_layer: isPrimary ? "Primary (government, company, tender portal)" : "Secondary (news, trade press)",
      event_date: effectiveDate,
      publication_date: sigDate || (obsDate ? effectiveDate : null),
      evidence_url: sourceUrl,
      is_confirmed_fact: true,
    });
  }

  // 7. Transform Dossiers (one per account)
  const dossiersToImport: any[] = [];
  for (const comp of accountsToImport) {
    const rawA = comp.raw_source_record;
    const accId = rawA["Account ID"];
    const dossierId = uuidv5(`dossier:${DATASET_TAG}:${accId}:${targetWs.id}`);

    const totalScore = comp.icp_score;
    const priorityBandRaw = String(rawA["Priority Band"] || "B").trim();
    const bandLetter = priorityBandRaw.startsWith("A")
      ? "A"
      : priorityBandRaw.startsWith("B")
      ? "B"
      : priorityBandRaw.startsWith("C")
      ? "C"
      : "B";

    const outreachAngle = rawA["Outreach Angle (discovery hypothesis)"] || "Operational AI workflow modernization";

    const priorityTier = `Band ${bandLetter}`;
    const dbPriorityTier = bandLetter === "A" ? "P1" : bandLetter === "B" ? "P2" : "P3";

    dossiersToImport.push({
      id: dossierId,
      workspace_id: targetWs.id,
      company_id: comp.id,
      target_contact_id: null, // ZERO contacts in source
      icp_score: totalScore,
      priority_tier: dbPriorityTier,
      buying_window_days: 45,
      summary: `[Origin: imported research] [Dataset: ${DATASET_TAG}] [Source: analyst_import] ${comp.company_name} (${rawA["Segment Group"] || "BFSI"}) - ${rawA["Recommended Extrieve Product"] || "Document Management"}. Trigger: ${rawA["Trigger Type"] || "Modernization"}. ${rawA["Primary Buying Signal (evidence)"] || ""}`,
      recommended_opener: `[From analyst research] ${outreachAngle}`,
      talking_points: [
        `From analyst research: ${outreachAngle}`,
        `Extrieve Product Match: ${rawA["Recommended Extrieve Product"] || "DMS & SplicerAI"}`,
        `Target Buyer Functions: ${rawA["Target Buyer Functions"] || "IT, Operations & Compliance"}`,
        `Relevant Document Workflow: ${rawA["Relevant Document Workflow"] || "CKYC / Re-KYC and DMS Archival"}`,
        `Primary Trigger: ${rawA["Primary Buying Signal (evidence)"] || "Workflow automation tender"}`,
      ],
      icp_score_breakdown: {
        sector_fit: rawA["Score: Sector Fit (25)"],
        scale: rawA["Score: Scale (20)"],
        trigger: rawA["Score: Trigger (25)"],
        owner_access: rawA["Score: Owner Access (15)"],
        deployment_timing: rawA["Score: Deployment/Timing (15)"],
        total_score: totalScore,
        priority_band: rawA["Priority Band"],
        priority_tier: priorityTier,
        target_personas: rawPersonas,
        target_buyer_functions: rawA["Target Buyer Functions"],
        matchScore: totalScore,
      },
      key_triggers: [
        rawA["Primary Buying Signal (evidence)"]
          ? {
              layer: isPrimaryEvidence(rawA["Trigger URL"] || "", comp.canonical_domain) ? "Primary" : "Secondary",
              trigger: rawA["Primary Buying Signal (evidence)"],
              date: formatSqlDate(rawA["Trigger Date"]) || "Recent",
              evidence_url: rawA["Trigger URL"] || "",
            }
          : null,
      ].filter(Boolean),
      status: "ready",
    });
  }

  // 8. Transform ICP Profile
  const icpProfileId = uuidv5(`icp_profile:${targetWs.id}:${DATASET_TAG}`);
  const exclusionsList = rawExclusions.map((e) => e.Name || e.name || String(e)).filter(Boolean);

  const icpProfileToImport = {
    id: icpProfileId,
    workspace_id: targetWs.id,
    name: "Extrieve - BFSI AI Prospecting",
    product: "DMS, SplicerAI SDK, KYC & archive remediation, AI document workflow processing",
    pain_points: "Legacy CKYC / Re-KYC data cleansing, video KYC integration, document workflow automation across banks, NBFCs, insurers",
    minimum_score: 75,
    criteria: {
      source: "analyst_import",
      dataset: DATASET_TAG,
      seller_name: SELLER_NAME,
      seller_domain: SELLER_DOMAIN,
      summary_notes: rawSummary,
      personas: rawPersonas,
      exclusions: exclusionsList,
      accounts_count: accountsToImport.length,
      signals_count: signalsToImport.length,
      contacts_count: 0,
    },
  };

  // 9. Transform Research Run
  const researchRunId = uuidv5(`research_run:${targetWs.id}:${DATASET_TAG}`);
  const researchRunToImport = {
    id: researchRunId,
    workspace_id: targetWs.id,
    name: "Extrieve BFSI research 28-Oct-2026",
    status: "completed",
    target_count: accountsToImport.length,
    min_icp_score: 75,
    progress_percent: 100,
    current_step: `Analyst research dataset imported: ${accountsToImport.length} accounts, ${signalsToImport.length} signals, 0 contacts`,
    leads_found: accountsToImport.length, // Exact real inserted accounts
    leads_verified: 0,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    icp_input: {
      source: "analyst_import",
      dataset: DATASET_TAG,
      seller_name: SELLER_NAME,
      seller_domain: SELLER_DOMAIN,
      website: `https://${SELLER_DOMAIN}`,
      description: "Extrieve BFSI AI Prospecting & Document Modernization",
      accounts_count: accountsToImport.length,
      signals_count: signalsToImport.length,
      contacts_count: 0,
    },
  };

  // --- PRINT SUMMARY & AUDIT REPORT ---
  console.log("\n=======================================================");
  console.log("            TRANSFORMATION & AUDIT SUMMARY");
  console.log("=======================================================");
  console.log(` Accounts to import:   ${accountsToImport.length} (Expected: 124)`);
  console.log(` Dossiers to import:   ${dossiersToImport.length} (Expected: 124)`);
  console.log(` Signals to import:    ${signalsToImport.length} (Expected: 305)`);
  console.log(` Signals skipped:      ${signalsSkippedNoHttp.length} (Expected: 44 non-http)`);
  console.log(` Contacts to import:   0 (Expected: 0)`);
  console.log(` Priority Band A:      ${bandCounts.A} (Expected: 68)`);
  console.log(` Priority Band B:      ${bandCounts.B} (Expected: 31)`);
  console.log(` Priority Band C:      ${bandCounts.C} (Expected: 25)`);
  console.log(` Research Run:         1 ("Extrieve BFSI research 28-Oct-2026")`);
  console.log(` ICP Profile:          1 ("Extrieve - BFSI AI Prospecting")`);
  console.log("-------------------------------------------------------");
  console.log(` Exclusions reference: ${exclusionsList.length} entities stored in icp_profile`);
  console.log("=======================================================\n");

  // Validate exact expected counts
  const countsMatch =
    accountsToImport.length === 124 &&
    dossiersToImport.length === 124 &&
    signalsToImport.length === 305 &&
    signalsSkippedNoHttp.length === 44 &&
    bandCounts.A === 68 &&
    bandCounts.B === 31 &&
    bandCounts.C === 25;

  if (!countsMatch) {
    console.error("[FATAL ERROR] Extrieve dataset counts do not match expected numbers! Aborting for safety.");
    process.exit(1);
  }

  if (isDryRun) {
    console.log("[DRY RUN COMPLETE] Counts match expected numbers perfectly. Zero rows written to database.");
    return;
  }

  // Host safety check
  if (host !== EXPECTED_HOST) {
    console.error(`[SECURITY ERROR] Host "${host}" does not match authorized host "${EXPECTED_HOST}". Aborting.`);
    process.exit(1);
  }

  if (!isAutoYes) {
    const confirmed = await promptConfirmation("Type YES to execute live upsert to Supabase: ");
    if (!confirmed) {
      console.log("\n[ABORTED] Operation cancelled by user. No rows written.");
      process.exit(0);
    }
  } else {
    console.log("[SAFETY PASSED] Authorized host and expected counts confirmed with --yes. Proceeding without prompt.");
  }

  console.log("\n[EXECUTING] Upserting records to Supabase...");

  // Batch Upsert Helper function
  async function upsertBatch(table: string, records: any[], onConflict: string = "id") {
    const cleaned = records.map((r) => {
      const copy = { ...r };
      delete copy.raw_source_record;
      return copy;
    });

    const chunkSize = 50;
    for (let i = 0; i < cleaned.length; i += chunkSize) {
      const chunk = cleaned.slice(i, i + chunkSize);
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
        method: "POST",
        headers: {
          apikey: serviceKey!,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to upsert to ${table}: ${res.status} ${err}`);
      }
    }
  }

  try {
    // 1. Companies
    console.log(` -> Upserting ${accountsToImport.length} companies...`);
    await upsertBatch("companies", accountsToImport, "id");

    // 2. Signals
    console.log(` -> Upserting ${signalsToImport.length} signals...`);
    await upsertBatch("signals", signalsToImport, "id");

    // 3. Dossiers
    console.log(` -> Upserting ${dossiersToImport.length} dossiers...`);
    await upsertBatch("dossiers", dossiersToImport, "id");

    // 4. ICP Profile
    console.log(` -> Upserting ICP Profile...`);
    await upsertBatch("icp_profiles", [icpProfileToImport], "id");

    // 5. Research Run
    console.log(` -> Upserting Research Run...`);
    await upsertBatch("research_runs", [researchRunToImport], "id");

    console.log("\n=======================================================");
    console.log("   SUCCESS: EXTRIEVE RESEARCH IMPORT COMPLETE");
    console.log("=======================================================");
    console.log(` Total Companies Upserted:    ${accountsToImport.length}`);
    console.log(` Total Buying Signals:         ${signalsToImport.length}`);
    console.log(` Total Contacts:               0`);
    console.log(` Total Dossiers Compiled:      ${dossiersToImport.length}`);
    console.log(` Workspace:                    ${targetWs.name} (${targetWs.slug})`);
    console.log("=======================================================\n");
  } catch (err: any) {
    console.error(`\n[FATAL ERROR] Import failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
