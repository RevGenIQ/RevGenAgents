#!/usr/bin/env bash
set -e

# ==============================================================================
# HUNT SMARTER / B2Bos — One-Command Local Development Setup
# ==============================================================================

# Rule 3: Refuse to run if .env.local already exists, unless --force is passed
FORCE=false
for arg in "$@"; do
  if [ "$arg" = "--force" ]; then
    FORCE=true
    break
  fi
done

if [ -f .env.local ] && [ "$FORCE" = false ]; then
  echo "❌ Error: .env.local already exists."
  echo "   To overwrite your existing configuration, re-run with: npm run setup -- --force"
  echo "   or: bash scripts/setup.sh --force"
  exit 1
fi

echo "============================================================"
echo " 🚀 HUNT SMARTER / B2Bos — Local Development Setup"
echo "============================================================"
echo ""

# ------------------------------------------------------------------------------
# 1. Check Node.js and npm exist
# ------------------------------------------------------------------------------
echo "==> [1/8] Checking Node.js and npm..."
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js is not installed. Please install Node.js (v18+) and try again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ Error: npm is not installed. Please install npm and try again."
  exit 1
fi

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo "    ✓ Node.js ($NODE_VER) and npm ($NPM_VER) detected."
echo ""

# ------------------------------------------------------------------------------
# 2. Check Supabase CLI login status
# ------------------------------------------------------------------------------
echo "==> [2/8] Checking Supabase CLI login status..."
if ! npx -y supabase projects list >/dev/null 2>&1; then
  echo "⚠️  You are not currently logged in to Supabase CLI."
  echo "    Please log in to your Supabase account."
  read -r -p "    Run 'npx supabase login' now? (Y/n): " DO_LOGIN
  if [[ "$DO_LOGIN" =~ ^[Nn]$ ]]; then
    echo "❌ Please log in with 'npx supabase login' first, then re-run this setup."
    exit 1
  else
    npx -y supabase login
  fi
else
  echo "    ✓ Supabase CLI session active."
fi
echo ""

# ------------------------------------------------------------------------------
# 3. Prompt for Supabase project ref and link
# ------------------------------------------------------------------------------
echo "==> [3/8] Linking Supabase Project..."
PROJECT_REF=""
while [ -z "$PROJECT_REF" ]; do
  read -r -p "    Enter your Supabase Project Reference (e.g. abcdefghijklmno): " PROJECT_REF
  PROJECT_REF=$(echo "$PROJECT_REF" | tr -d '[:space:]')
done

echo "    Linking project ref: $PROJECT_REF"
echo "    (Supabase CLI will prompt for your database password itself)"
npx -y supabase link --project-ref "$PROJECT_REF"
echo "    ✓ Supabase project linked successfully."
echo ""

# ------------------------------------------------------------------------------
# 4. Show migrations and prompt to run db push
# ------------------------------------------------------------------------------
echo "==> [4/8] Reviewing Database Migrations..."
if [ -d "supabase/migrations" ]; then
  echo "    Available migration files in supabase/migrations/:"
  for f in supabase/migrations/*.sql; do
    [ -f "$f" ] && echo "      - $(basename "$f")"
  done
else
  echo "❌ Error: supabase/migrations directory not found."
  exit 1
fi

echo ""
echo "    Running 'npx supabase db push' will apply these migrations to project '$PROJECT_REF'."
read -r -p "    Type YES to continue: " CONFIRM_MIGRATE
if [ "$CONFIRM_MIGRATE" != "YES" ]; then
  echo "❌ Database push aborted by user. Setup stopped."
  exit 1
fi

npx -y supabase db push
echo "    ✓ Database schema migrated successfully."
echo ""

# ------------------------------------------------------------------------------
# 5. Fetch API keys and generate fresh .env.local
# ------------------------------------------------------------------------------
echo "==> [5/8] Configuring Environment Variables (.env.local)..."
if [ ! -f ".env.example" ]; then
  echo "❌ Error: .env.example not found."
  exit 1
fi

# Fetch keys using Supabase CLI
echo "    Fetching API keys from Supabase CLI..."
KEYS_OUTPUT=$(npx -y supabase projects api-keys --project-ref "$PROJECT_REF" --reveal -o json 2>/dev/null || true)

ANON_KEY=""
SERVICE_ROLE_KEY=""

if [ -n "$KEYS_OUTPUT" ]; then
  ANON_KEY=$(node -e '
    try {
      const data = JSON.parse(process.argv[1]);
      const list = Array.isArray(data) ? data : (data.keys || []);
      const item = list.find(k => k.name === "anon" || k.name === "public" || k.type === "anon");
      console.log(item ? (item.api_key || item.key || "") : "");
    } catch(e) { console.log(""); }
  ' "$KEYS_OUTPUT")

  SERVICE_ROLE_KEY=$(node -e '
    try {
      const data = JSON.parse(process.argv[1]);
      const list = Array.isArray(data) ? data : (data.keys || []);
      const item = list.find(k => k.name === "service_role" || k.name === "secret" || k.type === "service_role");
      console.log(item ? (item.api_key || item.key || "") : "");
    } catch(e) { console.log(""); }
  ' "$KEYS_OUTPUT")
fi

SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

if [ -z "$ANON_KEY" ]; then
  echo "    ⚠️  Could not automatically fetch anon key via CLI."
  read -r -p "    Enter NEXT_PUBLIC_SUPABASE_ANON_KEY: " ANON_KEY
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "    ⚠️  Could not automatically fetch service_role key via CLI."
  read -r -s -p "    Enter SUPABASE_SERVICE_ROLE_KEY: " SERVICE_ROLE_KEY
  echo ""
fi

# Generate fresh crypto secrets
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
ADMIN_SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n')
ADMIN_PASSWORD=$(openssl rand -base64 48 | tr -d '\n')

# Prompt for Admin Email
read -r -p "    Enter Super Admin Email [admin@yourdomain.com]: " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then
  ADMIN_EMAIL="admin@yourdomain.com"
fi

# Optional DATABASE_URL
echo "    DATABASE_URL: Leave blank if pasting directly into .env.local later."
read -r -p "    Enter DATABASE_URL (optional): " DATABASE_URL

# Write .env.local safely without printing secrets
cat <<EOF > .env.local
# ==============================================================================
# RevGenIQ OS / HUNT SMARTER - Local Environment Configuration
# Generated automatically by scripts/setup.sh
# ==============================================================================

# Supabase Public Configuration (Browser-safe publishable key)
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}

# Supabase Server Privileged Configuration (Server-side ONLY, never in browser)
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# Direct Database Connection String (paste your pooled/direct string if available)
DATABASE_URL=${DATABASE_URL}

# Super Admin Direct Access Credentials
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_SECRET_KEY=${ADMIN_SECRET_KEY}

# Session & JWT Configuration
JWT_SECRET=${JWT_SECRET}

# LLM Providers (Server-side ONLY - add your keys when ready)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-5-5
GROQ_API_KEY=

# Research & Search Providers (Server-side ONLY - add your keys when ready)
TAVILY_API_KEY=
SERPER_API_KEY=
BRAVE_API_KEY=

# Contact Enrichment & Verification Providers (Server-side ONLY - add your keys when ready)
APOLLO_API_KEY=
ZEROBOUNCE_API_KEY=
NEVERBOUNCE_API_KEY=

# App URL & Security
NEXT_PUBLIC_APP_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

# Research & Rate Limit Budgets
MAX_SEARCHES_PER_RUN=150
MAX_PAGE_FETCHES_PER_RUN=200
MAX_LLM_CALLS_PER_RUN=300
EOF

chmod 600 .env.local
echo "    ✓ .env.local created with fresh secrets (permissions: 600)."
echo ""

# ------------------------------------------------------------------------------
# 6. Run npm install
# ------------------------------------------------------------------------------
echo "==> [6/8] Installing project dependencies (npm install)..."
npm install
echo "    ✓ Dependencies installed."
echo ""

# ------------------------------------------------------------------------------
# 7. Check for seed_demo.sql and conditionally load demo data
# ------------------------------------------------------------------------------
echo "==> [7/8] Checking for Demo Seed Data..."
if [ -f "supabase/seed_demo.sql" ]; then
  echo "    Demo seed file detected: supabase/seed_demo.sql"
  read -r -p "    Load demo data? (y/n): " LOAD_DEMO
  if [[ "$LOAD_DEMO" =~ ^[Yy]$ ]]; then
    echo "    Target Linked Project: $PROJECT_REF"
    read -r -p "    Type YES to confirm loading demo data to '$PROJECT_REF': " CONFIRM_SEED
    if [ "$CONFIRM_SEED" = "YES" ]; then
      npx -y supabase db execute --file supabase/seed_demo.sql
      echo "    ✓ Demo data loaded into $PROJECT_REF."
    else
      echo "    Skipped demo data load."
    fi
  else
    echo "    Skipped demo data load."
  fi
else
  echo "    (supabase/seed_demo.sql not found; skipping demo data)"
fi
echo ""

# ------------------------------------------------------------------------------
# 8. Print next steps
# ------------------------------------------------------------------------------
echo "============================================================"
echo " 🎉 Local Development Setup Complete!"
echo "============================================================"
echo " Next steps:"
echo "   1. Start local server : npm run dev"
echo "   2. Open in browser    : http://localhost:3000"
echo "   3. Sign up / Sign in  : Create your first enterprise workspace"
echo "   4. Optional API Keys  : Add OpenAI, Tavily, Apollo keys into .env.local"
echo "============================================================"
