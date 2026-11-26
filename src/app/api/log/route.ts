import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Browser errors (failed uploads, crashes) are written to the server log so they show up in Railway. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return new NextResponse(null, { status: 204 });
  try {
    const b = (await req.json()) as { where?: string; message?: string; detail?: string };
    console.error("[client-error]", JSON.stringify({ user: s.profile.full_name, where: String(b.where ?? "").slice(0, 80), message: String(b.message ?? "").slice(0, 500), detail: String(b.detail ?? "").slice(0, 800) }));
  } catch { /* ignore malformed reports */ }
  return new NextResponse(null, { status: 204 });
}
