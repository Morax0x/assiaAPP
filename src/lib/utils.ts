import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(v: number | string | null | undefined, currency = "AED") {
  const n = Number(v ?? 0);
  return (
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
    " " +
    currency
  );
}

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
}

export function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  const date = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(dt);
  return `${date} ${time}`;
}

export function daysLabel(days: number | null) {
  if (days === null || days === undefined) return "—";
  if (days < 0) return `متأخر ${Math.abs(days)} يوم`;
  if (days === 0) return "ينتهي اليوم";
  return `${days} يوم`;
}

export function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function digitsOnly(phone: string | null | undefined) {
  return (phone ?? "").replace(/[^\d]/g, "");
}

/** Normalize UAE-style numbers for wa.me (05xxxxxxxx -> 9715xxxxxxxx). */
export function waNumber(phone: string | null | undefined) {
  let d = digitsOnly(phone);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "971" + d.slice(1);
  return d;
}
