/** Sends a browser-side error to the server log (never throws). */
export function reportError(where: string, message: string, detail?: string) {
  try {
    void fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ where, message, detail }), keepalive: true });
  } catch { /* nothing else to do */ }
}
