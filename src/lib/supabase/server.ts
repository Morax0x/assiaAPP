import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPg } from "@/lib/mode";

export async function createClient(): Promise<SupabaseClient> {
  if (isPg()) {
    const { pgServerClient } = await import("@/lib/pg/client");
    return (await pgServerClient()) as unknown as SupabaseClient;
  }
  if (process.env.DEMO_MODE === "1") {
    const { demoServerClient } = await import("@/lib/demo/client");
    return (await demoServerClient()) as unknown as SupabaseClient;
  }
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* called from a Server Component: middleware refreshes the session */
          }
        },
      },
    },
  );
}
