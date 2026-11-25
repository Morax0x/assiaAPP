import { Card, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { RolesMatrix } from "./roles-matrix";

export const metadata = { title: "الأدوار والصلاحيات" };

export default async function RolesSettings() {
  const s = await requireSession();
  if (s.profile.role !== "owner") redirect("/dashboard");
  const supabase = await createClient();
  const { data } = await supabase.from("role_permissions").select("*");
  const state: Record<string, boolean> = {};
  (data ?? []).forEach((r) => { state[`${r.role}:${r.permission}`] = r.allowed; });
  return (
    <Card>
      <CardHeader title="مصفوفة الصلاحيات" />
      <p className="px-4 pt-3 text-xs text-ink-3">صاحب العمل يملك كل الصلاحيات دائماً ولا يمكن تقييده. التعديل فوري.</p>
      <RolesMatrix perms={[...PERMISSIONS]} initial={state} />
    </Card>
  );
}
