"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { submitSharePin } from "@/modules/share/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

export function PinForm({ token, locked }: { token: string; locked: boolean }) {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(submitSharePin.bind(null, token), undefined);
  React.useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={action} className="space-y-3">
      <Input name="pin" inputMode="numeric" autoComplete="one-time-code" maxLength={8} dir="ltr" className="h-12 text-center text-lg tracking-[0.5em]" disabled={locked} required />
      {(state?.error || locked) && <p className="text-center text-sm text-bad">{locked ? "تم إيقاف الرابط بعد محاولات خاطئة. اطلب رابطاً جديداً." : state?.error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending || locked}>{pending ? "..." : "فتح"}</Button>
    </form>
  );
}
