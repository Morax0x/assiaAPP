import { redirect } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { PushToggle } from "./push-toggle";

export const metadata = { title: "إشعاراتي" };

export default async function NotificationsSettings() {
  const s = await requireSession();
  if (s.profile.role !== "owner") redirect("/dashboard");
  return (
    <Card>
      <CardHeader title="إشعارات الجهاز" />
      <div className="space-y-3 p-4 text-sm text-ink-2">
        <p>فعّل الإشعارات على هذا الجهاز لتصلك تنبيهات المستندات المنتهية أو القريبة من الانتهاء حتى والتطبيق مغلق. الإشعارات مخصصة لحسابك أنت فقط.</p>
        <p className="text-xs text-ink-3">على الآيفون: ثبّت التطبيق أولاً من «مشاركة ثم إضافة إلى الشاشة الرئيسية» ثم افتحه من الأيقونة وفعّل الإشعارات.</p>
        <PushToggle vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      </div>
    </Card>
  );
}
