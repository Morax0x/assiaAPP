import Link from "next/link";
import { ChevronLeft, Plus, UserRound } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { ActionDialog } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { PERMISSION_PRESETS, PERMISSION_SHORT, PERMISSIONS } from "@/lib/permissions";
import { createUser } from "@/modules/users/actions";
import { getOfficeLink } from "@/modules/auth/enter";
import { OfficeLinkCard } from "./access-panel";
import { RestoreUserButton } from "./user-actions";

export const metadata = { title: "المستخدمون" };

export default async function UsersSettings() {
  const s = await requirePage("users.manage");
  const supabase = await createClient();
  const { data: users } = await supabase.from("profiles").select("id,full_name,phone,job_title,role,is_active,archived_at").order("created_at");
  const link = await getOfficeLink();
  const [{ data: rp }, { data: up }] = await Promise.all([
    supabase.from("role_permissions").select("role,permission,allowed"),
    supabase.from("user_permissions").select("user_id,permission,allowed"),
  ]);
  const canDo = (u: { id: string; role: string }) => {
    if (u.role === "owner") return PERMISSIONS.map((x) => x.key as string);
    const m = new Map<string, boolean>((rp ?? []).filter((r) => r.role === u.role).map((r) => [r.permission as string, !!r.allowed]));
    (up ?? []).filter((r) => r.user_id === u.id).forEach((r) => m.set(r.permission as string, !!r.allowed));
    return [...m].filter(([, v]) => v).map(([k]) => k);
  };
  const active = (users ?? []).filter((u) => !u.archived_at);
  const archived = (users ?? []).filter((u) => u.archived_at);
  return (
    <>
      <OfficeLinkCard enabled={link.ok ? !!link.data?.enabled : false} url={link.ok ? link.data?.url ?? null : null} />
      <Card>
        <CardHeader
          title={`المستخدمون (${active.length})`}
          action={
            <ActionDialog title="إضافة مستخدم" trigger={<><Plus /> إضافة مستخدم</>} triggerProps={{ size: "sm", variant: "primary" }} action={createUser}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="الاسم"><Input name="full_name" required /></Field>
                <Field label="المسمى (يكتبه كما تريد)"><Input name="job_title" placeholder="مثال: محاسب، مندوب، مديرة المكتب" /></Field>
                <Field label="الهاتف"><Input name="phone" dir="ltr" className="text-start" inputMode="tel" /></Field>
                <Field label="صلاحيات البداية" hint="تعدّلها بعد الحفظ كما تشاء">
                  <Select name="preset" defaultValue="staff">
                    {(Object.keys(PERMISSION_PRESETS) as (keyof typeof PERMISSION_PRESETS)[]).map((k) => <option key={k} value={k}>{PERMISSION_PRESETS[k].label}</option>)}
                  </Select>
                </Field>
                <p className="text-sm leading-7 text-ink-3 sm:col-span-2">يدخل من رابط المكتب ويختار اسمه ورمزه، فلا حاجة لبريد أو كلمة مرور. اكتبهما فقط إن أردتَ أن يدخل من صفحة تسجيل الدخول العادية:</p>
                <Field label="البريد (اختياري)"><Input name="email" type="email" dir="ltr" className="text-start" /></Field>
                <Field label="كلمة المرور (اختياري)"><Input name="password" type="text" minLength={8} dir="ltr" className="text-start" autoComplete="off" /></Field>
              </div>
            </ActionDialog>
          }
        />
        <ul className="divide-y divide-line">
          {active.map((u) => (
            <li key={u.id}>
              <Link href={`/settings/users/${u.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-bg">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy-soft text-navy"><UserRound className="size-5" strokeWidth={1.75} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{u.full_name}{u.id === s.userId && <span className="ms-2 text-xs font-normal text-ink-3">(أنت)</span>}{u.role === "owner" && <span className="ms-2 text-xs font-normal text-ink-3">(حساب المالك)</span>}</div>
                  <div className="truncate text-sm text-ink-3">{[u.job_title, u.phone].filter(Boolean).join(" · ") || "—"}</div>
                  <div className="mt-0.5 text-xs leading-5 text-ink-3">{(() => { const c = canDo(u); if (u.role === "owner") return "كل الصلاحيات"; const names = c.filter((k) => !k.endsWith(".delete")).map((k) => PERMISSION_SHORT[k]).filter(Boolean); return c.length === 0 ? "عرض فقط" : `${c.length} من ${PERMISSIONS.length} صلاحية: ${names.slice(0, 4).join("، ")}${names.length > 4 ? "…" : ""}`; })()}</div>
                </div>
                {!u.is_active && <Badge tone="mute">موقوف</Badge>}
                <ChevronLeft className="size-4 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      {archived.length > 0 && (
        <Card className="mt-4">
          <CardHeader title={`المؤرشفون (${archived.length})`} />
          <ul className="divide-y divide-line">
            {archived.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink-2">{u.full_name}{u.job_title ? ` · ${u.job_title}` : ""}</span>
                <RestoreUserButton id={u.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
