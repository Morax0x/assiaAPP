"use server";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/auth";
import { safe, type Result } from "@/lib/action";
import { pushToOwner } from "@/lib/push";

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string): Promise<Result> {
  return safe(async () => {
    const s = await requireAction();
    if (s.profile.role !== "owner") throw new Error("الإشعارات الخارجية مخصصة لصاحب العمل فقط");
    const supabase = await createClient();
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    const { error } = await supabase.from("push_subscriptions").insert({
      user_id: s.userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 200),
    });
    if (error) throw error;
  });
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  return safe(async () => {
    await requireAction();
    const supabase = await createClient();
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw error;
  });
}

export async function sendTestPush(): Promise<Result<{ delivered: number }>> {
  return safe(async () => {
    const s = await requireAction();
    if (s.profile.role !== "owner") throw new Error("للمالك فقط");
    const delivered = await pushToOwner({ title: "اختبار الإشعارات", body: "الإشعارات تعمل على هذا الجهاز", url: "/alerts", tag: "test" });
    return { delivered };
  });
}
