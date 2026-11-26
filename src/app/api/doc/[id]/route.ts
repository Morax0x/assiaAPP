import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedDownload } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Streams a stored document to a signed-in staff member (same origin, so the in-page PDF viewer works on phones). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return new NextResponse("unauthorized", { status: 401 });
  if (!s.perms.has("docs.open")) return new NextResponse("forbidden", { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path,mime_type").eq("id", id).is("deleted_at", null).single();
  if (!doc) return new NextResponse("not found", { status: 404 });
  const upstream = await fetch(await signedDownload(doc.storage_path as string, { seconds: 60 }));
  if (!upstream.ok || !upstream.body) return new NextResponse("storage error", { status: 502 });
  return new NextResponse(upstream.body, { headers: { "Content-Type": (doc.mime_type as string) || "application/octet-stream", "Cache-Control": "private, no-store" } });
}
