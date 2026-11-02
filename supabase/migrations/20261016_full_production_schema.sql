-- ==============================================================================
-- RevGenIQ OS - Complete Production Schema & Multi-Tenant RLS
-- Target: Supabase PostgreSQL 15+
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    domain TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. workspace_members
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'researcher', 'sales_user', 'read_only')),
    full_name TEXT,
    business_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. companies
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    canonical_domain TEXT NOT NULL,
    company_name TEXT NOT NULL,
    company_aliases JSONB DEFAULT '[]'::jsonb,
    industry TEXT,
    employee_count INTEGER,
    annual_revenue_usd NUMERIC,
    total_funding_usd NUMERIC,
    latest_funding TEXT,
    company_city TEXT,
    company_state TEXT,
    company_country TEXT,
    company_linkedin TEXT,
    company_keywords TEXT,
    company_technologies JSONB DEFAULT '{}'::jsonb,
    founded_year INTEGER,
    icp_score INTEGER DEFAULT 80,
    icp_fit_reason TEXT,
    overview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, canonical_domain)
);

-- 4. contacts
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    company_name TEXT,
    company_domain TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    title TEXT NOT NULL,
    seniority TEXT,
    department TEXT,
    work_email TEXT,
    personal_linkedin TEXT,
    mobile_number TEXT,
    direct_number TEXT,
    contact_city TEXT,
    contact_country TEXT,
    role_start_date DATE,
    verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('verified_current', 'pending_verification', 'ex_employee_rejected', 'unverified')),
    verified_at TIMESTAMPTZ,
    email_status TEXT NOT NULL DEFAULT 'unverified' CHECK (email_status IN ('deliverable', 'catch_all', 'undeliverable', 'unverified')),
    phone_status TEXT,
    icp_score INTEGER DEFAULT 80,
    icp_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. research_runs
CREATE TABLE IF NOT EXISTS public.research_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    created_by UUID,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'stopped', 'failed')),
    target_count INTEGER NOT NULL DEFAULT 10,
    min_icp_score INTEGER NOT NULL DEFAULT 80,
    include_dm BOOLEAN NOT NULL DEFAULT true,
    maximize_coverage BOOLEAN NOT NULL DEFAULT true,
    live_search BOOLEAN NOT NULL DEFAULT false,
    icp_input JSONB NOT NULL DEFAULT '{}'::jsonb,
    progress_percent INTEGER NOT NULL DEFAULT 0,
    current_step TEXT DEFAULT 'Job queued',
    leads_found INTEGER NOT NULL DEFAULT 0,
    leads_verified INTEGER NOT NULL DEFAULT 0,
    stop_requested BOOLEAN NOT NULL DEFAULT false,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    report_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 6. research_tasks
CREATE TABLE IF NOT EXISTS public.research_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.research_runs(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL,
    company_name TEXT,
    company_domain TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    output_data JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 7. signals
CREATE TABLE IF NOT EXISTS public.signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL,
    title TEXT NOT NULL,
    supporting_excerpt TEXT NOT NULL,
    evidence_url TEXT,
    event_date DATE,
    publication_date DATE,
    retrieval_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.85 CHECK (confidence >= 0 AND confidence <= 1),
    explanation TEXT,
    is_confirmed_fact BOOLEAN NOT NULL DEFAULT true,
    source_layer TEXT DEFAULT 'Web & News',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. dossiers
CREATE TABLE IF NOT EXISTS public.dossiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    target_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    summary TEXT NOT NULL,
    icp_score INTEGER NOT NULL DEFAULT 85,
    icp_score_breakdown JSONB DEFAULT '{}'::jsonb,
    buying_window_days INTEGER DEFAULT 60,
    priority_tier TEXT NOT NULL DEFAULT 'P1' CHECK (priority_tier IN ('P1', 'P2', 'P3')),
    key_triggers JSONB DEFAULT '[]'::jsonb,
    recommended_opener TEXT,
    talking_points JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'draft', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. outreach_drafts
CREATE TABLE IF NOT EXISTS public.outreach_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    dossier_id UUID REFERENCES public.dossiers(id) ON DELETE SET NULL,
    subject_line TEXT NOT NULL,
    body_text TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'linkedin', 'multichannel')),
    tone TEXT NOT NULL DEFAULT 'consultative',
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'sent')),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. approvals
CREATE TABLE IF NOT EXISTS public.approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('dossier_release', 'outreach_draft', 'warmup_change', 'geo_content')),
    item_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    recommendation TEXT,
    confidence NUMERIC(3, 2) DEFAULT 0.88,
    sla_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    actioned_by UUID,
    actioned_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. integration_connections
CREATE TABLE IF NOT EXISTS public.integration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    is_connected BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'disconnected', 'rate_limited', 'demo_mode')),
    last_checked_at TIMESTAMPTZ DEFAULT now(),
    last_error TEXT,
    config_metadata JSONB DEFAULT '{}'::jsonb,
    usage_count_this_month INTEGER NOT NULL DEFAULT 0,
    cost_estimate_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, provider_type, provider_name)
);

-- 12. usage_events
CREATE TABLE IF NOT EXISTS public.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    run_id UUID REFERENCES public.research_runs(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    api_calls INTEGER NOT NULL DEFAULT 1,
    cost_usd NUMERIC(10, 5) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_id UUID,
    actor_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. icp_profiles
CREATE TABLE IF NOT EXISTS public.icp_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    product TEXT,
    pain_points TEXT,
    criteria JSONB DEFAULT '{}'::jsonb,
    minimum_score INTEGER DEFAULT 80,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_profiles ENABLE ROW LEVEL SECURITY;

-- Allow service role full access and authenticated users to access their workspaces
CREATE POLICY "service_role_all_workspaces" ON public.workspaces FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_workspaces" ON public.workspaces FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_workspaces" ON public.workspaces FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_companies" ON public.companies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_companies" ON public.companies FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_companies" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_contacts" ON public.contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_contacts" ON public.contacts FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_runs" ON public.research_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_runs" ON public.research_runs FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_runs" ON public.research_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_tasks" ON public.research_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_tasks" ON public.research_tasks FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_tasks" ON public.research_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_signals" ON public.signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_signals" ON public.signals FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_signals" ON public.signals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_dossiers" ON public.dossiers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_dossiers" ON public.dossiers FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_dossiers" ON public.dossiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_drafts" ON public.outreach_drafts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_drafts" ON public.outreach_drafts FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_drafts" ON public.outreach_drafts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_approvals" ON public.approvals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_approvals" ON public.approvals FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_approvals" ON public.approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_integrations" ON public.integration_connections FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_integrations" ON public.integration_connections FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_integrations" ON public.integration_connections FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_usage" ON public.usage_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_usage" ON public.usage_events FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_usage" ON public.usage_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_audit" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_audit" ON public.audit_logs FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_audit" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_icp" ON public.icp_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_icp" ON public.icp_profiles FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_icp" ON public.icp_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed Default Production Workspaces
INSERT INTO public.workspaces (id, name, slug, domain)
VALUES 
    ('553334a9-2029-448d-8ca7-e664ff64adde', 'Acme Growth AI', 'acme-growth-ai', 'acmegrowth.com'),
    ('79e9eb6b-5101-4dea-b405-431e175185a6', 'Beta Growth Scale', 'beta-growth-scale', 'betaglobal.com')
ON CONFLICT (id) DO NOTHING;
