import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server only. Bypasses RLS: use for signed URLs, share pages, cron. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
