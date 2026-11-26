"use server";
import { requireAction } from "@/lib/auth";
import { safe, type Result } from "@/lib/action";
import { presignUpload, storageMode } from "@/lib/storage";
import { isPg } from "@/lib/mode";

export type UploadTarget = { mode: "s3"; url: string } | { mode: "supabase" };

/** Asks the server where the browser should upload a file. Only office staff with the right permission get a link. */
export async function getUploadTarget(path: string, contentType: string): Promise<Result<UploadTarget>> {
  return safe(async () => {
    const s = await requireAction();
    const okPrefix = /^(clients\/[0-9a-f-]{36}|receipts|expenses)\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/.test(path);
    if (!okPrefix) throw new Error("مسار الملف غير صالح");
    const allowed = path.startsWith("clients/") ? s.perms.has("docs.write") : s.perms.has("docs.write") || s.perms.has("treasury.write") || s.perms.has("txn.write");
    if (!allowed) throw new Error("لا تملك صلاحية رفع الملفات");
    if (isPg() && storageMode() !== "s3") throw new Error("تخزين الملفات غير مضبوط. أضف متغيرات S3_ في الإعدادات.");
    if (storageMode() === "s3") return { mode: "s3" as const, url: await presignUpload(path, contentType || "application/octet-stream") };
    return { mode: "supabase" as const };
  });
}

/** Writes, reads and deletes a tiny test file to check the storage settings. Owner only. */
export async function testStorage(): Promise<Result<{ steps: { name: string; ok: boolean; note?: string }[] }>> {
  return safe(async () => {
    const s = await requireAction("settings.manage");
    if (s.profile.role !== "owner") throw new Error("للمالك فقط");
    const steps: { name: string; ok: boolean; note?: string }[] = [];
    if (storageMode() !== "s3") {
      steps.push({ name: "متغيرات S3", ok: false, note: "غير مضبوطة: S3_ENDPOINT و S3_BUCKET و S3_ACCESS_KEY_ID و S3_SECRET_ACCESS_KEY" });
      return { steps };
    }
    steps.push({ name: "متغيرات S3", ok: true });
    const { storageSelfTest } = await import("@/lib/storage");
    const r = await storageSelfTest();
    console.log("[storage-test]", JSON.stringify(r));
    return { steps: [...steps, ...r] };
  });
}
