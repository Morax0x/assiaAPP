import "server-only";
import crypto from "node:crypto";

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const newToken = () => crypto.randomBytes(24).toString("base64url");

export function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${h}`;
}

export function verifyPin(pin: string, stored: string) {
  const [salt, h] = stored.split(":");
  if (!salt || !h) return false;
  const c = crypto.scryptSync(pin, salt, 32);
  const b = Buffer.from(h, "hex");
  return b.length === c.length && crypto.timingSafeEqual(b, c);
}

function secret() {
  return process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";
}

export const pinCookieName = (linkId: string) => `sp_${linkId.slice(0, 12)}`;
export const pinCookieValue = (linkId: string) =>
  crypto.createHmac("sha256", secret()).update(linkId).digest("hex");

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
