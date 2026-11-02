# RevGenIQ OS — System Architecture & Code Organization

This document details the modular folder structure, separation of concerns, multi-agent engine pipeline, and state management in **RevGenIQ OS**.

---

## 1. Directory Structure

```
RevGen B2Bos/
├── .env.example                  # Sanitized environment template (no real secrets)
├── .env.local                    # Active server-side secrets, admin credentials & JWT secrets
├── next.config.ts                # Next.js security headers & CSP configuration
├── package.json                  # Dependencies & security overrides
├── SECURITY.md                   # Defensive security documentation & audit matrix
├── ARCHITECTURE.md               # Clean architecture & system organization
├── public/                       # Static assets
└── src/
    ├── app/
    │   ├── admin/
    │   │   └── page.tsx          # Super-Admin Dashboard (Users, Searches, MCP, Credits)
    │   ├── api/
    │   │   ├── admin/            # Super-Admin restricted endpoints (Overview, Users, Runs, Credits)
    │   │   ├── auth/             # Authentication & session endpoints (login, signup, logout, me)
    │   │   ├── runs/             # Research runs & workflow execution
    │   │   ├── contacts/         # Verified contacts & deliverability
    │   │   ├── signals/          # Dated buying signals & evidence URLs
    │   │   ├── dossiers/         # Synthesized executive dossiers
    │   │   ├── approvals/        # Human-in-the-loop review workflow
    │   │   ├── export/           # CSV export with formula injection defense
    │   │   ├── import/           # CSV batch import with size & schema validation
    │   │   ├── integrations/     # Provider adapter connectivity & health
    │   │   └── audit/            # Audit & security event telemetry
    │   ├── layout.tsx            # Global layout with ThemeProvider, AuthProvider & AuthModal
    │   ├── page.tsx              # Adaptive root: Landing Page or Prospecting Workspace
    │   ├── error.tsx             # Global Error Boundary with retry capabilities
    │   └── not-found.tsx         # Custom 404 Not Found Page with aurora radar theme
    ├── components/
    │   ├── auth/
    │   │   └── AuthModal.tsx     # Company email & domain authentication modal
    │   ├── landing/
    │   │   └── LandingPage.tsx   # Premium B2B SaaS landing page with live simulator
    │   ├── layout/
    │   │   ├── Sidebar.tsx       # Navigation, workspace switcher, and user identity
    │   │   ├── Topbar.tsx        # Screen header, global search pill, and admin link
    │   │   └── CommandPalette.tsx# Quick keyboard shortcut navigation (⌘K)
    │   ├── modules/              # Core business UI views (CommandCenter, ResearchRuns, etc.)
    │   └── ui/                   # Reusable atomic UI components (ThemeToggle, Badges)
    ├── context/
    │   └── AuthContext.tsx       # Reactive authentication & workspace state management
    └── lib/
        ├── adapters/             # External service adapters (LLM, Research, Verification, Enrichment)
        ├── api/
        │   └── response.ts       # Standardized API response & error formatters
        ├── engine/
        │   └── researchRunner.ts # Multi-agent autonomous pipeline orchestrator
        ├── security/             # Centralized defensive security subsystem
        │   ├── auth.ts           # HMAC session tokens, cookie management, timing-safe compare
        │   ├── cors.ts           # CSRF verification & CORS policies
        │   ├── logger.ts         # Sensitive keyword redaction logger
        │   ├── rateLimit.ts      # Sliding window token bucket rate limiter
        │   ├── ssrf.ts           # IP range & private host SSRF filter
        │   ├── validator.ts      # Input sanitization, company email & domain validation
        │   └── webhook.ts        # HMAC-SHA256 signature verifier
        └── supabase/
            ├── client.ts         # Browser client (tokens isolated from localStorage)
            ├── server.ts         # Server-side client with service role verification
            └── types.ts          # Core domain TypeScript models
```

---

## 2. Separation of Concerns

1. **Business Logic vs. UI**:
   - UI components (`src/components/modules/*`) focus strictly on presentation and user interaction.
   - API endpoints (`src/app/api/*`) handle authorization, rate limiting, and input validation.
   - External provider adapters (`src/lib/adapters/*`) and research orchestration (`src/lib/engine/*`) encapsulate business execution logic.

2. **State Management**:
   - `AuthContext` provides application-wide session state, active workspace selection, admin role verification, and login/signup modals.

3. **Multi-Agent Pipeline**:
   - **Scout Agent**: Multi-layer web crawling and account discovery.
   - **Analyst Agent**: Extracts corroborating buying triggers and assigns dated evidence.
   - **Matcher Agent**: Identifies target decision makers from corporate registries.
   - **Verifier Agent**: Real-time SMTP handshake and deliverability scoring.
   - **Writer Agent**: Synthesizes high-impact opening lines and tailored talking points.
