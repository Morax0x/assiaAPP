export type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

export async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    // Let Next.js control-flow errors (redirect/notFound) pass through
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("[action-error]", e instanceof Error ? (e.stack ?? e.message) : JSON.stringify(e));
    const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "حدث خطأ غير متوقع";
    return { ok: false, error: translateError(msg) };
  }
}

function translateError(m: string) {
  if (m.includes("forbidden") || m.includes("row-level security")) return "لا تملك صلاحية لهذا الإجراء";
  if (m.includes("duplicate key")) return "السجل موجود مسبقاً";
  if (m.includes("violates foreign key")) return "لا يمكن التنفيذ لوجود سجلات مرتبطة";
  return m;
}

export function formObj(fd: FormData) {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") o[k] = v.trim();
  });
  return o;
}

export const emptyToNull = (v: string | undefined) => (v && v.length ? v : null);
