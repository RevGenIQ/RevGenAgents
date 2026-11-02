# Local Development Setup Guide

This guide describes how to bootstrap your local development environment for **HUNT SMARTER / B2Bos** using the one-command setup script.

---

## ⚡ Quick Start

From the root of the project, run:

```bash
npm run setup
```

or directly with bash:

```bash
bash scripts/setup.sh
```

If you already have a `.env.local` file and wish to regenerate it with fresh keys, pass `--force`:

```bash
npm run setup -- --force
```

---

## 📋 What the Setup Script Does Automatically

The setup script performs the following 8 steps in sequence:

1. **System Requirements Check**:
   - Verifies that `node` (v18+) and `npm` are installed on your machine.

2. **Supabase CLI Authentication**:
   - Checks if you have an active session with the Supabase CLI (`npx supabase projects list`).
   - If not logged in, prompts you to run `npx supabase login`.

3. **Supabase Project Linking**:
   - Prompts for your Supabase Project Reference ID (found in your Supabase project dashboard settings or URL: `https://supabase.com/dashboard/project/<project-ref>`).
   - Runs `npx supabase link --project-ref <ref>` to securely link the project to your local directory.

4. **Production Database Migration Push**:
   - Displays all migration files in `supabase/migrations/` (including `20261016_full_production_schema.sql`).
   - Requires you to explicitly type `YES` before applying schema migrations.
   - Executes `npx supabase db push` to create all tables, indexes, row-level security (RLS) policies, and enum types on your linked database.

5. **Automatic Environment Generation (`.env.local`)**:
   - Fetches your project URL, anon publishable key, and service role key securely using `npx supabase projects api-keys`.
   - Generates fresh, cryptographically secure 48-byte secrets for:
     - `JWT_SECRET` (`openssl rand -base64 48`)
     - `ADMIN_SECRET_KEY` (`openssl rand -base64 48`)
     - `ADMIN_PASSWORD` (`openssl rand -base64 48`)
   - Prompts for your Super Admin email address.
   - Writes `.env.local` using `.env.example` as a template with file permissions restricted to `600`.
   - Leaves 3rd-party provider keys empty for you to fill in as needed.

6. **Dependency Installation**:
   - Runs `npm install` to ensure all frontend and backend dependencies are installed and up to date.

7. **Optional Demo Data Loading**:
   - Checks if `supabase/seed_demo.sql` exists in your workspace.
   - If present, prompts whether you wish to load demo data (`y/n`).
   - Confirms the target project ref before executing to ensure data is only sent to your project.
   - If the file does not exist, this step is skipped cleanly.

8. **Launch Instructions**:
   - Outputs commands to start the local development server: `npm run dev`.
   - Directs you to open `http://localhost:3000` to sign up or log in.

---

## 🔒 Security & Privacy Guarantees

- **No Secret Logging**: The setup script never prints, logs, or echoes private API keys, passwords, or JWT secrets to the terminal.
- **Git-Ignored**: `.env.local` is strictly ignored by `.gitignore` (`.env*`) and will never be tracked or committed.
- **No Stale or Shared Credentials**: Fresh cryptographic keys are generated uniquely for your instance. No credentials from repository documentation or past commits are reused.
- **Overwrite Protection**: The script refuses to run if `.env.local` already exists unless explicitly passed the `--force` flag.

---

## 🛠️ What Stays Manual

While the script automates project linking, database schema deployment, secret generation, and environment creation, the following steps are intentionally manual:

1. **Supabase Database Password**:
   - When `npx supabase link` runs, the Supabase CLI will prompt you directly in your terminal for your database password. This password is never stored in plain text or logged by the script.

2. **3rd-Party AI & Intelligence Provider Keys** (Optional for basic UI; required for live agents):
   - Open your generated `.env.local` to add any provider keys you wish to use:
     - **OpenAI / Anthropic / Gemini**: Required for autonomous agents, research synthesizers, and copy lab generation (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`).
     - **Tavily / Serper**: Required for live web crawling and Google News scouting (`TAVILY_API_KEY`, `SERPER_API_KEY`).
     - **Apollo / ZeroBounce**: Required for contact discovery and email deliverability checks (`APOLLO_API_KEY`, `ZEROBOUNCE_API_KEY`).

3. **Direct Database Connection URL (`DATABASE_URL`)**:
   - If you require direct connection pooling (e.g. for external DB clients or custom scripts), copy your connection string from the Supabase Dashboard (`Project Settings -> Database -> Connection String`) into `DATABASE_URL` in `.env.local`.

---

## 🚀 Running the Development Server

Once setup finishes:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.
