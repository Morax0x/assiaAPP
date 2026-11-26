import { notFound } from "next/navigation";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { saveUserProfile } from "@/modules/users/actions";
import { fmtDateTime } from "@/lib/utils";
import { PermissionsEditor } from "../permissions-editor";
import { DeleteUserButton, RestoreUserButton, SecurityButtons } from "../user-actions";

export const metadata = { title: "بيانات مستخدم" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePage("users.manage");
  const supabase = await createClient();
  const { data: u } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!u) notFound();
  const isOwnerAccount = u.role === "owner";
  const canEditProfile = !isOwnerAccount || s.profile.role === "owner";

  // Current permissions = role defaults, then this person's own choices on top
  const [{ data: roleP }, { data: mine }] = await Promise.all([
    supabase.from("role_permissions").select("permission,allowed").eq("role", u.role),
    supabase.from("user_permissions").select("permission,allowed").eq("user_id", id),
  ]);
  const m = new Map<string, boolean>((roleP ?? []).map((r) => [r.permission as string, !!r.allowed]));
  (mine ?? []).forEach((r) => m.set(r.permission as string, !!r.allowed));
  const current = isOwnerAccount ? PERMISSIONS.map((p) => p.key as string) : [...m].filter(([, v]) => v).map(([k]) => k);

  let email = "", lastSignIn: string | null = null;
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(id);
    email = data?.user?.email ?? ""; lastSignIn = data?.user?.last_sign_in_at ?? null;
  } catch { /* demo mode */ }
  const autoEmail = email.includes("+u") || email.includes("+staff");

  return (
    <>
      <PageHeader back={{ href: "/settings/users", label: "رجوع للمستخدمين" }} title={u.full_name} description={[u.job_title, u.phone].filter(Boolean).join(" · ") || undefined} />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="البيانات" />
            <div className="p-4">
              {canEditProfile ? (
                <ActionForm action={saveUserProfile.bind(null, id)} resetOnSuccess={false}>
                  <div className="space-y-3">
                    <Field label="الاسم"><Input name="full_name" defaultValue={u.full_name} required /></Field>
                    <Field label="المسمى (نص حر)"><Input name="job_title" defaultValue={u.job_title ?? ""} placeholder="مثال: محاسب" /></Field>
                    <Field label="الهاتف"><Input name="phone" defaultValue={u.phone ?? ""} dir="ltr" className="text-start" inputMode="tel" /></Field>
                    {!isOwnerAccount && (
                      <Field label="الحالة" hint="الموقوف لا يستطيع الدخول، وتبقى بياناته كما هي">
                        <Select name="status" defaultValue={u.is_active ? "active" : "inactive"} disabled={u.id === s.userId}>
                          <option value="active">يعمل</option><option value="inactive">موقوف</option>
                        </Select>
                      </Field>
                    )}
                    <Field label="ملاحظاتك عنه (لا يراها أحد غيرك)"><Textarea name="notes" defaultValue={u.notes ?? ""} /></Field>
                  </div>
                </ActionForm>
              ) : <p className="text-sm text-ink-3">لا تملك صلاحية تعديل حساب المالك.</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="معلومات الحساب" />
            <dl className="space-y-2.5 p-4 text-[15px]">
              <div className="flex justify-between gap-3"><dt className="text-ink-3">أُضيف</dt><dd className="num">{fmtDateTime(u.created_at)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">آخر دخول</dt><dd className="num">{lastSignIn ? fmtDateTime(lastSignIn) : "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">طريقة الدخول</dt><dd>{isOwnerAccount ? "بريد وكلمة مرور" : autoEmail ? "رابط المكتب + رمز" : "رابط المكتب أو البريد"}</dd></div>
              {email && !autoEmail && <div className="flex justify-between gap-3"><dt className="text-ink-3">البريد</dt><dd dir="ltr" className="truncate">{email}</dd></div>}
            </dl>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader title="ماذا يستطيع أن يفعل؟" />
            {isOwnerAccount ? <p className="p-4 text-[15px] text-ink-2">صاحب الحساب الرئيسي يملك كل الصلاحيات دائماً.</p> : <PermissionsEditor id={id} initial={current} />}
          </Card>
          {!isOwnerAccount && (
            <Card>
              <CardHeader title="الأمان" />
              <SecurityButtons id={id} name={u.full_name} />
            </Card>
          )}
          {!isOwnerAccount && u.id !== s.userId && (
            u.archived_at ? (
              <Card className="flex items-center justify-between gap-3 p-4"><span className="text-[15px] text-ink-2">هذا المستخدم مؤرشف</span><RestoreUserButton id={id} /></Card>
            ) : (
              <DeleteUserButton id={id} name={u.full_name} />
            )
          )}
        </div>
      </div>
    </>
  );
}
