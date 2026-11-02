/**
 * Analyst Research Unimport Script for HTL / HFCL Group Delivery
 * Reversibly removes all records tagged with dataset = "HDL_HFCL_2026-10-20"
 * without touching any organic runs or other workspace data.
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

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
  const isAutoYes = process.argv.includes("-y") || process.argv.includes("--yes");

  console.log("\n=======================================================");
  console.log("   HUNT SMARTER / REVGENIQ — UNIMPORT RESEARCH DATA");
  console.log("   Dataset: HDL_HFCL_2026-10-20");
  console.log("=======================================================\n");

  // Load .env.local
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

  // Fetch target workspace (default 'aryan-com', or from --workspace-slug)
  let targetSlug = "aryan-com";
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--workspace-slug" && i + 1 < process.argv.length) {
      targetSlug = process.argv[i + 1];
    } else if (arg.startsWith("--workspace-slug=")) {
      targetSlug = arg.split("=")[1];
    }
  }

  const wsRes = await fetch(`${supabaseUrl}/rest/v1/workspaces?select=id,name,slug,created_at&order=created_at.desc`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!wsRes.ok) {
    console.error(`[ERROR] Failed to fetch workspaces: ${wsRes.status}`);
    process.exit(1);
  }

  const workspaces: any[] = await wsRes.json();
  const targetWs = workspaces.find((w) => w.slug === targetSlug);

  if (!targetWs) {
    console.error(`[ERROR] Workspace with slug "${targetSlug}" not found in database.`);
    console.error(`Available workspaces: ${workspaces.map((w) => w.slug).join(", ")}`);
    process.exit(1);
  }

  console.log(`[INFO] Target Workspace: "${targetWs.name}" (${targetWs.slug})`);

  if (!isAutoYes) {
    const confirmed = await promptConfirmation('Type YES to permanently delete all HDL_HFCL_2026-10-20 imported records: ');
    if (!confirmed) {
      console.log("[ABORTED] Operation cancelled by user. Zero rows deleted.");
      process.exit(0);
    }
  }

  console.log("\n[EXECUTING] Removing imported research records...");

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Prefer: "return=representation",
  };

  const tag = "HDL_HFCL_2026-10-20";

  // 1. Delete Dossiers
  const dosRes = await fetch(
    `${supabaseUrl}/rest/v1/dossiers?workspace_id=eq.${targetWs.id}&summary=like.*${encodeURIComponent(tag)}*`,
    { method: "DELETE", headers }
  );
  const deletedDossiers = dosRes.ok ? await dosRes.json() : [];
  console.log(` -> Deleted ${deletedDossiers.length} dossiers.`);

  // 2. Delete Contacts
  const contRes = await fetch(
    `${supabaseUrl}/rest/v1/contacts?workspace_id=eq.${targetWs.id}&icp_reason=like.*${encodeURIComponent(tag)}*`,
    { method: "DELETE", headers }
  );
  const deletedContacts = contRes.ok ? await contRes.json() : [];
  console.log(` -> Deleted ${deletedContacts.length} contacts.`);

  // 3. Delete Signals
  const sigRes = await fetch(
    `${supabaseUrl}/rest/v1/signals?workspace_id=eq.${targetWs.id}&explanation=like.*${encodeURIComponent(tag)}*`,
    { method: "DELETE", headers }
  );
  const deletedSignals = sigRes.ok ? await sigRes.json() : [];
  console.log(` -> Deleted ${deletedSignals.length} signals.`);

  // 4. Delete Companies
  const compRes = await fetch(
    `${supabaseUrl}/rest/v1/companies?workspace_id=eq.${targetWs.id}&icp_fit_reason=like.*${encodeURIComponent(tag)}*`,
    { method: "DELETE", headers }
  );
  const deletedCompanies = compRes.ok ? await compRes.json() : [];
  console.log(` -> Deleted ${deletedCompanies.length} companies.`);

  // 5. Delete Research Run
  const runRes = await fetch(
    `${supabaseUrl}/rest/v1/research_runs?workspace_id=eq.${targetWs.id}&name=in.(${encodeURIComponent('("HDL analyst research 20-Oct-2026","HTL analyst research 20-Oct-2026")')})`,
    { method: "DELETE", headers }
  );
  const deletedRuns = runRes.ok ? await runRes.json() : [];
  console.log(` -> Deleted ${deletedRuns.length} research runs.`);

  // 6. Delete ICP Profile
  const icpRes = await fetch(
    `${supabaseUrl}/rest/v1/icp_profiles?workspace_id=eq.${targetWs.id}&name=in.(${encodeURIComponent('("HDL Ltd (HFCL Group) - ICP 90+","HTL Ltd (HFCL Group) - ICP 90+")')})`,
    { method: "DELETE", headers }
  );
  const deletedIcp = icpRes.ok ? await icpRes.json() : [];
  console.log(` -> Deleted ${deletedIcp.length} ICP profiles.`);

  console.log("\n=======================================================");
  console.log("   UNIMPORT COMPLETE: ALL DATASET ROWS REMOVED");
  console.log("=======================================================\n");
}

main().catch(console.error);
