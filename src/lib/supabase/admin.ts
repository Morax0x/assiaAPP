import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoAdminClient } from "@/lib/demo/client";
import { pgAdminClient } from "@/lib/pg/client";
import { isPg } from "@/lib/mode";

/** Service-role client. Server only. Bypasses RLS: use for signed URLs, share pages, cron. */
export function createAdminClient(): SupabaseClient {
  if (process.env.DEMO_MODE === "1") return demoAdminClient() as unknown as SupabaseClient;
  if (isPg()) return pgAdminClient() as unknown as SupabaseClient;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
