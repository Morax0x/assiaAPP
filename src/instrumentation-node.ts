import { runAlertsJob } from "@/lib/alerts-job";

/** Runs the alerts job inside the server process (works on Railway without a separate cron service). */
export function startAlertsScheduler() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const tick = async () => {
    try {
      // Only push during office-friendly hours (UAE, UTC+4): 07:00-20:00
      const hour = (new Date().getUTCHours() + 4) % 24;
      if (hour < 7 || hour >= 20) return;
      await runAlertsJob();
    } catch (e) {
      console.error("[alerts-job]", e);
    }
  };
  setTimeout(tick, 30_000);
  setInterval(tick, 3 * 60 * 60 * 1000);
}
