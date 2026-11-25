import type { Tone } from "@/components/ui/badge";

export const QUOTE_LABEL: Record<string, string> = { draft: "مسودة", sent: "أُرسل للعميل", accepted: "وافق العميل", rejected: "رفض العميل", expired: "انتهت صلاحيته" };
export const QUOTE_TONE: Record<string, Tone> = { draft: "mute", sent: "navy", accepted: "ok", rejected: "bad", expired: "warn" };
