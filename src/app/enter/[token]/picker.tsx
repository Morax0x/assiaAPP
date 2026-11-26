"use client";
import * as React from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { enterWithPin, type Person } from "@/modules/auth/enter";

export function Picker({ token, people }: { token: string; people: Person[] }) {
  const [who, setWho] = React.useState<Person | null>(null);
  const [pin, setPin] = React.useState("");
  const [pin2, setPin2] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!who) return;
    setBusy(true); setError("");
    const r = await enterWithPin(token, who.id, pin, who.hasPin ? undefined : pin2);   // redirects on success
    setBusy(false);
    if (r?.error) setError(r.error);
  }

  if (!who) {
    return (
      <div className="rounded-card border border-line bg-surface p-4">
        <p className="mb-3 text-center text-[15px] font-semibold">من أنت؟ اضغط على اسمك</p>
        <ul className="space-y-2">
          {people.map((p) => (
            <li key={p.id}>
              <button onClick={() => { setWho(p); setPin(""); setPin2(""); setError(""); }} className="flex min-h-14 w-full items-center gap-3 rounded-ctl border border-line bg-bg px-4 text-start text-[17px] font-medium hover:border-navy hover:bg-navy-soft">
                <UserRound className="size-5 text-navy" strokeWidth={1.75} /> {p.name}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs leading-6 text-ink-3">المالك والمدير يدخلان من صفحة تسجيل الدخول العادية.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-line bg-surface p-5">
      <button type="button" onClick={() => setWho(null)} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-navy"><ArrowRight className="size-4" /> غيّر الاسم</button>
      <h2 className="text-xl font-bold">أهلاً {who.name}</h2>
      {who.hasPin ? (
        <p className="text-[15px] text-ink-2">اكتب رمزك السري.</p>
      ) : (
        <p className="rounded-ctl bg-navy-soft px-3 py-2.5 text-[15px] leading-7 text-navy">أول مرة تدخل؟ اختر رمزاً سرياً من 4 إلى 6 أرقام لنفسك، واحفظه. ستكتبه فقط عند الدخول من جهاز جديد.</p>
      )}
      <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoFocus autoComplete="off" maxLength={6} dir="ltr" placeholder="••••" className="h-14 text-center text-2xl tracking-[0.5em]" />
      {!who.hasPin && (
        <Input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="off" maxLength={6} dir="ltr" placeholder="أعد كتابة الرمز" className="h-14 text-center text-lg tracking-[0.3em]" />
      )}
      {error && <p className="rounded-ctl bg-bad-soft px-3 py-2.5 text-sm text-bad">{error}</p>}
      <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={busy || pin.length < 4}>{busy ? "جارٍ الدخول..." : "دخول"}</Button>
    </form>
  );
}
