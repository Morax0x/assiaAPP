"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAction } from "@/lib/auth";
import { safe, formObj, emptyToNull, type Result } from "@/lib/action";
import { PERMISSION_PRESETS } from "@/lib/permissions";

const BAN = "876000h";

async function target(id: string) {
  const { data } = await createAdminClient().from("profiles").select("id,role,is_active,archived_at").eq("id", id).single();
  if (!data) throw new Error("المستخدم غير موجود");
  return data as { id: string; role: "owner" | "admin" | "staff"; is_active: boolean; archived_at: string | null };
}

function refresh(id?: string) {
  revalidatePath("/settings/users");
  if (id) revalidatePath(`/settings/users/${id}`);
}

export async function createUser(fd: FormData): Promise<Result<{ id: string }>> {
  return safe(async () => {
    const s = await requireAction("users.manage");
    const v = z.object({
      full_name: z.string().min(2, "الاسم مطلوب"), phone: z.string().optional(), job_title: z.string().max(60).optional(),
      preset: z.enum(["staff", "manager", "viewer"]).default("staff"),
      email: z.union([z.string().email("البريد غير صالح"), z.literal("")]).optional(), password: z.string().optional(),
    }).parse(formObj(fd));
    if (v.password && v.password.length < 8) throw new Error("كلمة المرور 8 أحرف على الأقل");
    if (v.email && !v.password) throw new Error("اكتب كلمة مرور مع البريد");
    // Everyone enters through the office link by default. Email/password are invisible plumbing unless you ask for them.
    const tag = Math.random().toString(36).slice(2, 10);
    const base = s.email.includes("@") ? s.email : "office@example.com";
    const email = v.email || base.replace("@", `+u${tag}@`);
    const password = v.password || crypto.randomUUID() + crypto.randomUUID();
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: v.full_name } });
    if (error) throw new Error(error.message.includes("already") ? "البريد مستخدم مسبقاً" : error.message);
    const id = data.user.id;
    const { error: e2 } = await admin.from("profiles").update({ role: "staff", full_name: v.full_name, phone: emptyToNull(v.phone), job_title: emptyToNull(v.job_title) }).eq("id", id);
    if (e2) throw e2;
    const { error: e3 } = await (await createClient()).rpc("set_user_permissions", { p_user: id, p_allowed: PERMISSION_PRESETS[v.preset].keys });
    if (e3) throw e3;
    refresh();
    return { id };
  });
}

export async function saveUserProfile(id: string, fd: FormData): Promise<Result> {
  return safe(async () => {
    const s = await requireAction("users.manage");
    const t = await target(id);
    if (t.role === "owner" && s.profile.role !== "owner") throw new Error("لا تملك صلاحية تعديل المالك");
    const v = z.object({
      full_name: z.string().min(2, "الاسم مطلوب"), phone: z.string().optional(), job_title: z.string().max(60).optional(),
      notes: z.string().max(1000).optional(), status: z.enum(["active", "inactive"]).optional(),
    }).parse(formObj(fd));
    const patch: Record<string, unknown> = { full_name: v.full_name, phone: emptyToNull(v.phone), job_title: emptyToNull(v.job_title), notes: emptyToNull(v.notes) };
    const admin = createAdminClient();
    if (v.status && t.role !== "owner") {
      if (id === s.userId && v.status === "inactive") throw new Error("لا يمكنك إيقاف حسابك");
      patch.is_active = v.status === "active";
      await admin.auth.admin.updateUserById(id, { ban_duration: v.status === "active" ? "none" : BAN });
    }
    const { error } = await admin.from("profiles").update(patch).eq("id", id);
    if (error) throw error;
    refresh(id);
  });
}

export async function saveUserPermissions(id: string, allowed: string[]): Promise<Result> {
  return safe(async () => {
    await requireAction("users.manage");
    const { error } = await (await createClient()).rpc("set_user_permissions", { p_user: id, p_allowed: allowed });
    if (error) throw error;
    refresh(id);
  });
}

export async function setUserPassword(id: string, fd: FormData): Promise<Result> {
  return safe(async () => {
    const s = await requireAction("users.manage");
    const t = await target(id);
    if (t.role === "owner" && s.profile.role !== "owner") throw new Error("لا تملك صلاحية");
    const pw = z.string().min(8, "كلمة المرور 8 أحرف على الأقل").parse(formObj(fd).password);
    const { error } = await createAdminClient().auth.admin.updateUserById(id, { password: pw });
    if (error) throw error;
  });
}

/** Removes a person. If they already have records (transactions, payments...), they are archived instead so history stays intact. */
export async function deleteUser(id: string): Promise<Result<{ archived: boolean }>> {
  return safe(async () => {
    const s = await requireAction("users.manage");
    const t = await target(id);
    if (t.role === "owner") throw new Error("لا يمكن حذف المالك");
    if (id === s.userId) throw new Error("لا يمكنك حذف حسابك");
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) { refresh(); return { archived: false }; }
    await admin.from("profiles").update({ is_active: false, archived_at: new Date().toISOString() }).eq("id", id);
    await admin.auth.admin.updateUserById(id, { ban_duration: BAN });
    refresh(id);
    return { archived: true };
  });
}

export async function restoreUser(id: string): Promise<Result> {
  return safe(async () => {
    await requireAction("users.manage");
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({ is_active: true, archived_at: null }).eq("id", id);
    if (error) throw error;
    await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
    refresh(id);
  });
}
