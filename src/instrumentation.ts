export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAlertsScheduler } = await import("./instrumentation-node");
    startAlertsScheduler();
  }
}
