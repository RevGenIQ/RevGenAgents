-- ==============================================================================
-- RevGen AI — Security lockdown
-- ------------------------------------------------------------------------------
-- The earlier migrations let the public anon key read every table (USING (true))
-- and turned RLS off on the tables that store login credentials. All app data
-- access goes through server API routes using the service role, which bypasses
-- RLS, so anon/authenticated need no direct table access at all.
--
-- Safe to re-run: every statement is idempotent.
-- ==============================================================================

-- 1. Drop the permissive anon / authenticated policies from 20261016.
DROP POLICY IF EXISTS "anon_read_workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "authenticated_workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "anon_read_companies" ON public.companies;
DROP POLICY IF EXISTS "authenticated_companies" ON public.companies;
DROP POLICY IF EXISTS "anon_read_contacts" ON public.contacts;
DROP POLICY IF EXISTS "authenticated_contacts" ON public.contacts;
DROP POLICY IF EXISTS "anon_read_runs" ON public.research_runs;
DROP POLICY IF EXISTS "authenticated_runs" ON public.research_runs;
DROP POLICY IF EXISTS "anon_read_tasks" ON public.research_tasks;
DROP POLICY IF EXISTS "authenticated_tasks" ON public.research_tasks;
DROP POLICY IF EXISTS "anon_read_signals" ON public.signals;
DROP POLICY IF EXISTS "authenticated_signals" ON public.signals;
DROP POLICY IF EXISTS "anon_read_dossiers" ON public.dossiers;
DROP POLICY IF EXISTS "authenticated_dossiers" ON public.dossiers;
DROP POLICY IF EXISTS "anon_read_drafts" ON public.outreach_drafts;
DROP POLICY IF EXISTS "authenticated_drafts" ON public.outreach_drafts;
DROP POLICY IF EXISTS "anon_read_approvals" ON public.approvals;
DROP POLICY IF EXISTS "authenticated_approvals" ON public.approvals;
DROP POLICY IF EXISTS "anon_read_integrations" ON public.integration_connections;
DROP POLICY IF EXISTS "authenticated_integrations" ON public.integration_connections;
DROP POLICY IF EXISTS "anon_read_usage" ON public.usage_events;
DROP POLICY IF EXISTS "authenticated_usage" ON public.usage_events;
DROP POLICY IF EXISTS "anon_read_audit" ON public.audit_logs;
DROP POLICY IF EXISTS "authenticated_audit" ON public.audit_logs;
DROP POLICY IF EXISTS "anon_read_icp" ON public.icp_profiles;
DROP POLICY IF EXISTS "authenticated_icp" ON public.icp_profiles;

-- 2. Re-enable RLS on the tables 20261031 left open (they hold plaintext credentials).
ALTER TABLE public.client_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.humagent_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_messages ENABLE ROW LEVEL SECURITY;

-- 3. Belt and braces: remove direct table privileges from the public roles on
--    the credential tables, so a future permissive policy cannot expose them.
REVOKE ALL ON public.client_access_requests FROM anon, authenticated;
REVOKE ALL ON public.humagent_users FROM anon, authenticated;
REVOKE ALL ON public.workspaces FROM anon, authenticated;
