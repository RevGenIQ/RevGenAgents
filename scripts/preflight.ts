/**
 * Preflight Diagnostic Script
 * Validates external API connectivity and environment readiness before sales demos.
 * STRICT RULES:
 * - NEVER prints or logs any API key, secret, or token.
 * - Prints only status codes, latency, and sanitized PASS/FAIL diagnostic indicators.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// 1. Load .env.local into process.env if present
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

async function runPreflight() {
  console.log("\n=======================================================");
  console.log("   HUNT SMARTER / REVGENIQ — PREFLIGHT DIAGNOSTICS");
  console.log("=======================================================\n");

  let allPassed = true;

  // 1. Git ignore check
  try {
    const gitIgnoreCheck = execSync("git check-ignore .env.local", { encoding: "utf-8" }).trim();
    if (gitIgnoreCheck.includes(".env.local")) {
      console.log(" [PASS] Security: .env.local is confirmed git-ignored");
    } else {
      console.log(" [FAIL] Security: .env.local is NOT git-ignored!");
      allPassed = false;
    }
  } catch {
    // If exit code is 1, git check-ignore failed to match
    console.log(" [FAIL] Security: .env.local is NOT git-ignored!");
    allPassed = false;
  }

  // 2. Tavily Search API ping
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    console.log(" [FAIL] Scout Search (Tavily): TAVILY_API_KEY is missing from environment");
    allPassed = false;
  } else {
    try {
      const start = Date.now();
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: "enterprise technology",
          max_results: 1,
        }),
      });
      const latency = Date.now() - start;

      if (res.ok) {
        console.log(` [PASS] Scout Search (Tavily API): Connected (${res.status} OK, ${latency}ms)`);
      } else {
        console.log(` [FAIL] Scout Search (Tavily API): HTTP ${res.status} error`);
        allPassed = false;
      }
    } catch (e: any) {
      console.log(` [FAIL] Scout Search (Tavily API): Network unreachable (${e.message})`);
      allPassed = false;
    }
  }

  // 3. Google Gemini 2.0 Flash ping
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.log(" [FAIL] Analyst LLM (Gemini): GEMINI_API_KEY is missing from environment");
    allPassed = false;
  } else {
    try {
      const candidateModels = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-3.5-flash"];
      let connectedModel = "";
      let latency = 0;

      for (const model of candidateModels) {
        try {
          const start = Date.now();
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const res = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(5000),
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Ping test. Respond with: OK" }] }],
              generationConfig: { maxOutputTokens: 5 },
            }),
          });
          if (res.ok) {
            connectedModel = model;
            latency = Date.now() - start;
            break;
          }
        } catch {}
      }

      if (connectedModel) {
        console.log(` [PASS] Analyst LLM (Google Gemini - ${connectedModel}): Connected (200 OK, ${latency}ms)`);
      } else {
        console.log(` [FAIL] Analyst LLM (Gemini): All candidate models returned busy or error`);
        allPassed = false;
      }
    } catch (e: any) {
      console.log(` [FAIL] Analyst LLM (Gemini): Network unreachable (${e.message})`);
      allPassed = false;
    }
  }

  // 4. Supabase DB check
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.log(" [FAIL] Database: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
    allPassed = false;
  } else {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/workspaces?select=count`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });
      if (res.ok) {
        console.log(` [PASS] Database (Supabase PostgreSQL): Connected (${res.status} OK)`);
      } else {
        console.log(` [WARN] Database (Supabase PostgreSQL): HTTP ${res.status}`);
      }
    } catch (e: any) {
      console.log(` [FAIL] Database (Supabase PostgreSQL): Connection failed (${e.message})`);
      allPassed = false;
    }
  }

  // 5. Optional Integrations Check
  console.log("\n--- Optional Integrations Status ---");
  console.log(` Apollo API:      ${process.env.APOLLO_API_KEY ? "[CONFIGURED]" : "[NOT CONFIGURED - Optional]"}`);
  console.log(` ZeroBounce API:  ${process.env.ZEROBOUNCE_API_KEY ? "[CONFIGURED]" : "[NOT CONFIGURED - Optional]"}`);
  console.log(` Google Serper:   ${process.env.SERPER_API_KEY ? "[CONFIGURED]" : "[NOT CONFIGURED - Optional]"}`);
  console.log(` OpenAI API:      ${process.env.OPENAI_API_KEY ? "[CONFIGURED]" : "[NOT CONFIGURED - Optional]"}`);

  console.log("\n=======================================================");
  if (allPassed) {
    console.log(" STATUS: ALL CRITICAL SERVICES READY FOR LIVE DEMO");
  } else {
    console.log(" STATUS: SOME CRITICAL CHECKS FAILED — REVIEW ABOVE");
  }
  console.log("=======================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

runPreflight();
