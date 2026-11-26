/** Human-readable storage names, so the bucket itself looks like your own folders (أفراد / شركات / كفلاء ...). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const KIND_FOLDER: Record<string, string> = { individual: "أفراد", company: "شركات", sponsor: "كفلاء" };
const BAD = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const clean = (s: string, max = 80) => s.replace(BAD, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, max);

export function cleanFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const b = clean(base, 120) || "ملف";
  return ext ? `${b}.${ext}` : b;
}

export function readableKey(o: { kind: string; name: string; parent?: string | null; folder?: string | null; fileName: string }) {
  const parts = [KIND_FOLDER[o.kind] ?? "عملاء"];
  if (o.parent) parts.push(clean(o.parent) || "شركة", "الموظفين", clean(o.name) || "موظف");
  else parts.push(clean(o.name) || "عميل");
  (o.folder ?? "").split("/").forEach((f) => { const c = clean(f); if (c) parts.push(c); });
  parts.push(cleanFileName(o.fileName));
  return parts.join("/");
}
