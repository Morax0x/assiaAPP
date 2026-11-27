import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API = "https://generativelanguage.googleapis.com/v1beta";
let cached: { names: string[]; at: number } | null = null;

/**
 * The usable Gemini models for this key, best first: newest "flash", then "flash-lite" (usually less busy), then the "latest" alias.
 * Asked from Google itself so a retired model name never needs a code or settings change. GEMINI_MODEL goes first if set.
 */
async function modelList(key: string, refresh = false): Promise<string[]> {
  let names = !refresh && cached && Date.now() - cached.at < 6 * 3600_000 ? cached.names : null;
  if (!names) {
    names = [];
    try {
      const r = await fetch(`${API}/models?pageSize=200`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15_000) });
      if (r.ok) {
        const j = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
        const ids = (j.models ?? []).filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m) => m.name.replace(/^models\//, ""));
        const pick = (re: RegExp) => ids.map((id) => ({ id, v: re.exec(id) })).filter((m) => m.v).sort((x, y) => parseFloat(y.v![1]) - parseFloat(x.v![1])).map((m) => m.id);
        names = [...pick(/^gemini-(\d+(?:\.\d+)?)-flash$/), ...pick(/^gemini-(\d+(?:\.\d+)?)-flash-lite$/)].slice(0, 4);
      }
    } catch { /* use the alias below */ }
    names = [...names, "gemini-flash-latest"];
    cached = { names, at: Date.now() };
  }
  const env = process.env.GEMINI_MODEL;
  return env && !refresh ? [env, ...names] : names;
}
const OK_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const DATE = /^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const clean = (v: unknown) => (typeof v === "string" && DATE.test(v) ? v : null);

/**
 * Reads a scanned document with Google's Gemini vision model (free tier key) and returns the type, holder name and dates.
 * The page sends one JPEG/PNG of the first page (PDFs are rendered to an image in the browser first).
 * Without GEMINI_API_KEY it answers 501 and the page falls back to the local reader.
 */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return new NextResponse("unauthorized", { status: 401 });
  if (!s.perms.has("docs.write")) return new NextResponse("forbidden", { status: 403 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "no_key" }, { status: 501 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const file = form.get("file");
  const types = String(form.get("types") ?? "").split("|").map((x) => x.trim()).filter(Boolean).slice(0, 60);
  if (!(file instanceof File) || !OK_MIME.has(file.type)) return NextResponse.json({ error: "unsupported" }, { status: 400 });
  if (file.size > 4_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  const prompt = [
    "You read scanned official documents (UAE: Emirates ID, passport, residence visa, trade licence, insurance, tenancy contract, labour card, etc.).",
    "Extract exactly what is printed. Never guess or compute a value that is not visible; use null instead.",
    "- document_type: choose the single best match from this list, or null if none fits: " + (types.length ? types.join(" | ") : "(no list)"),
    "- holder_name: the person or company the document belongs to, as printed (prefer the Arabic or English name that is clearest).",
    "- issue_date: the issue / issuing date (not birth date).",
    "- expiry_date: the expiry / valid-until date.",
    "Dates must be returned as YYYY-MM-DD. UAE documents print dates as DD/MM/YYYY.",
  ].join("\n");

  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: file.type, data } }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          document_type: { type: "STRING", nullable: true },
          holder_name: { type: "STRING", nullable: true },
          issue_date: { type: "STRING", nullable: true },
          expiry_date: { type: "STRING", nullable: true },
        },
        required: ["document_type", "holder_name", "issue_date", "expiry_date"],
      },
    },
  };

  const call = (model: string) => fetch(`${API}/models/${model}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  let res: Response | null = null;
  try {
    let models = await modelList(key);
    let refreshed = false;
    for (let i = 0; i < models.length && i < 6; i++) {
      res = await call(models[i]);
      if (res.ok) break;
      if (res.status === 404 && !refreshed) { refreshed = true; models = await modelList(key, true); i = -1; continue; } // retired: look up the current ones
      if ([404, 429, 500, 503].includes(res.status)) { await new Promise((r) => setTimeout(r, 700)); continue; } // busy: try the next model
      break;
    }
  } catch { /* handled below */ }
  if (!res) return NextResponse.json({ error: "تعذر الاتصال بخدمة القراءة" }, { status: 502 });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("[read-document]", res.status, t.slice(0, 300));
    const msg = res.status === 429 ? "تجاوزت حد القراءة المجاني مؤقتاً، حاول بعد دقيقة" : res.status === 503 ? "خدمة القراءة مشغولة الآن، أعد المحاولة بعد لحظات" : res.status === 400 || res.status === 403 ? "مفتاح القراءة غير صالح أو الطلب مرفوض" : "تعذرت القراءة";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  try {
    const j = await res.json();
    const text: string = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const o = JSON.parse(text) as Record<string, unknown>;
    const type = typeof o.document_type === "string" && types.includes(o.document_type) ? o.document_type : null;
    const name = typeof o.holder_name === "string" && o.holder_name.trim() ? o.holder_name.trim().slice(0, 150) : null;
    return NextResponse.json({ type, name, issue: clean(o.issue_date), expiry: clean(o.expiry_date) });
  } catch {
    return NextResponse.json({ error: "تعذرت قراءة الرد" }, { status: 502 });
  }
}
