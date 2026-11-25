import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ role: string }> }) {
  if (process.env.DEMO_MODE !== "1") return new NextResponse("Not found", { status: 404 });
  const { role } = await params;
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  if (["owner", "admin", "staff"].includes(role)) res.cookies.set("demo_role", role, { path: "/", maxAge: 86400 });
  return res;
}
