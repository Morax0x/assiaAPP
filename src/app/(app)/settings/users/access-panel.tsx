"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, LogOut, MessageCircle, Power, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/form";
import { resetPin, revokeSessions, rotateOfficeLink, setOfficeLinkEnabled } from "@/modules/auth/enter";

/** The single office entry link: copy it once and pin it in the WhatsApp group. */
export function OfficeLinkCard({ enabled, url }: { enabled: boolean; url: string | null }) {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function create() {
    setBusy(true);
    const r = await rotateOfficeLink();
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("تم إنشاء الرابط");
    router.refresh();
  }
  async function toggle() {
    setBusy(true);
    const r = await setOfficeLinkEnabled(!enabled);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    router.refresh();
  }
  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toast.error("تعذر النسخ"); }
  }
  const wa = url ? `https://wa.me/?text=${encodeURIComponent(`رابط الدخول إلى نظام المكتب (ثبّتوه عندكم):\n${url}\n\nافتحوه، اختاروا اسمكم، واختاروا رمزاً سرياً من 4 أرقام. بعدها يبقى حسابكم مفتوحاً على جوالكم.`)}` : "#";

  return (
    <Card className="mb-4">
      <CardHeader title="رابط دخول المكتب (واحد للجميع)" action={url ? <span className={`rounded-md px-2.5 py-1 text-[13px] font-semibold ${enabled ? "bg-ok-soft text-ok" : "bg-mute-soft text-mute"}`}>{enabled ? "يعمل" : "متوقف"}</span> : undefined} />
      <div className="space-y-3 p-4">
        <p className="text-[15px] leading-7 text-ink-2">انسخ هذا الرابط مرة واحدة وثبّته في مجموعة الموظفين. كل موظف يفتحه، يضغط اسمه، ويختار رمزاً سرياً من 4 أرقام، ثم يبقى جهازه مسجّلاً دائماً.</p>
        {url ? (
          <>
            <Input readOnly value={url} dir="ltr" className="text-start text-xs" onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copy}>{copied ? <Check /> : <Copy />} {copied ? "تم النسخ" : "نسخ الرابط"}</Button>
              <Button asChild variant="accent"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> مشاركة في واتساب</a></Button>
              <Button variant="ghost" onClick={toggle} disabled={busy}><Power /> {enabled ? "إيقاف الرابط" : "تفعيل الرابط"}</Button>
              <ConfirmButton variant="ghost" title="تجديد الرابط" message="سيتوقف الرابط القديم عن العمل، وعليك تثبيت الرابط الجديد في المجموعة. الأجهزة المسجّلة تبقى مسجّلة." action={rotateOfficeLink} confirmLabel="تجديد">
                <RefreshCw /> رابط جديد
              </ConfirmButton>
            </div>
          </>
        ) : (
          <Button size="lg" onClick={create} disabled={busy}>إنشاء رابط الدخول</Button>
        )}
      </div>
    </Card>
  );
}

/** Per-person actions for staff: forgot PIN / lost phone. */
export function UserAccessButtons({ id, name }: { id: string; name: string }) {
  return (
    <div className="flex items-center">
      <ConfirmButton size="icon" variant="ghost" title={`إعادة رمز ${name}`} message="سيختار الموظف رمزاً جديداً في المرة القادمة التي يدخل فيها من جهاز جديد." action={() => resetPin(id)} confirmLabel="إعادة الرمز">
        <KeyRound />
      </ConfirmButton>
      <ConfirmButton size="icon" variant="ghost" title={`إنهاء جلسات ${name}`} message="سيُسجَّل خروجه من كل أجهزته (مثلاً عند ضياع الجوال)، ويدخل من جديد بالرابط والرمز." action={() => revokeSessions(id)} confirmLabel="إنهاء الجلسات">
        <LogOut className="text-bad" />
      </ConfirmButton>
    </div>
  );
}
