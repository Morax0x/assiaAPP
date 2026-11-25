import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createClient(): SupabaseClient {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") {
    // Demo mode: no real storage. Uploads are refused with a clear message.
    return {
      storage: { from: () => ({ upload: async () => ({ data: null, error: { message: "هذا وضع تجريبي: رفع الملفات غير متاح" } }) }) },
    } as unknown as SupabaseClient;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
