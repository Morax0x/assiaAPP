"use client";
/**
 * Free, in-browser reading of a scanned document (no AI service, nothing is uploaded anywhere).
 * Suggests issue date, expiry date and the document type; the user always reviews them.
 */

export type OcrResult = { issue: string | null; expiry: string | null; text: string };

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const pad = (n: number) => String(n).padStart(2, "0");
const valid = (y: number, m: number, d: number) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

/** Every date that can be read from the text, as yyyy-mm-dd. */
export function findDates(raw: string): string[] {
  const t = raw.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  const out = new Set<string>();
  const add = (y: number, m: number, d: number) => { if (valid(y, m, d)) out.add(`${y}-${pad(m)}-${pad(d)}`); };
  for (const m of t.matchAll(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})/g)) add(+m[3], +m[2], +m[1]);
  for (const m of t.matchAll(/(\d{4})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/g)) add(+m[1], +m[2], +m[3]);
  for (const m of t.matchAll(/(\d{1,2})\s*[\/\-. ]\s*([A-Za-z]{3})[a-z]*\s*[\/\-. ,]*\s*(\d{4})/g)) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) add(+m[3], mo, +m[1]); }
  return [...out].sort();
}

/** Picks expiry (the latest date) and issue (the latest earlier date that is not in the future; birth dates lose to it). */
export function pickDates(dates: string[], today = new Date().toISOString().slice(0, 10)) {
  if (!dates.length) return { issue: null, expiry: null };
  const last = dates[dates.length - 1];
  // a lone date in the past is most likely the issue date, a lone future date the expiry
  if (dates.length === 1) return last <= today ? { issue: last, expiry: null } : { issue: null, expiry: last };
  const before = dates.filter((d) => d < last && d <= today);
  return { issue: before.length ? before[before.length - 1] : null, expiry: last };
}

/** Words that tell what kind of document it is; each maps to a piece of an Arabic type name to look for. */
const TYPE_HINTS: { re: RegExp; ar: string[] }[] = [
  { re: /emirates\s*id|identity\s*card|الهوية/i, ar: ["هوية"] },
  { re: /passport|جواز/i, ar: ["جواز"] },
  { re: /trade\s*licen|commercial\s*licen|رخصة|licen[sc]e/i, ar: ["رخصة"] },
  { re: /residen|visa|إقامة|اقامة|تأشيرة/i, ar: ["إقامة", "اقامة", "تأشيرة"] },
  { re: /insurance|تأمين|تامين/i, ar: ["تأمين", "تامين"] },
  { re: /tenan|ejari|lease|إيجار|ايجار/i, ar: ["إيجار", "ايجار", "عقد"] },
  { re: /labou?r|عمل/i, ar: ["عمل"] },
];

export function guessTypeId(text: string, types: { id: string; name: string }[]): string | null {
  for (const h of TYPE_HINTS) {
    if (!h.re.test(text)) continue;
    const hit = types.find((t) => h.ar.some((a) => t.name.includes(a)));
    if (hit) return hit.id;
  }
  return null;
}

async function pdfFirstPage(file: File): Promise<HTMLCanvasElement> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(2.5, 2000 / base.width) });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
  return canvas;
}

/** First page as a JPEG of at most ~1800px, small enough to send for reading. */
async function toJpeg(file: File): Promise<Blob> {
  let src: CanvasImageSource, w: number, h: number;
  if (file.type === "application/pdf") { const c = await pdfFirstPage(file); src = c; w = c.width; h = c.height; }
  else { const bmp = await createImageBitmap(file); src = bmp; w = bmp.width; h = bmp.height; }
  const k = Math.min(1, 1800 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("تعذر تجهيز الصورة"))), "image/jpeg", 0.85));
}

export type AiResult = { type: string | null; name: string | null; issue: string | null; expiry: string | null };

/** Reads the document with the server's vision model. Returns null when the office has not set it up (no key). */
export async function readDocumentAI(file: File, typeNames: string[]): Promise<AiResult | null> {
  const jpg = await toJpeg(file);
  const fd = new FormData();
  fd.append("file", new File([jpg], "page.jpg", { type: "image/jpeg" }));
  fd.append("types", typeNames.join("|"));
  const res = await fetch("/api/read-document", { method: "POST", body: fd });
  if (res.status === 501) return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || "تعذرت القراءة");
  return j as AiResult;
}

export async function readDocument(file: File, onProgress?: (p: number) => void): Promise<OcrResult> {
  const Tesseract = await import("tesseract.js");
  const input: File | HTMLCanvasElement = file.type === "application/pdf" ? await pdfFirstPage(file) : file;
  const worker = await Tesseract.createWorker(["eng", "ara"], 1, {
    logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") onProgress?.(m.progress); },
  });
  try {
    const { data } = await worker.recognize(input);
    const text = data.text ?? "";
    const { issue, expiry } = pickDates(findDates(text));
    return { issue, expiry, text };
  } finally {
    await worker.terminate();
  }
}
