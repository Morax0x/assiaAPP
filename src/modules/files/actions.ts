"use server";
import { requireAction } from "@/lib/auth";
import { safe, type Result } from "@/lib/action";
import { objectExists, presignUpload, storageMode } from "@/lib/storage";
import { isPg } from "@/lib/mode";

export type UploadTarget = { mode: "s3"; url: string; path: string } | { mode: "supabase"; path: string };

const okReadable = (k: string) => k.length > 0 && k.length <= 500 && !k.startsWith("/") && !k.includes("..") && !/[\\\u0000-\u001f]/.test(k) && !/^(receipts|expenses|healthcheck)\//.test(k);
function withSuffix(key: string, n: number) {
  const i = key.lastIndexOf("."), slash = key.lastIndexOf("/");
  return i > slash + 1 ? `${key.slice(0, i)} (${n})${key.slice(i)}` : `${key} (${n})`;
}

/**
 * Asks the server where the browser should upload a file. Only office staff with the right permission get a link.
 * In an S3 bucket the file is stored under a readable name (أفراد/اسم العميل/...) and an existing file is never overwritten.
 */
export async function getUploadTarget(path: string, contentType: string, readable?: string): Promise<Result<UploadTarget>> {
  return safe(async () => {
    const s = await requireAction();
    const okPrefix = /^(clients\/[0-9a-f-]{36}|receipts|expenses)\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/.test(path);
    if (!okPrefix) throw new Error("مسار الملف غير صالح");
    const allowed = path.startsWith("clients/") ? s.perms.has("docs.write") : s.perms.has("docs.write") || s.perms.has("treasury.write") || s.perms.has("txn.write");
    if (!allowed) throw new Error("لا تملك صلاحية رفع الملفات");
    if (isPg() && storageMode() !== "s3") throw new Error("تخزين الملفات غير مضبوط. أضف متغيرات S3_ في الإعدادات.");
    if (storageMode() === "s3") {
      let key = path;
      if (readable && path.startsWith("clients/")) {
        if (!okReadable(readable)) throw new Error("اسم الملف غير صالح");
        key = readable;
        for (let n = 2; n < 60 && (await objectExists(key)); n++) key = withSuffix(readable, n);
      }
      return { mode: "s3" as const, url: await presignUpload(key, contentType || "application/octet-stream"), path: key };
    }
    return { mode: "supabase" as const, path };
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
