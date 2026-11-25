import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Sends a push to the owner's registered devices only. Returns number delivered. */
export async function pushToOwner(payload: PushPayload) {
  if (!configure()) return 0;
  const admin = createAdminClient();
  const { data: owners } = await admin.from("profiles").select("id").eq("role", "owner").eq("is_active", true);
  const ids = (owners ?? []).map((o) => o.id);
  if (!ids.length) return 0;
  const { data: subs } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id", ids);
  let ok = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
        ok++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }),
  );
  return ok;
}
