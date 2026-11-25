import { NextResponse } from "next/server";
import { runAlertsJob } from "@/lib/alerts-job";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json(await runAlertsJob());
}
export const GET = handle;
export const POST = handle;
