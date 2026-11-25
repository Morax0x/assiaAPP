import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, type PermKey } from "@/lib/permissions";

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: "owner" | "admin" | "staff";
  is_active: boolean;
};

export type Session = { userId: string; email: string; profile: Profile; perms: Set<string> };

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
  if (!profile || !profile.is_active) return null;
  let perms = new Set<string>();
  if (profile.role === "owner") {
    perms = new Set(PERMISSIONS.map((p) => p.key));
  } else {
    const { data: rows } = await supabase
      .from("role_permissions")
      .select("permission, allowed")
      .eq("role", profile.role);
    perms = new Set((rows ?? []).filter((r) => r.allowed).map((r) => r.permission));
  }
  return { userId: data.user.id, email: data.user.email ?? "", profile: profile as Profile, perms };
});

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requirePage(perm?: PermKey) {
  const s = await requireSession();
  if (perm && !s.perms.has(perm)) redirect("/dashboard");
  return s;
}

/** For server actions: throws instead of redirecting. */
export async function requireAction(perm?: PermKey) {
  const s = await getSession();
  if (!s) throw new Error("غير مسجل الدخول");
  if (perm && !s.perms.has(perm)) throw new Error("لا تملك صلاحية لهذا الإجراء");
  return s;
}
