import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const { data, error } = await createAdminClient().storage.from("vault").createSignedUrl(path, seconds, opts.downloadName ? { download: opts.downloadName } : undefined);
  if (error || !data) throw new Error("تعذر إنشاء رابط الملف");
  return data.signedUrl;
}
