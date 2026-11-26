import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPg } from "@/lib/mode";

/** Signs this browser in as the given person (used after the office-link PIN check). */
export async function signInAs(userId: string): Promise<{ error?: string }> {
  if (isPg()) {
    const { createSession } = await import("@/lib/pg/client");
    await createSession(userId);
    return {};
  }
  const admin = createAdminClient();
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (!email) return { error: "تعذر تجهيز الدخول. تواصل مع المكتب." };
  const { data: gl, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = gl?.properties?.hashed_token;
  if (error || !hashed) return { error: "تعذر تجهيز الدخول. حاول مرة أخرى." };
  const { error: ve } = await (await createClient()).auth.verifyOtp({ type: "magiclink", token_hash: hashed });
  if (ve) return { error: "تعذر تسجيل الدخول. حاول مرة أخرى." };
  return {};
}
