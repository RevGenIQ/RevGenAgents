-- ==============================================================================
-- RevGen AI — Clean Role-Authorized Schema & Complete Wipe of Previous Data
-- ==============================================================================

-- 1. (Removed) This migration previously TRUNCATEd all data tables. Re-running it
--    would wipe production data, so the wipe has been taken out.

-- 2. Client Access Requests (Clients request access via Registration form -> Admin approves & generates credentials)
CREATE TABLE IF NOT EXISTS public.client_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  company_domain TEXT NOT NULL,
  spokesperson_name TEXT NOT NULL,
  work_email TEXT NOT NULL,
  job_title TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  prospecting_goal TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  workspace_id UUID,
  generated_login_id TEXT,
  generated_password TEXT,
  assigned_humagent_id UUID,
  assigned_humagent_name TEXT,
  assigned_humagent_email TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Human Agents (Humagent) Credentials & Allocations (Created ONLY by Admin)
CREATE TABLE IF NOT EXISTS public.humagent_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  login_id TEXT NOT NULL UNIQUE,
  password_plain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  allocated_workspace_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Extend Workspaces for Admin-Created Client Credentials, Humagent Allocation & Talky Rooms
ALTER TABLE IF EXISTS public.workspaces
  ADD COLUMN IF NOT EXISTS generated_login_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS generated_password TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS primary_email TEXT,
  ADD COLUMN IF NOT EXISTS assigned_humagent_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_humagent_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_humagent_email TEXT,
  ADD COLUMN IF NOT EXISTS talky_room_id TEXT,
  ADD COLUMN IF NOT EXISTS talky_room_url TEXT,
  ADD COLUMN IF NOT EXISTS channel_name TEXT,
  ADD COLUMN IF NOT EXISTS spokespersons JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS icp_brief JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dnc_entries JSONB DEFAULT '[]'::jsonb;

-- 4b. Real-Time Workspace Collaboration Channels & Messages (Client + Assigned Humagent + Supervising Admin)
CREATE TABLE IF NOT EXISTS public.workspace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL, -- 'admin' | 'humagent' | 'client' | 'system'
  sender_name TEXT NOT NULL,
  sender_email TEXT DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'google_meet' | 'appointment' | 'document' | 'payment' | 'icp_upgrade' | 'system'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.workspace_messages ENABLE ROW LEVEL SECURITY;

-- 5. Extend Companies for All 20 Admin Data Enrichment Fields + 5 Signal Matching Columns + Delivery PDF Fields
ALTER TABLE IF EXISTS public.companies
  ADD COLUMN IF NOT EXISTS lead_number TEXT DEFAULT '01/05',
  ADD COLUMN IF NOT EXISTS company_number TEXT,
  ADD COLUMN IF NOT EXISTS employee_count_band TEXT,
  ADD COLUMN IF NOT EXISTS sub_sector TEXT,
  ADD COLUMN IF NOT EXISTS segment_status TEXT DEFAULT 'Enterprise · STATUS: QUALIFIED',
  ADD COLUMN IF NOT EXISTS campus_address TEXT,
  ADD COLUMN IF NOT EXISTS tech_stack JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url TEXT,
  ADD COLUMN IF NOT EXISTS company_type TEXT,
  ADD COLUMN IF NOT EXISTS company_revenue TEXT,
  ADD COLUMN IF NOT EXISTS company_logo TEXT,
  ADD COLUMN IF NOT EXISTS company_email_phone TEXT,
  ADD COLUMN IF NOT EXISTS priority_band TEXT DEFAULT 'High Priority',
  ADD COLUMN IF NOT EXISTS scoring_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS signal_targeted_brave JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS signal_hiring_google_careers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS signal_funding_tavily JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS signal_news_crawler JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS signal_social_verified JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recent_buying_signal_headline TEXT,
  ADD COLUMN IF NOT EXISTS recent_buying_signal_body TEXT,
  ADD COLUMN IF NOT EXISTS potential_pain_point TEXT,
  ADD COLUMN IF NOT EXISTS recommended_opener TEXT,
  ADD COLUMN IF NOT EXISTS checkpoints_cleared TEXT,
  ADD COLUMN IF NOT EXISTS contacts_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_links_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_stage TEXT DEFAULT 'human_agent_queue',
  ADD COLUMN IF NOT EXISTS delivery_batch_type TEXT DEFAULT 'sample',
  ADD COLUMN IF NOT EXISTS delivery_day_label TEXT DEFAULT 'Sample Card',
  ADD COLUMN IF NOT EXISTS reviewed_by_client BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS exported_by_client BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_feedback TEXT;

-- RLS stays enabled with no anon/authenticated policies: these tables hold
-- credentials and are only reachable through the service role in API routes.
ALTER TABLE public.client_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.humagent_users ENABLE ROW LEVEL SECURITY;
