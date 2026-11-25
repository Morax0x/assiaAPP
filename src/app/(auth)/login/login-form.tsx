"use client";
import { useActionState } from "react";
import { signIn } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="البريد الإلكتروني">
        <Input name="email" type="email" autoComplete="username" dir="ltr" required className="text-start" />
      </Field>
      <Field label="كلمة المرور">
        <Input name="password" type="password" autoComplete="current-password" dir="ltr" required className="text-start" />
      </Field>
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "جارٍ الدخول..." : "دخول"}
      </Button>
    </form>
  );
}
