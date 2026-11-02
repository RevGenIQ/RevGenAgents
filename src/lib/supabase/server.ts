import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// No anon-key fallback: server routes rely on the service role once RLS blocks anon access.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createServerClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase server configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
