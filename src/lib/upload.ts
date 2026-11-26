import { createClient } from "@/lib/supabase/client";
import { getUploadTarget } from "@/modules/files/actions";

/** Uploads a file to private storage (S3-compatible bucket, or Supabase if none is configured). Throws on failure. */
export async function uploadPrivate(path: string, file: Blob, contentType?: string) {
  const type = contentType || (file as File).type || "application/octet-stream";
  const t = await getUploadTarget(path, type);
  if (!t.ok) throw new Error(t.error);
  if (t.data!.mode === "s3") {
    const res = await fetch((t.data as { url: string }).url, { method: "PUT", body: file, headers: { "Content-Type": type } });
    if (!res.ok) throw new Error("فشل رفع الملف إلى التخزين");
    return;
  }
  const { error } = await createClient().storage.from("vault").upload(path, file, { contentType: type, upsert: false });
  if (error) throw new Error(error.message || "فشل رفع الملف");
}
