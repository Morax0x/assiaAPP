"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Input } from "@/components/ui/form";
import { resetPin, revokeSessions } from "@/modules/auth/enter";
import { deleteUser, restoreUser, setUserPassword } from "@/modules/users/actions";

export function SecurityButtons({ id, name }: { id: string; name: string }) {
  return (
    <div className="flex flex-wrap gap-2 p-4">
      <ConfirmButton variant="outline" title={`إعادة رمز ${name}`} message="سيختار رمزاً جديداً في المرة القادمة التي يدخل فيها من رابط المكتب." action={() => resetPin(id)} confirmLabel="إعادة الرمز"><KeyRound /> نسي الرمز السري</ConfirmButton>
      <ConfirmButton variant="outline" title={`إنهاء جلسات ${name}`} message="سيُسجَّل خروجه من كل أجهزته (مثلاً عند ضياع الجوال). يدخل من جديد بالرابط والرمز." action={() => revokeSessions(id)} confirmLabel="إنهاء الجلسات"><LogOut /> ضاع جواله: إنهاء كل الجلسات</ConfirmButton>
      <ActionDialog title={`كلمة مرور جديدة: ${name}`} trigger={<><KeyRound /> تغيير كلمة المرور</>} action={setUserPassword.bind(null, id)} submitLabel="تغيير">
        <Field label="كلمة المرور الجديدة" hint="تُستخدم فقط إن دخل بالبريد من صفحة تسجيل الدخول"><Input name="password" type="text" required minLength={8} dir="ltr" className="text-start" autoComplete="off" /></Field>
      </ActionDialog>
    </div>
  );
}

export function DeleteUserButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      variant="danger" className="w-full" title={`حذف ${name}`}
      message="سيُحذف المستخدم نهائياً. وإن كان له سجلات (معاملات أو دفعات) فيُؤرشف بدل الحذف حتى يبقى التاريخ سليماً، ويمكنك استرجاعه لاحقاً."
      action={async () => {
        const r = await deleteUser(id);
        if (!r.ok) return r;
        toast.message(r.data?.archived ? "لديه سجلات، لذلك تمت أرشفته (يمكن استرجاعه)" : "تم حذف المستخدم");
        router.push("/settings/users");
        return r;
      }}
      confirmLabel="حذف"
    ><Trash2 /> حذف المستخدم</ConfirmButton>
  );
}

export function RestoreUserButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await restoreUser(id);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("تم الاسترجاع"); router.refresh();
    })}><Undo2 /> استرجاع</Button>
  );
}
