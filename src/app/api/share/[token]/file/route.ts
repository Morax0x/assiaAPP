import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveShare } from "@/lib/share-access";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(req.url);
  const docId = url.searchParams.get("doc");
  const wantDownload = url.searchParams.get("download") === "1";
  if (!docId) return new NextResponse("Bad request", { status: 400 });

  const r = await resolveShare(token);
  if (r.state !== "ok") return new NextResponse("Not found", { status: 404 });
  if (wantDownload && !r.link.allow_download) return new NextResponse("Forbidden", { status: 403 });
  // The document must be one of those the link exposes
  if (!r.docs.some((d) => d.id === docId)) return new NextResponse("Not found", { status: 404 });

  const admin = createAdminClient();
  const { data: doc } = await admin.from("documents").select("storage_path,title").eq("id", docId).single();
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const ext = doc.storage_path.split(".").pop() ?? "";
  const { data, error } = await admin.storage.from("vault").createSignedUrl(doc.storage_path, 60, wantDownload ? { download: `${doc.title}.${ext}` } : undefined);
  if (error || !data) return new NextResponse("Error", { status: 500 });
  return NextResponse.redirect(data.signedUrl, 302);
}
