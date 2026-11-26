"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAction } from "@/lib/auth";
import { safe, type Result } from "@/lib/action";
import { hashPin, newShortCode, siteUrl, verifyPin } from "@/lib/share";
import { signInAs } from "@/lib/sign-in-as";

const DEMO = () => process.env.DEMO_MODE === "1";
const MAX_TRIES = 5;
const LOCK_MIN = 15;

/* ---------------- owner / manager side ---------------- */

export async function getOfficeLink(): Promise<Result<{ enabled: boolean; url: string | null }>> {
  return safe(async () => {
    await requireAction("users.manage");
    if (DEMO()) return { enabled: true, url: `${siteUrl()}/e/demo` };
    const { data } = await createAdminClient().from("office_access").select("token,enabled").eq("id", true).single();
    return { enabled: !!data?.enabled && !!data?.token, url: data?.token ? `${siteUrl()}/e/${data.token}` : null };
  });
}

/** Creates a new link (the old one stops working) and turns it on. */
export async function rotateOfficeLink(): Promise<Result<{ url: string }>> {
  return safe(async () => {
    const s = await requireAction("users.manage");
    if (DEMO()) return { url: `${siteUrl()}/e/demo` };
    const token = newShortCode();
    const { error } = await createAdminClient().from("office_access").update({ token, enabled: true, rotated_at: new Date().toISOString(), rotated_by: s.userId }).eq("id", true);
    if (error) throw error;
    return { url: `${siteUrl()}/e/${token}` };
  });
}

export async function setOfficeLinkEnabled(enabled: boolean): Promise<Result> {
  return safe(async () => {
    await requireAction("users.manage");
    if (DEMO()) return;
    const { error } = await createAdminClient().from("office_access").update({ enabled }).eq("id", true);
    if (error) throw error;
  });
}

export async function resetPin(userId: string): Promise<Result> {
  return safe(async () => {
    await requireAction("users.manage");
    if (DEMO()) return;
    const { error } = await (await createClient()).rpc("reset_user_pin", { p_user: userId });
    if (error) throw error;
  });
}

export async function revokeSessions(userId: string): Promise<Result> {
  return safe(async () => {
    await requireAction("users.manage");
    if (DEMO()) return;
    const { error } = await (await createClient()).rpc("revoke_user_sessions", { p_user: userId });
    if (error) throw error;
  });
}

/* ---------------- public side: the shared link ---------------- */

async function linkIsValid(token: string) {
  if (DEMO()) return true;
  const { data } = await createAdminClient().from("office_access").select("token,enabled").eq("id", true).single();
  return !!data?.enabled && !!data.token && data.token.toLowerCase() === token.toLowerCase();
}

export type Person = { id: string; name: string; hasPin: boolean };

/** People who may use the shared link: every active user except the owner (who signs in with their own account). */
export async function listPeople(token: string): Promise<Person[] | null> {
  if (!(await linkIsValid(token))) return null;
  const admin = createAdminClient();
  const { data: people } = await admin.from("profiles").select("id,full_name").neq("role", "owner").eq("is_active", true).is("archived_at", null).order("full_name");
  const { data: pins } = await admin.from("user_pins").select("user_id");
  const has = new Set((pins ?? []).map((p) => p.user_id));
  return (people ?? []).map((p) => ({ id: p.id as string, name: p.full_name as string, hasPin: has.has(p.id) }));
}

const pinSchema = z.string().regex(/^\d{4,6}$/, "الرمز من 4 إلى 6 أرقام");

export async function enterWithPin(token: string, userId: string, pin: string, pin2?: string): Promise<{ error: string }> {
  try {
    if (!(await linkIsValid(token))) return { error: "هذا الرابط لم يعد صالحاً. اطلب الرابط الجديد من المكتب." };
    const p = pinSchema.safeParse(pin.trim());
    if (!p.success) return { error: p.error.issues[0].message };
    const admin = createAdminClient();
    const { data: prof } = await admin.from("profiles").select("role,is_active,archived_at").eq("id", userId).single();
    if (!prof || !prof.is_active || prof.archived_at || prof.role === "owner") return { error: "هذا الحساب غير متاح للدخول من الرابط." };

    if (DEMO()) {
      (await cookies()).set("demo_role", "staff", { path: "/", maxAge: 86400 });
      redirect("/dashboard");
    }

    const { data: row } = await admin.from("user_pins").select("pin_hash,attempts,locked_until").eq("user_id", userId).maybeSingle();
    if (row?.locked_until && new Date(row.locked_until) > new Date()) return { error: `تم إيقاف المحاولات مؤقتاً. حاول بعد ${LOCK_MIN} دقيقة أو اطلب إعادة الرمز من المكتب.` };

    if (!row) {
      // first time: the person chooses their own PIN
      if (pin2 === undefined || pin2.trim() !== pin.trim()) return { error: "اكتب الرمز مرتين بشكل متطابق" };
      const { error } = await admin.from("user_pins").insert({ user_id: userId, pin_hash: hashPin(pin.trim()) });
      if (error) return { error: "تعذر حفظ الرمز. حاول مرة أخرى." };
    } else if (!verifyPin(pin.trim(), row.pin_hash)) {
      const attempts = (row.attempts ?? 0) + 1;
      await admin.from("user_pins").update({ attempts, locked_until: attempts >= MAX_TRIES ? new Date(Date.now() + LOCK_MIN * 60_000).toISOString() : null }).eq("user_id", userId);
      return { error: attempts >= MAX_TRIES ? "رمز خاطئ عدة مرات. تم إيقاف المحاولات مؤقتاً." : `الرمز غير صحيح (تبقّى ${MAX_TRIES - attempts} محاولات)` };
    } else if (row.attempts) {
      await admin.from("user_pins").update({ attempts: 0, locked_until: null }).eq("user_id", userId);
    }

    const r = await signInAs(userId);
    if (r.error) return { error: r.error };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;   // redirect
    return { error: "حدث خطأ غير متوقع. حاول مرة أخرى." };
  }
  redirect("/dashboard");
}
