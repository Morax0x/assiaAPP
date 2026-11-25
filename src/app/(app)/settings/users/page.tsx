import { KeyRound, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { ActionDialog } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { createUserAction, resetPasswordAction } from "@/modules/settings/actions";
import { ROLE_LABEL } from "@/lib/permissions";
import { UserControls } from "./user-controls";

export const metadata = { title: "الموظفون" };

export default async function UsersSettings() {
  const s = await requirePage("users.manage");
  const supabase = await createClient();
  const { data: users } = await supabase.from("profiles").select("*").order("created_at");
  const isOwner = s.profile.role === "owner";
  return (
    <Card>
      <CardHeader
        title={`المستخدمون (${users?.length ?? 0})`}
        action={
          <ActionDialog title="إضافة مستخدم" trigger={<><Plus /> مستخدم</>} triggerProps={{ size: "sm", variant: "primary" }} action={createUserAction}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="الاسم الكامل"><Input name="full_name" required /></Field>
              <Field label="الهاتف"><Input name="phone" dir="ltr" className="text-start" /></Field>
              <Field label="البريد الإلكتروني"><Input name="email" type="email" required dir="ltr" className="text-start" /></Field>
              <Field label="كلمة المرور المؤقتة" hint="8 أحرف على الأقل"><Input name="password" type="text" required minLength={8} dir="ltr" className="text-start" autoComplete="off" /></Field>
              <Field label="الدور" className="sm:col-span-2">
                <Select name="role" defaultValue="staff">
                  <option value="staff">{ROLE_LABEL.staff}</option>
                  {isOwner && <option value="admin">{ROLE_LABEL.admin}</option>}
                  {isOwner && <option value="owner">{ROLE_LABEL.owner}</option>}
                </Select>
              </Field>
            </div>
          </ActionDialog>
        }
      />
      <ul className="divide-y divide-line">
        {(users ?? []).map((u) => {
          const editable = isOwner || u.role === "staff";
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{u.full_name}{u.id === s.userId && <span className="ms-2 text-xs text-ink-3">(أنت)</span>}</div>
                <div className="text-xs text-ink-3 num">{u.phone ?? ""}</div>
              </div>
              {!u.is_active && <Badge tone="mute">معطّل</Badge>}
              {editable && u.id !== s.userId ? (
                <UserControls id={u.id} role={u.role} active={u.is_active} canSetRole={isOwner} />
              ) : (
                <Badge tone="navy">{ROLE_LABEL[u.role]}</Badge>
              )}
              {editable && (
                <ActionDialog title={`كلمة مرور جديدة: ${u.full_name}`} trigger={<KeyRound />} triggerProps={{ size: "icon", variant: "ghost" }} action={resetPasswordAction.bind(null, u.id)} submitLabel="تغيير">
                  <Field label="كلمة المرور الجديدة"><Input name="password" type="text" required minLength={8} dir="ltr" className="text-start" autoComplete="off" /></Field>
                </ActionDialog>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
