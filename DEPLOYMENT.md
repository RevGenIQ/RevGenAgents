# RevGen B2Bos — Startup Launch & Production Deployment Guide

This guide details everything you need to deploy **RevGen B2Bos** to production on **Vercel** with a live **Supabase PostgreSQL** database, multi-agent autonomous research engine, and your startup brand identity.

---

## 1. Quick Launch Summary

- **Platform**: Next.js 16 (App Router, Turbopack, Tailwind CSS)
- **Primary Hosting**: [Vercel](https://vercel.com) (Recommended) or AWS / Cloudflare / Docker
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL with Row-Level Security)
- **Core Engine**: Multi-Agent Mesh (Scout, Analyst, Matcher, Verifier, Writer)
- **Startup Identity**: RevGen B2Bos with origami geometric "R" logo and pitch-dark emerald/luminous teal theme (`#060f0d`, `#0df2aa`).

---

## 2. Production `.env` File (Copy & Paste to Vercel)

Set these environment variables in your Vercel Project Settings (**Settings** → **Environment Variables**):

```bash
# ==============================================================================
# RevGen B2Bos - Production Environment Variables
# ==============================================================================

# --- Supabase Public Configuration (Browser-safe publishable key) ---
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_publishable_key"

# --- Supabase Server Privileged Configuration (Server-side ONLY) ---
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_secret_key"
DATABASE_URL="postgresql://postgres.your-project-id:your-db-password@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"

# --- Super Admin Credentials ---
ADMIN_EMAIL="admin@revgeniq.os"
ADMIN_PASSWORD="your_secure_admin_password"
ADMIN_SECRET_KEY="your_random_admin_secret_key_32_chars"

# --- Session & Security Configuration ---
JWT_SECRET="your_random_jwt_secret_32_chars"
NEXT_PUBLIC_APP_URL="https://your-custom-domain.com"
ALLOWED_ORIGINS="https://your-custom-domain.com,http://localhost:3000"

# --- AI & LLM Providers (Server-side ONLY) ---
OPENAI_API_KEY="your_openai_api_key"
OPENAI_MODEL="gpt-4o-mini"
GEMINI_API_KEY="your_gemini_api_key"
ANTHROPIC_API_KEY="your_anthropic_api_key"
ANTHROPIC_MODEL="claude-sonnet-3-5"
LLM_PROVIDER="anthropic"

# --- Autonomous Search & Web Research Providers ---
TAVILY_API_KEY="your_tavily_api_key"
SERPER_API_KEY="your_serper_api_key"

# --- Contact Enrichment & Verification Providers ---
APOLLO_API_KEY="your_apollo_api_key"
ZEROBOUNCE_API_KEY="your_zerobounce_api_key"

# --- Rate Limit Budgets & Operational Safeguards ---
MAX_SEARCHES_PER_RUN=150
MAX_PAGE_FETCHES_PER_RUN=200
MAX_LLM_CALLS_PER_RUN=300
```

> [!NOTE]
> Wrap passwords containing special characters (`#`, `!`, `$`) in double quotes `"..."` as shown above.

---

## 3. Your Roles & Access Control for Launch

As Founder / Owner, you have two primary personas in RevGen B2Bos:

### 1. **Super Admin / Platform Owner Role**
- **URL**: `/admin` (or click "Admin Portal" from top navigation)
- **Role Capabilities**:
  - Global tenant control across all registered customer companies.
  - Live inspection of all background research runs, agent token usage, and API rate limits.
  - Credit allotment & MCP credit refunds for enterprise workspaces.
  - Tamper-evident cryptographic audit log inspection.
- **Login Credentials**:
  - Email: `ADMIN_EMAIL` from your `.env` (`admin@revgeniq.os`)
  - Password: `ADMIN_PASSWORD` from your `.env`

### 2. **Tenant Workspace Owner Role**
- **URL**: `/signin` or `/signup`
- **Role Capabilities**:
  - Dedicated workspace with complete database Row-Level Security (RLS) isolation.
  - Full access to **Command Center**, **ICP & Agent Search**, **Signal Stream**, **Account Intelligence**, and **Outreach Copy Lab**.
  - 100 free starting credits for running live agent searches.

---

## 4. Step-by-Step Vercel Deployment Instructions

1. **Push your repository** to GitHub/GitLab:
   ```bash
   git add .
   git commit -m "RevGen B2Bos: Launch ready UI/UX, authentic brand identity, and clean architecture"
   git push origin main
   ```

2. **Open Vercel Dashboard**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your `RevGen B2Bos` repository and click **Import**.

3. **Configure Build Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./`
   - **Build Command**: `next build`
   - **Output Directory**: `.next`

4. **Add Environment Variables**:
   - Paste the `.env` variables from Section 2 above into the Vercel Environment Variables section.
   - Set `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL (e.g. `https://revgen-b2bos.vercel.app`) or your custom startup domain.

5. **Deploy**:
   - Click **Deploy**. Vercel will complete the build and deploy in ~90 seconds.

6. **Add Custom Domain** (Optional):
   - In Vercel Project Settings → **Domains**, add your custom startup domain (e.g. `app.revgeniq.com` or `b2bos.revgen.ai`).
   - Add CNAME / A records in your DNS provider (Cloudflare, GoDaddy, Namecheap).

---

## 5. Live Verification Checklist

- [x] **Brand Logo**: The geometric origami "R" logo appears crisp in the Navbar, Sidebar, Favicon, and Auth screens.
- [x] **Split-Screen Sign in & Sign up**: Navigate to `/signup` or `/signin` to confirm the two-column layout with glowing evidence headline and company email authentication.
- [x] **Command Center**: Confirm `Good to see you, Ali.` heading, "New agent search" button, 14-day credit usage chart, and stat cards.
- [x] **Landing Page**: Verify the live signal engine ticker, illustrative Saffron Auto Components sample card, 5-agent mesh breakdown, and 3 credit tiers.
- [x] **Database Isolation**: Workspace RLS ensures zero cross-tenant data leaks.
