import { createClient } from "@/lib/supabase/client";
import { getUploadTarget } from "@/modules/files/actions";
import { reportError } from "@/lib/report-error";

function fail(msg: string, detail?: string): never {
  reportError("upload", msg, detail);
  throw new Error(msg);
}

/**
 * Uploads a file to private storage and returns the path it was stored under.
 * `readable` is the human-readable name (أفراد/اسم العميل/مجلد/ملف.pdf), used when the storage is an S3 bucket.
 */
export async function uploadPrivate(path: string, file: Blob, contentType?: string, readable?: string): Promise<string> {
  if (file.size === 0) fail("الملف فارغ (0 بايت) ولا يمكن رفعه", path);
  const type = contentType || (file as File).type || "application/octet-stream";
  const t = await getUploadTarget(path, type, readable);
  if (!t.ok) fail(t.error, "getUploadTarget");
  const target = t.data!;
  if (target.mode === "s3") {
    let res: Response;
    try {
      res = await fetch(target.url, { method: "PUT", body: file, headers: { "Content-Type": type } });
    } catch (e) {
      // The browser blocked the request: almost always the bucket's CORS rule.
      fail("تعذر الوصول إلى مخزن الملفات. غالباً قاعدة CORS في Cloudflare R2 ناقصة أو لا تحتوي عنوان موقعك بالضبط.", String(e));
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? String(res.status);
      const hint =
        code === "SignatureDoesNotMatch" ? "مفتاح الوصول أو المفتاح السري غير صحيح" :
        code === "AccessDenied" || res.status === 403 ? "صلاحية المفتاح لا تسمح بالكتابة على هذا الـ Bucket (يجب Object Read & Write)" :
        code === "NoSuchBucket" ? "اسم الـ Bucket خطأ" : "راجع إعدادات التخزين";
      fail(`فشل رفع الملف إلى المخزن (${code}): ${hint}`, body.slice(0, 600));
    }
    return target.path;
  }
  const { error } = await createClient().storage.from("vault").upload(target.path, file, { contentType: type, upsert: false });
  if (error) fail(error.message || "فشل رفع الملف", "supabase");
  return target.path;
}
