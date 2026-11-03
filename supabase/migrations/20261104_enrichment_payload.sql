-- Staged Humagent enrichment: the parsed CSV is kept on the request and only
-- applied to companies/contacts when the Admin approves it, so the client never
-- sees unreviewed data. Idempotent.

ALTER TABLE public.enrichment_requests
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS submitted_by TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
