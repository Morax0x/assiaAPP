"use client";
import * as React from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/modules/push/actions";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = React.useState<"loading" | "unsupported" | "off" | "on" | "denied">("loading");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidKey) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [vapidKey]);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("denied"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidKey) });
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushSubscription(j, navigator.userAgent);
      if (!r.ok) { await sub.unsubscribe(); return toast.error(r.error); }
      setState("on");
      toast.success("تم تفعيل الإشعارات على هذا الجهاز");
    } catch { toast.error("تعذر تفعيل الإشعارات"); } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState("off");
    } finally { setBusy(false); }
  }

  async function test() {
    const r = await sendTestPush();
    if (!r.ok) return toast.error(r.error);
    toast[r.data?.delivered ? "success" : "error"](r.data?.delivered ? "أُرسل إشعار تجريبي" : "لا توجد أجهزة مسجلة أو مفاتيح VAPID غير مضبوطة");
  }

  if (state === "loading") return <p className="text-xs text-ink-3">...</p>;
  if (state === "unsupported") return <p className="rounded-md bg-warn-soft p-3 text-xs text-warn">هذا المتصفح لا يدعم الإشعارات، أو مفاتيح VAPID غير مضبوطة في الخادم.</p>;
  if (state === "denied") return <p className="rounded-md bg-bad-soft p-3 text-xs text-bad">الإشعارات محظورة. فعّلها من إعدادات المتصفح للموقع ثم أعد المحاولة.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {state === "off" ? (
        <Button onClick={enable} disabled={busy}><Bell /> تفعيل الإشعارات على هذا الجهاز</Button>
      ) : (
        <>
          <Button variant="outline" onClick={disable} disabled={busy}><BellOff /> إيقاف على هذا الجهاز</Button>
          <Button variant="outline" onClick={test}><Send /> إشعار تجريبي</Button>
        </>
      )}
    </div>
  );
}
