"use client";
import * as React from "react";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import { CheckCircle2, FolderUp, Loader2, RotateCcw, Square, TriangleAlert, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { CUSTOM_TYPE, type TypeOpt } from "@/components/documents/doc-type-picker";
import { createDocuments, ensureClient } from "@/modules/documents/actions";
import { uploadPrivate } from "@/lib/upload";
import { reportError } from "@/lib/report-error";
import { CLIENT_KIND_LABEL } from "@/lib/permissions";
import { MAX_FILE_BYTES, readableKey } from "@/lib/keys";

type ClientOpt = { id: string; name: string; kind: string };
type Kind = "individual" | "company" | "sponsor";
type Item = { file: File; rel: string[]; status: "wait" | "up" | "ok" | "err" | "skip"; note?: string; client?: string };
type Planned = Item & { kind?: Kind; clientName: string; employee: string; folder: string };

const MAX = MAX_FILE_BYTES;
const AUTO = "__auto__";
const JUNK = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\.gitkeep)$|^~\$|^\._/i;
const MIME: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", txt: "text/plain" };

const AR = "٠١٢٣٤٥٦٧٨٩";
const norm = (s: string) => s.replace(/[ً-ٰٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[٠-٩]/g, (d) => String(AR.indexOf(d))).toLowerCase();

const KIND_DIRS: Record<string, Kind> = { "افراد": "individual", "فرد": "individual", "شركات": "company", "شركه": "company", "كفلاء": "sponsor", "كفيل": "sponsor" };
const EMP_DIRS = new Set(["الموظفين", "موظفين", "الموظفون", "موظفون", "employees"]);
const kindOf = (d: string): Kind | undefined => KIND_DIRS[norm(d).trim()];

function guessType(text: string, types: TypeOpt[]): string | null {
  const t = norm(text);
  for (const ty of types) {
    const n = norm(ty.name);
    const first = n.split(" ")[0];
    if (n.length >= 3 && t.includes(n)) return ty.id;
    if (first.length >= 4 && t.includes(first.slice(0, Math.max(3, first.length - 1)))) return ty.id;
  }
  return null;
}

async function pool<T>(items: T[], size: number, fn: (x: T, i: number) => Promise<void>, stop: () => boolean) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length && !stop()) { const i = next++; await fn(items[i], i); }
  }));
}

export function BulkImport({ clients, types }: { clients: ClientOpt[]; types: TypeOpt[] }) {
  const [mode, setMode] = React.useState<"kinds" | "one" | "per">("kinds");
  const [clientId, setClientId] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newKind, setNewKind] = React.useState<"individual" | "company" | "sponsor">("company");
  const [perKind, setPerKind] = React.useState<"individual" | "company" | "sponsor">("company");
  const [tag, setTag] = React.useState("");
  const [typeId, setTypeId] = React.useState(AUTO);
  const [customType, setCustomType] = React.useState("");
  const [items, setItems] = React.useState<Item[]>([]);
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const stopRef = React.useRef(false);

  const dirRef = React.useRef<HTMLInputElement>(null);
  const filesRef = React.useRef<HTMLInputElement>(null);

  function pick(list: FileList | null) {
    if (!list?.length) return;
    const arr: Item[] = [];
    for (const f of Array.from(list)) {
      if (JUNK.test(f.name)) continue;
      const rel = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).split("/");
      const bad = f.size === 0 ? "ملف فارغ (0 بايت)" : f.size > MAX ? "أكبر من 25 ميغابايت" : undefined;
      arr.push({ file: f, rel, status: bad ? "skip" : "wait", note: bad });
    }
    setItems(arr); setDone(false);
    const root = arr[0]?.rel.length > 1 ? arr[0].rel[0] : "";
    if (root && !tag && mode !== "kinds") setTag(root);
  }

  // Where each file goes: folder inside the client file, and (in per-client mode) which client
  const plan: Planned[] = React.useMemo(() => items.map((it) => {
    const dirs = it.rel.slice(0, -1);
    if (mode === "kinds") {
      const ki = dirs.findIndex((d) => kindOf(d));
      if (ki < 0) return { ...it, clientName: "", employee: "", folder: "" };
      const kind = kindOf(dirs[ki])!;
      const clientName = dirs[ki + 1] ?? "";
      let rest = dirs.slice(ki + 2), employee = "";
      if (kind === "company" && rest.length >= 2 && EMP_DIRS.has(norm(rest[0]).trim())) { employee = rest[1]; rest = rest.slice(2); }
      return { ...it, kind, clientName, employee, folder: rest.join("/") };
    }
    if (mode === "per") {
      const client = dirs.length >= 2 ? dirs[1] : "";
      return { ...it, kind: perKind, clientName: client, employee: "", folder: dirs.slice(2).join("/") };
    }
    return { ...it, clientName: "", employee: "", folder: dirs.slice(1).join("/") };
  }), [items, mode, perKind]);

  const usable = plan.filter((p) => p.status !== "skip" && (mode === "one" || p.clientName));
  const perClients = [...new Set(plan.filter((p) => p.clientName).map((p) => `${p.kind}|${p.clientName}`))];
  const employeeCount = new Set(plan.filter((p) => p.employee).map((p) => `${p.clientName}|${p.employee}`)).size;
  const skippedNoClient = mode !== "one" ? plan.filter((p) => !p.clientName && p.status !== "skip").length : 0;
  const totalMB = usable.reduce((a, p) => a + p.file.size, 0) / 1048576;
  const okCount = items.filter((i) => i.status === "ok").length;
  const errCount = items.filter((i) => i.status === "err").length;

  const ready = usable.length > 0 && (mode !== "one" || clientId || newName.trim().length >= 2) && (typeId !== CUSTOM_TYPE || customType.trim().length >= 2);

  async function run(onlyFailed = false) {
    stopRef.current = false; setRunning(true); setDone(false);
    try {
      // 1) who are the clients?
      let single = clientId;
      if (mode === "one" && !single) {
        const r = await ensureClient(newName, newKind);
        if (!r.ok || !r.data) throw new Error(r.ok ? "تعذر إنشاء العميل" : r.error);
        single = r.data.id;
        if (r.data.created) toast.success(`أُنشئ العميل «${newName.trim()}»`);
      }
      const cache = new Map<string, { id: string; kind: Kind; name: string; parent?: string }>();
      if (mode !== "one") {
        for (const p of plan) {
          if (!p.clientName || !p.kind) continue;
          const key = `${p.kind}|${p.clientName}`;
          if (!cache.has(key)) {
            const known = clients.find((c) => norm(c.name) === norm(p.clientName));
            if (known) cache.set(key, { id: known.id, kind: p.kind, name: p.clientName });
            else {
              const r = await ensureClient(p.clientName, p.kind);
              if (!r.ok || !r.data) throw new Error(`تعذر إنشاء «${p.clientName}»: ${r.ok ? "" : r.error}`);
              cache.set(key, { id: r.data.id, kind: p.kind, name: p.clientName });
            }
          }
          if (p.employee) {
            const ek = `${key}|${p.employee}`;
            if (!cache.has(ek)) {
              const parent = cache.get(key)!;
              const r = await ensureClient(p.employee, "individual", parent.id);
              if (!r.ok || !r.data) throw new Error(`تعذر إنشاء الموظف «${p.employee}»: ${r.ok ? "" : r.error}`);
              cache.set(ek, { id: r.data.id, kind: "individual", name: p.employee, parent: p.clientName });
            }
          }
        }
      }
      const oneKind = (clients.find((c) => c.id === single)?.kind ?? newKind) as Kind;
      const fallbackType = types.find((t) => norm(t.name) === norm("أخرى"))?.id ?? types[types.length - 1]?.id ?? types[0]?.id;
      const todo = plan.map((p, i) => ({ p, i })).filter(({ p }) => (onlyFailed ? p.status === "err" : p.status === "wait" || p.status === "err") && (mode === "one" || p.clientName));
      const set = (i: number, patch: Partial<Item>) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, ...patch } : x)));
      const rows: Parameters<typeof createDocuments>[0] = [];
      const rowIdx: number[] = [];
      const flush = async () => {
        if (!rows.length) return;
        const batch = rows.splice(0), idxs = rowIdx.splice(0);
        const r = await createDocuments(batch);
        if (!r.ok) idxs.forEach((i) => set(i, { status: "err", note: r.error }));
        else idxs.forEach((i) => set(i, { status: "ok", note: undefined }));
      };

      await pool(todo, 4, async ({ p, i }) => {
        set(i, { status: "up", note: undefined });
        try {
          const owner: { id: string; kind: Kind; name: string; parent?: string } = mode === "one"
            ? { id: single, kind: oneKind, name: clients.find((c) => c.id === single)?.name ?? newName.trim() }
            : cache.get(p.employee ? `${p.kind}|${p.clientName}|${p.employee}` : `${p.kind}|${p.clientName}`)!;
          const cid = owner.id;
          const ext = (p.file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
          const mime = p.file.type || MIME[ext] || "application/octet-stream";
          let blob: Blob = p.file;
          if (mime.startsWith("image/") && mime !== "image/gif" && mime !== "image/heic") {
            try { blob = await imageCompression(p.file, { maxSizeMB: 0.9, maxWidthOrHeight: 1800, useWebWorker: true, initialQuality: 0.8 }); } catch { /* keep original */ }
          }
          if (blob.size === 0) throw new Error("ملف فارغ (0 بايت)");
          if (blob.size > MAX) throw new Error("أكبر من 25 ميغابايت");
          const path = `clients/${cid}/${crypto.randomUUID()}.${ext}`;
          const readable = readableKey({ kind: owner.kind, name: owner.name, parent: owner.parent, folder: p.folder, fileName: p.file.name });
          const stored = await uploadPrivate(path, blob, mime, readable);
          const title = p.file.name.replace(/\.[^.]+$/, "") || p.file.name;
          const tid = typeId === AUTO ? guessType(`${p.folder} ${title}`, types) ?? fallbackType : typeId === CUSTOM_TYPE ? null : typeId;
          rows.push({
            client_id: cid, type_id: tid, custom_type: typeId === CUSTOM_TYPE ? customType : null, title, folder: p.folder || null, tag: tag.trim() || null,
            storage_path: stored, mime_type: mime, size_bytes: blob.size,
          });
          rowIdx.push(i);
          if (rows.length >= 10) await flush();
        } catch (e) {
          set(i, { status: "err", note: e instanceof Error ? e.message : "فشل" });
        }
      }, () => stopRef.current);
      await flush();
      setDone(true);
    } catch (e) {
      const m = e instanceof Error ? e.message : "تعذر بدء الرفع";
      reportError("bulk-import", m);
      toast.error(m);
    } finally { setRunning(false); }
  }

  const pct = items.length ? Math.round(((okCount + errCount + items.filter((i) => i.status === "skip").length) / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="1) إلى أين تذهب الملفات؟" />
        <div className="space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {([["kinds", "ترتيبي الحالي (أفراد / شركات / كفلاء)", "اختر مجلد الأرشيف الذي فيه أفراد وشركات وكفلاء، أو أحدها فقط. تُنشأ الملفات والمجلدات بنفس الأسماء والترتيب، وموظفو الشركة من مجلد «الموظفين»."], ["one", "كل الملفات لعميل واحد", "مثل: كل أوراق شركة معينة. تبقى مجلداتها الداخلية كما هي."], ["per", "كل مجلد في المستوى الأول = عميل", "مجلد رئيسي فيه مجلد لكل عميل أو شركة. تُنشأ ملفاتهم تلقائياً بأسماء المجلدات."]] as const).map(([k, t, d]) => (
              <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-card border p-3 text-start ${mode === k ? "border-navy bg-navy-soft" : "border-line hover:bg-bg"}`}>
                <div className="text-[15px] font-semibold">{t}</div><div className="mt-1 text-sm text-ink-3">{d}</div>
              </button>
            ))}
          </div>
          {mode === "kinds" ? (
            <p className="rounded-card bg-bg p-3 text-sm leading-7 text-ink-2">
              البنية المتوقعة: <b>أفراد ‹ اسم العميل ‹ (مجلدات) ‹ ملفات</b> و<b>شركات ‹ اسم الشركة ‹ الموظفين ‹ اسم الموظف ‹ ملفات</b> و<b>كفلاء ‹ اسم الكفيل ‹ ملفات</b>. ارفع كل مجلد رئيسي على حدة أو الأرشيف كله مرة واحدة.
            </p>
          ) : mode === "one" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="العميل / الشركة">
                <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">＋ إنشاء ملف جديد (اكتب اسمه)</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({CLIENT_KIND_LABEL[c.kind] ?? ""})</option>)}
                </Select>
              </Field>
              {!clientId && (
                <>
                  <Field label="اسم الملف الجديد"><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثال: شركة النور للتجارة" /></Field>
                  <Field label="نوعه"><Select value={newKind} onChange={(e) => setNewKind(e.target.value as typeof newKind)}><option value="company">شركة</option><option value="individual">فرد</option><option value="sponsor">كفيل</option></Select></Field>
                </>
              )}
            </div>
          ) : (
            <Field label="نوع العملاء الذين سيُنشؤون من أسماء المجلدات" hint="إن وُجد عميل بنفس الاسم تُضاف الملفات إلى ملفه">
              <Select value={perKind} onChange={(e) => setPerKind(e.target.value as typeof perKind)}><option value="company">شركات</option><option value="individual">أفراد</option><option value="sponsor">كفلاء</option></Select>
            </Field>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="2) اختر المجلد أو الملفات" />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" onClick={() => dirRef.current?.click()} disabled={running}><FolderUp /> اختيار مجلد كامل</Button>
            <Button type="button" size="lg" variant="outline" onClick={() => filesRef.current?.click()} disabled={running}><Upload /> اختيار ملفات</Button>
          </div>
          <input ref={dirRef} type="file" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
          <input ref={filesRef} type="file" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          {items.length > 0 && (
            <div className="rounded-card bg-bg p-3 text-[15px] leading-7">
              <b className="num">{usable.length}</b> ملف جاهز ({totalMB.toFixed(1)} ميغابايت)
              {mode !== "one" && <> · <b className="num">{perClients.length}</b> ملف عميل{employeeCount > 0 && <> و<b className="num">{employeeCount}</b> موظف</>}: {perClients.slice(0, 4).map((k) => k.split("|")[1]).join("، ")}{perClients.length > 4 ? "…" : ""}</>}
              {items.some((i) => i.status === "skip") && <div className="text-warn">{items.filter((i) => i.status === "skip").length} ملف فارغ أو أكبر من 25 ميغابايت سيُتخطى</div>}
              {skippedNoClient > 0 && <div className="text-warn">{skippedNoClient} ملف خارج مجلد عميل (أو خارج أفراد/شركات/كفلاء) سيُتخطى</div>}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="3) التصنيف والنوع" />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="التصنيف / المكان (يُوضع على كل الملفات)" hint="مثال: فرع عجمان، أرشيف 2024، العملاء القدامى. تستطيع الفلترة به لاحقاً.">
            <Input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={80} placeholder="اختياري" />
          </Field>
          <Field label="نوع المستندات">
            <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value={AUTO}>تلقائي (من اسم الملف أو المجلد، وإلا «أخرى»)</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name} للجميع</option>)}
              <option value={CUSTOM_TYPE}>＋ نوع آخر (أكتب اسمه)</option>
            </Select>
          </Field>
          {typeId === CUSTOM_TYPE && <Field label="اسم النوع الجديد"><Input value={customType} onChange={(e) => setCustomType(e.target.value)} maxLength={60} /></Field>}
        </div>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader title="4) الرفع" action={running ? <Button size="sm" variant="danger" onClick={() => { stopRef.current = true; }}><Square /> إيقاف</Button> : undefined} />
          <div className="space-y-3 p-4">
            <div className="h-3 overflow-hidden rounded-full bg-mute-soft"><div className="h-full bg-navy transition-all" style={{ width: `${pct}%` }} /></div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
              <span className="text-ok">تم: <b className="num">{okCount}</b></span>
              <span className="text-bad">فشل: <b className="num">{errCount}</b></span>
              <span>الكل: <b className="num">{items.length}</b></span>
            </div>
            <div className="flex flex-wrap gap-2">
              {!running && !done && <Button size="lg" variant="accent" disabled={!ready} onClick={() => run(false)}><Upload /> ابدأ رفع {usable.length} ملف</Button>}
              {!running && errCount > 0 && <Button variant="outline" onClick={() => run(true)}><RotateCcw /> إعادة محاولة الفاشلة ({errCount})</Button>}
              {done && errCount === 0 && <Button asChild size="lg"><Link href="/documents">تم. اذهب إلى المستندات</Link></Button>}
              {running && <span className="flex items-center gap-2 text-sm text-ink-3"><Loader2 className="size-4 animate-spin" /> لا تغلق الصفحة حتى ينتهي الرفع</span>}
            </div>
            {!ready && !running && !done && <p className="text-sm text-warn">أكمل الخطوة 1 (العميل) ليبدأ الرفع.</p>}
            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-card border border-line text-sm">
              {plan.slice(0, 300).map((p, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-2">
                  {p.status === "ok" ? <CheckCircle2 className="size-4 shrink-0 text-ok" /> : p.status === "err" ? <XCircle className="size-4 shrink-0 text-bad" /> : p.status === "skip" ? <TriangleAlert className="size-4 shrink-0 text-warn" /> : p.status === "up" ? <Loader2 className="size-4 shrink-0 animate-spin text-navy" /> : <span className="size-4 shrink-0 rounded-full border border-line-strong" />}
                  <span className="min-w-0 flex-1 truncate" dir="auto">{p.clientName ? `${p.clientName} › ` : ""}{p.employee ? `الموظفين › ${p.employee} › ` : ""}{p.folder ? `${p.folder} › ` : ""}{p.file.name}</span>
                  {p.note && <span className="max-w-[45%] truncate text-xs text-bad">{p.note}</span>}
                </li>
              ))}
              {plan.length > 300 && <li className="px-3 py-2 text-center text-xs text-ink-3">… و{plan.length - 300} ملف آخر</li>}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}
