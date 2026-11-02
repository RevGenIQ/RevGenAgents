-- ==============================================================================
-- RevGenIQ OS - Core Schema & Multi-Tenant RLS Policies
-- Target: Supabase PostgreSQL (Public Schema)
-- ==============================================================================

-- 1. research_runs
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

-- 2. research_tasks
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

-- 3. signals
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

-- 4. dossiers
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

-- 5. outreach_drafts
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

-- 6. approvals
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

-- 7. integration_connections
CREATE TABLE IF NOT EXISTS public.integration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    is_connected BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'demo_mode' CHECK (status IN ('healthy', 'degraded', 'disconnected', 'rate_limited', 'demo_mode')),
    last_checked_at TIMESTAMPTZ,
    last_error TEXT,
    config_metadata JSONB DEFAULT '{}'::jsonb,
    usage_count_this_month INTEGER NOT NULL DEFAULT 0,
    cost_estimate_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, provider_type, provider_name)
);

-- 8. usage_events
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

-- 9. audit_logs
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

-- Enable Row-Level Security
ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Apply Tenant Isolation Policies Scoped by Workspace
CREATE POLICY runs_all ON public.research_runs FOR ALL USING (app_security.is_workspace_member(workspace_id)) WITH CHECK (app_security.is_workspace_member(workspace_id));
CREATE POLICY tasks_all ON public.research_tasks FOR ALL USING (app_security.is_workspace_member(workspace_id)) WITH CHECK (app_security.is_workspace_member(workspace_id));
CREATE POLICY signals_all ON public.signals FOR ALL USING (app_security.is_workspace_member(workspace_id)) WITH CHECK (app_security.is_workspace_member(workspace_id));
CREATE POLICY dossiers_all ON public.dossiers FOR ALL USING (app_security.is_workspace_member(workspace_id)) WITH CHECK (app_security.is_workspace_member(workspace_id));
CREATE POLICY drafts_all ON public.outreach_drafts FOR ALL USING (app_security.is_workspace_member(workspace_id)) WITH CHECK (app_security.is_workspace_member(workspace_id));
CREATE POLICY approvals_all ON public.approvals FOR ALL USING (app_security.is_workspace_member(workspace_id)) WITH CHECK (app_security.is_workspace_member(workspace_id));
CREATE POLICY integrations_all ON public.integration_connections FOR ALL USING (app_security.is_workspace_member(workspace_id)) WITH CHECK (app_security.is_workspace_member(workspace_id));
CREATE POLICY usage_all ON public.usage_events FOR ALL USING (app_security.is_workspace_member(workspace_id)) WITH CHECK (app_security.is_workspace_member(workspace_id));
CREATE POLICY audit_all ON public.audit_logs FOR ALL USING (app_security.is_workspace_member(workspace_id)) WITH CHECK (app_security.is_workspace_member(workspace_id));
