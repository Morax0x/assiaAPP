import "server-only";
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPg } from "@/lib/mode";

/**
 * File storage. If the S3_* variables are set, files live in any S3-compatible bucket
 * (Cloudflare R2, Backblaze B2, ...), which is free for the first ~10 GB.
 * Otherwise files live in the Supabase "vault" bucket. Files are always private:
 * they are only ever opened through short-lived signed links created here, on the server.
 */
const env = () => ({
  endpoint: process.env.S3_ENDPOINT, bucket: process.env.S3_BUCKET,
  key: process.env.S3_ACCESS_KEY_ID, secret: process.env.S3_SECRET_ACCESS_KEY, region: process.env.S3_REGION || "auto",
});

export function storageMode(): "s3" | "supabase" {
  const e = env();
  return process.env.DEMO_MODE !== "1" && e.endpoint && e.bucket && e.key && e.secret ? "s3" : "supabase";
}

let client: S3Client | null = null;
function s3() {
  const e = env();
  client ??= new S3Client({
    region: e.region, endpoint: e.endpoint, forcePathStyle: true,
    credentials: { accessKeyId: e.key!, secretAccessKey: e.secret! },
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

/** Link the browser uses to upload one file directly to storage (S3 mode only). */
export async function presignUpload(path: string, contentType: string) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: env().bucket, Key: path, ContentType: contentType }), { expiresIn: 300 });
}

/** Short-lived link to view or download a stored file. */
export async function signedDownload(path: string, opts: { seconds?: number; downloadName?: string } = {}): Promise<string> {
  const seconds = opts.seconds ?? 120;
  if (storageMode() === "s3") {
    return getSignedUrl(
      s3(),
      new GetObjectCommand({
        Bucket: env().bucket, Key: path,
        ResponseContentDisposition: opts.downloadName ? `attachment; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}` : undefined,
      }),
      { expiresIn: seconds },
    );
  }
  if (isPg()) throw new Error("تخزين الملفات غير مضبوط. أضف متغيرات S3_ في الإعدادات.");
  const { data, error } = await createAdminClient().storage.from("vault").createSignedUrl(path, seconds, opts.downloadName ? { download: opts.downloadName } : undefined);
  if (error || !data) throw new Error("تعذر إنشاء رابط الملف");
  return data.signedUrl;
}

/** Server-side check of endpoint, bucket and keys (cannot check the browser's CORS rule). */
export async function storageSelfTest() {
  const out: { name: string; ok: boolean; note?: string }[] = [];
  const key = `healthcheck/${crypto.randomUUID()}.txt`;
  const e = env();
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try { await fn(); out.push({ name, ok: true }); return true; }
    catch (err) {
      const x = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
      out.push({ name, ok: false, note: `${x.name ?? "Error"} (${x.$metadata?.httpStatusCode ?? "?"}): ${x.message ?? ""}`.slice(0, 300) });
      return false;
    }
  };
  if (!(await step("كتابة ملف تجريبي", () => s3().send(new PutObjectCommand({ Bucket: e.bucket, Key: key, Body: "ok", ContentType: "text/plain" }))))) return out;
  await step("قراءة الملف", async () => { const r = await s3().send(new GetObjectCommand({ Bucket: e.bucket, Key: key })); await r.Body?.transformToString(); });
  await step("حذف الملف التجريبي", () => s3().send(new DeleteObjectCommand({ Bucket: e.bucket, Key: key })));
  return out;
}

/** True if an object already exists under this key (so we never overwrite someone's file). */
export async function objectExists(key: string): Promise<boolean> {
  try { await s3().send(new HeadObjectCommand({ Bucket: env().bucket, Key: key })); return true; }
  catch (e) {
    const x = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (x.name === "NotFound" || x.$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}

/** Deletes stored files (S3 bucket or Supabase vault). Returns how many were requested. */
export async function deleteStoredFiles(keys: string[]): Promise<number> {
  const list = [...new Set(keys.filter(Boolean))];
  if (storageMode() === "s3") {
    for (let i = 0; i < list.length; i += 1000) {
      await s3().send(new DeleteObjectsCommand({ Bucket: env().bucket, Delete: { Objects: list.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
    }
  } else if (!isPg()) {
    for (let i = 0; i < list.length; i += 100) await createAdminClient().storage.from("vault").remove(list.slice(i, i + 100));
  }
  return list.length;
}
