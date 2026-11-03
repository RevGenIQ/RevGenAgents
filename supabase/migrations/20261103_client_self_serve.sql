-- Self-serve clients, one-time sample run, full company research columns and
-- the enrichment loop (Client -> Admin -> Humagent -> Admin -> Client).
-- Idempotent: safe to run more than once.

-- Workspaces: plan, sample lifecycle and hashed passwords for self-registered clients.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS sample_status TEXT NOT NULL DEFAULT 'not_claimed',
  ADD COLUMN IF NOT EXISTS sample_run_id UUID,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS registered_via TEXT NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_plan_check') THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_plan_check CHECK (plan IN ('trial', 'premium', 'suspended'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_sample_status_check') THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_sample_status_check
      CHECK (sample_status IN ('not_claimed', 'icp_pending', 'running', 'delivered'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_registered_via_check') THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_registered_via_check CHECK (registered_via IN ('self', 'admin'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_primary_email_lower_idx
  ON public.workspaces (lower(primary_email)) WHERE primary_email IS NOT NULL;

-- Companies: the full research column set (each value's source lives in field_sources_json).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS sic_codes TEXT,
  ADD COLUMN IF NOT EXISTS naics_codes TEXT,
  ADD COLUMN IF NOT EXISTS hq_location TEXT,
  ADD COLUMN IF NOT EXISTS latest_funding_amount TEXT,
  ADD COLUMN IF NOT EXISTS last_raised_at DATE,
  ADD COLUMN IF NOT EXISTS company_description TEXT,
  ADD COLUMN IF NOT EXISTS data_confidence INTEGER,
  ADD COLUMN IF NOT EXISTS total_targeted_signals INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS why_icp_fit TEXT,
  ADD COLUMN IF NOT EXISTS what_to_pitch TEXT,
  ADD COLUMN IF NOT EXISTS field_sources_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS extra_context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS research_status TEXT NOT NULL DEFAULT 'done',
  ADD COLUMN IF NOT EXISTS run_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_research_status_check') THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_research_status_check CHECK (research_status IN ('queued', 'researching', 'done'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS companies_run_id_idx ON public.companies (run_id);

-- Contacts: the remaining Humagent enrichment columns.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS sub_department TEXT,
  ADD COLUMN IF NOT EXISTS contact_state TEXT,
  ADD COLUMN IF NOT EXISTS contact_address TEXT,
  ADD COLUMN IF NOT EXISTS work_direct_phone TEXT;

-- Enrichment requests: one row per client request for a run's accounts.
CREATE TABLE IF NOT EXISTS public.enrichment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.research_runs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'assigned', 'in_progress', 'submitted', 'approved', 'delivered', 'rejected')),
  client_note TEXT,
  requested_columns TEXT[] NOT NULL DEFAULT '{}',
  assigned_humagent_id UUID,
  assigned_humagent_name TEXT,
  admin_note TEXT,
  csv_rows INTEGER,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enrichment_requests_workspace_idx ON public.enrichment_requests (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS enrichment_requests_status_idx ON public.enrichment_requests (status);

-- Service role only, like every other table: the browser never queries Supabase directly.
ALTER TABLE public.enrichment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.enrichment_requests FROM anon, authenticated;
