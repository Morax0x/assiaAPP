import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const s = Math.min(Math.max(parseInt(size) || 192, 48), 1024);
  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const pad = maskable ? s * 0.2 : s * 0.12;
  const inner = Math.round(s - pad * 2);
  const buf = await readFile(path.join(process.cwd(), "public", "logo.png"));
  const src = `data:image/png;base64,${buf.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={inner} height={inner} style={{ objectFit: "contain" }} alt="" />
      </div>
    ),
    { width: s, height: s },
  );
}
