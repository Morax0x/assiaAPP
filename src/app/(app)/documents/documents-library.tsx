"use client";
import * as React from "react";
import Link from "next/link";
import { Building2, Check, ChevronLeft, ChevronRight, FileText, Folder, FolderOpen, Image as ImageIcon, Search, Handshake, LayoutGrid, List as ListIcon, SlidersHorizontal, Table2, Trash2, User, Users, X } from "lucide-react";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { Card, Empty } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteDocuments } from "@/modules/documents/actions";
import { DocumentPreviewButton } from "@/components/documents/document-preview";
import { DocumentEditDialog } from "@/components/documents/document-edit-dialog";
import { MoveDocumentsDialog, type MoveTarget } from "@/components/documents/move-documents-dialog";
import { BUCKET_LABEL } from "@/lib/permissions";
import { daysLabel, fmtDate } from "@/lib/utils";

export type LibDoc = {
  id: string; client_id: string; transaction_id: string | null; title: string; issue_date: string | null; expiry_date: string | null;
  mime_type: string; size_bytes: number; created_at: string; type_id: string; type_name: string; client_name: string; client_kind: string;
  client_parent_id: string | null; folder: string | null; tag: string | null; txn_ref: string | null;
};

function bucket(expiry: string | null, critical: number) {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  return { days, key: days < 0 ? "expired" : days <= critical ? "critical" : days <= 90 ? "upcoming" : "valid" };
}
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const KINDS = [
  { key: "individual", label: "أفراد", icon: User },
  { key: "company", label: "شركات", icon: Building2 },
  { key: "sponsor", label: "كفلاء", icon: Handshake },
] as const;
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const norm = (s: string) => s.replace(/[ً-ٰٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).toLowerCase();
const KIND_LABEL: Record<string, string> = { individual: "أفراد", company: "شركات", sponsor: "كفلاء" };

/** Location in the folder tree. Parts: "k:<kind>", "c:<clientId>", "e" (the employees folder of a company), "d:<folder name>". */
type Loc = string[];

function FolderTile({ icon: Icon, name, count, alert, dim, hint, onClick, sel }: { icon: typeof Folder; name: string; hint?: string; sel?: { on: boolean; toggle: () => void }; count: number; alert?: { expired: number; critical: number }; dim?: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={sel ? sel.toggle : onClick}
      className={`group flex min-h-[72px] items-center gap-3 rounded-card border bg-surface p-3 text-start shadow-sm transition hover:border-navy/40 hover:shadow-md ${sel?.on ? "border-navy bg-navy-soft" : "border-line"} ${dim ? "opacity-60" : ""}`}
    >
      {sel && <span className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${sel.on ? "border-navy bg-navy text-white" : "border-line-strong bg-surface"}`}>{sel.on && <Check className="size-4" strokeWidth={3} />}</span>}
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-soft text-navy"><Icon className="size-6" strokeWidth={1.6} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold" dir="auto">{name}</span>
        {hint && <span className="block truncate text-xs text-ink-3" dir="auto">{hint}</span>}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
          <span><b className="num">{count}</b> مستند</span>
          {alert && alert.expired > 0 && <span className="font-medium text-bad"><span className="num">{alert.expired}</span> منتهي</span>}
          {alert && alert.critical > 0 && <span className="font-medium text-warn"><span className="num">{alert.critical}</span> قارب</span>}
        </span>
      </span>
      {!sel && <ChevronLeft className="size-4 shrink-0 text-ink-3 transition group-hover:-translate-x-0.5 rtl:rotate-0" strokeWidth={1.75} />}
    </button>
  );
}

export function DocumentsLibrary({
  docs, types, critical, canWrite, canMove, canOpen, canDelete, moveTargets,
}: { docs: LibDoc[]; types: { id: string; name: string }[]; critical: number; canWrite: boolean; canMove: boolean; canOpen: boolean; canDelete: boolean; moveTargets: MoveTarget[] }) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [panel, setPanel] = React.useState(false);
  const [wide, setWide] = React.useState(false);
  const [selecting, setSelecting] = React.useState(false);
  const [pickedDocs, setPickedDocs] = React.useState<Set<string>>(new Set());
  const [pickedFolders, setPickedFolders] = React.useState<Map<string, string[]>>(new Map());
  const allPicked = React.useMemo(() => { const s = new Set(pickedDocs); pickedFolders.forEach((ids) => ids.forEach((i) => s.add(i))); return s; }, [pickedDocs, pickedFolders]);
  const stopSelecting = () => { setSelecting(false); setPickedDocs(new Set()); setPickedFolders(new Map()); };
  const toggleDoc = (id: string) => setPickedDocs((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const folderSel = (key: string, ids: string[]) => selecting ? { on: pickedFolders.has(key), toggle: () => setPickedFolders((m) => { const n = new Map(m); if (n.has(key)) n.delete(key); else n.set(key, ids); return n; }) } : undefined;
  const docBox = (id: string) => selecting ? (
    <button type="button" onClick={() => toggleDoc(id)} aria-label="تحديد" className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${pickedDocs.has(id) || allPicked.has(id) ? "border-navy bg-navy text-white" : "border-line-strong bg-surface"}`}>{(pickedDocs.has(id) || allPicked.has(id)) && <Check className="size-4" strokeWidth={3} />}</button>
  ) : null;
  const [view, setView] = React.useState<"cards" | "list" | "table">("cards");
  React.useEffect(() => { try { const v = localStorage.getItem("docview"); if (v === "cards" || v === "list" || v === "table") setView(v); } catch { /* ignore */ } }, []);
  const chooseView = (v: "cards" | "list" | "table") => { setView(v); try { localStorage.setItem("docview", v); } catch { /* ignore */ } };
  const [loc, setLoc] = React.useState<Loc>([]);

  const tags = React.useMemo(() => [...new Set(docs.map((d) => d.tag).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "ar")), [docs]);
  const clientById = React.useMemo(() => new Map(moveTargets.map((t) => [t.id, t])), [moveTargets]);
  const byClient = React.useMemo(() => {
    const m = new Map<string, LibDoc[]>();
    docs.forEach((d) => { const a = m.get(d.client_id); if (a) a.push(d); else m.set(d.client_id, [d]); });
    return m;
  }, [docs]);
  const employeesOf = React.useMemo(() => {
    const m = new Map<string, MoveTarget[]>();
    moveTargets.forEach((t) => { if (t.parent_id) { const a = m.get(t.parent_id); if (a) a.push(t); else m.set(t.parent_id, [t]); } });
    return m;
  }, [moveTargets]);

  /** Documents inside a client folder, including its employees' folders. */
  const allOf = React.useCallback((clientId: string) => [...(byClient.get(clientId) ?? []), ...(employeesOf.get(clientId) ?? []).flatMap((e) => byClient.get(e.id) ?? [])], [byClient, employeesOf]);
  const health = React.useCallback((list: LibDoc[]) => {
    let expired = 0, crit = 0;
    list.forEach((d) => { const b = bucket(d.expiry_date, critical); if (b?.key === "expired") expired++; else if (b?.key === "critical") crit++; });
    return { expired, critical: crit };
  }, [critical]);

  const filtersOn = !!type || !!status || !!tag;
  const nameSearch = q.trim() !== "" && !wide && !filtersOn; // plain search: look at folder names only
  const searching = (q.trim() !== "" && !nameSearch) || filtersOn;
  const locFor = React.useCallback((id: string, dirs: string[] = []): Loc => {
    const c = clientById.get(id);
    if (!c) return [];
    const parent = c.parent_id ? clientById.get(c.parent_id) : undefined;
    const base = parent ? [`k:${parent.kind}`, `c:${parent.id}`, "e", `c:${c.id}`] : [`k:${c.kind}`, `c:${c.id}`];
    return [...base, ...dirs.map((d) => `d:${d}`)];
  }, [clientById]);
  const folderHits = React.useMemo(() => {
    if (!nameSearch) return [];
    const t = norm(q.trim());
    const hits: { key: string; name: string; hint: string; count: number; loc: Loc; folder: boolean }[] = [];
    const pathOf = (c: MoveTarget) => { const p = c.parent_id ? clientById.get(c.parent_id) : undefined; return [KIND_LABEL[(p ?? c).kind], p?.name].filter(Boolean).join(" › "); };
    moveTargets.forEach((c) => {
      if (norm(c.name).includes(t)) hits.push({ key: `c${c.id}`, name: c.name, hint: pathOf(c), count: allOf(c.id).length, loc: locFor(c.id), folder: false });
    });
    const seen = new Set<string>();
    docs.forEach((d) => {
      const segs = (d.folder ?? "").split("/").filter(Boolean);
      segs.forEach((seg, i) => {
        if (!norm(seg).includes(t)) return;
        const key = `${d.client_id}|${segs.slice(0, i + 1).join("/")}`;
        if (seen.has(key)) return;
        seen.add(key);
        const c = clientById.get(d.client_id);
        hits.push({ key: `f${key}`, name: seg, hint: `${c ? pathOf(c) + " › " : ""}${d.client_name}${i ? " › " + segs.slice(0, i).join(" › ") : ""}`, count: 0, loc: locFor(d.client_id, segs.slice(0, i + 1)), folder: true });
      });
    });
    const prefixOf = (h: (typeof hits)[number]) => h.loc.filter((p) => p.startsWith("d:")).map((p) => p.slice(2)).join("/");
    hits.forEach((h) => { if (h.folder) { const cid = h.loc.filter((p) => p.startsWith("c:")).pop()!.slice(2); const pre = prefixOf(h); h.count = (byClient.get(cid) ?? []).filter((d) => { const f = (d.folder ?? "").split("/").filter(Boolean).join("/"); return f === pre || f.startsWith(pre + "/"); }).length; } });
    return hits.slice(0, 80);
  }, [nameSearch, q, moveTargets, docs, clientById, allOf, locFor, byClient]);
  const results = React.useMemo(() => {
    if (!searching) return [];
    const t = q.trim().toLowerCase();
    return docs.filter((d) => {
      const b = bucket(d.expiry_date, critical);
      return (!type || d.type_id === type) && (!tag || (tag === "__none__" ? !d.tag : d.tag === tag))
        && (!status || (status === "none" ? !b : b?.key === status))
        && (!t || d.title.toLowerCase().includes(t) || d.client_name.toLowerCase().includes(t) || (d.txn_ref ?? "").toLowerCase().includes(t) || d.type_name.toLowerCase().includes(t) || (d.folder ?? "").toLowerCase().includes(t) || (d.tag ?? "").toLowerCase().includes(t));
    });
  }, [docs, q, type, status, tag, critical, searching]);

  // ---- where are we? ----
  let clientId = "";
  let kind = "";
  const dirs: string[] = [];
  let inEmployees = false;
  for (const part of loc) {
    if (part.startsWith("k:")) kind = part.slice(2);
    else if (part.startsWith("c:")) { clientId = part.slice(2); dirs.length = 0; inEmployees = false; }
    else if (part === "e") inEmployees = true;
    else if (part.startsWith("d:")) dirs.push(part.slice(2));
  }
  const client = clientId ? clientById.get(clientId) : undefined;
  const prefix = dirs.join("/");

  const crumbs: { label: string; at: number }[] = [{ label: "المستندات", at: 0 }];
  loc.forEach((part, i) => {
    const label = part.startsWith("k:") ? KIND_LABEL[part.slice(2)] ?? "" : part.startsWith("c:") ? clientById.get(part.slice(2))?.name ?? "—" : part === "e" ? "الموظفون" : part.slice(2);
    crumbs.push({ label, at: i + 1 });
  });
  const go = (part: string) => setLoc((l) => [...l, part]);

  function renderFolders() {
    if (!loc.length) {
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          {KINDS.map((k) => {
            const members = moveTargets.filter((t) => t.kind === k.key && !t.parent_id);
            const total = members.reduce((n, t) => n + allOf(t.id).length, 0);
            const alert = health(members.flatMap((t) => allOf(t.id)));
            return (
              <button key={k.key} type="button" onClick={() => go(`k:${k.key}`)} className="group flex items-center gap-4 rounded-card border border-line bg-surface p-4 text-start shadow-sm transition hover:border-navy/40 hover:shadow-md sm:block sm:p-5">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-navy text-white"><k.icon className="size-7" strokeWidth={1.5} /></span>
                <span className="min-w-0 sm:block"><span className="block text-lg font-bold sm:mt-3">{k.label}</span>
                <span className="mt-0.5 block text-sm text-ink-3"><b className="num">{members.length}</b> ملف · <b className="num">{total}</b> مستند</span>
                {(alert.expired > 0 || alert.critical > 0) && (
                  <span className="mt-1 flex gap-2 text-xs font-medium sm:mt-2">
                    {alert.expired > 0 && <span className="text-bad"><span className="num">{alert.expired}</span> منتهي</span>}
                    {alert.critical > 0 && <span className="text-warn"><span className="num">{alert.critical}</span> قارب الانتهاء</span>}
                  </span>
                )}
                </span>
              </button>
            );
          })}
        </div>
      );
    }
    if (!clientId && kind) {
      const members = moveTargets.filter((t) => t.kind === kind && !t.parent_id).sort((a, b) => a.name.localeCompare(b.name, "ar"));
      if (!members.length) return <Card><Empty icon={<Users />} title={`لا يوجد ${KIND_LABEL[kind]} بعد`} /></Card>;
      return (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const all = allOf(m.id);
            return <FolderTile key={m.id} icon={kind === "company" ? Building2 : User} name={m.name} count={all.length} alert={health(all)} dim={all.length === 0 && !(employeesOf.get(m.id)?.length)} sel={folderSel(`c${m.id}`, all.map((d) => d.id))} onClick={() => go(`c:${m.id}`)} />;
          })}
        </div>
      );
    }
    if (client && inEmployees && !dirs.length && loc[loc.length - 1] === "e") {
      const emps = (employeesOf.get(client.id) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "ar"));
      return (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {emps.map((m) => { const own = byClient.get(m.id) ?? []; return <FolderTile key={m.id} icon={User} name={m.name} count={own.length} alert={health(own)} dim={own.length === 0} sel={folderSel(`c${m.id}`, own.map((d) => d.id))} onClick={() => go(`c:${m.id}`)} />; })}
        </div>
      );
    }
    if (client) {
      const own = byClient.get(client.id) ?? [];
      const sub = new Map<string, LibDoc[]>();
      const files: LibDoc[] = [];
      own.forEach((d) => {
        const f = (d.folder ?? "").split("/").filter(Boolean).join("/");
        if (f === prefix) files.push(d);
        else if (prefix === "" ? f !== "" : f.startsWith(prefix + "/")) {
          const next = (prefix === "" ? f : f.slice(prefix.length + 1)).split("/")[0];
          const a = sub.get(next); if (a) a.push(d); else sub.set(next, [d]);
        }
      });
      const emps = !prefix ? employeesOf.get(client.id) ?? [] : [];
      const empDocs = emps.flatMap((e) => byClient.get(e.id) ?? []);
      return (
        <div className="space-y-4">
          {(emps.length > 0 || sub.size > 0) && (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {emps.length > 0 && <FolderTile icon={Users} name="الموظفون" count={empDocs.length} alert={health(empDocs)} sel={folderSel(`e${client.id}`, empDocs.map((d) => d.id))} onClick={() => go("e")} />}
              {[...sub.entries()].sort((a, b) => a[0].localeCompare(b[0], "ar")).map(([name, list]) => (
                <FolderTile key={name} icon={Folder} name={name} count={list.length} alert={health(list)} sel={folderSel(`d${client.id}/${prefix}/${name}`, list.map((d) => d.id))} onClick={() => go(`d:${name}`)} />
              ))}
            </div>
          )}
          {files.length > 0 ? (
            renderFiles(files)
          ) : emps.length === 0 && sub.size === 0 ? (
            <Card><Empty icon={<FolderOpen />} title="هذا المجلد فارغ" /></Card>
          ) : null}
          {!prefix && <Link href={`/clients/${client.id}`} className="inline-block text-sm text-navy hover:underline">فتح ملف «{client.name}» الكامل (المعاملات والفواتير)</Link>}
        </div>
      );
    }
    return null;
  }

  function renderFiles(list: LibDoc[], path?: boolean) {
    if (view === "cards") {
      return (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((d) => {
            const b = bucket(d.expiry_date, critical);
            const isImg = d.mime_type.startsWith("image/"), isPdf = d.mime_type === "application/pdf";
            const Icon = isImg ? ImageIcon : FileText;
            const parent = d.client_parent_id ? clientById.get(d.client_parent_id)?.name : null;
            return (
              <div key={d.id} className={`relative flex flex-col overflow-hidden rounded-card border bg-surface shadow-sm ${allPicked.has(d.id) ? "border-navy ring-2 ring-navy/30" : "border-line"}`}>
                {selecting && <div className="absolute start-2 top-2 z-10">{docBox(d.id)}</div>}
                <div className={`flex h-20 items-center justify-center ${isPdf ? "bg-bad-soft text-bad" : isImg ? "bg-navy-soft text-navy" : "bg-mute-soft text-ink-2"}`}>
                  <Icon className="size-9" strokeWidth={1.4} />
                  <span className="ms-2 text-xs font-bold uppercase">{isPdf ? "PDF" : isImg ? "صورة" : "ملف"}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <div className="line-clamp-2 text-sm font-semibold leading-5" dir="auto">{d.title}</div>
                  <div className="text-xs text-ink-3">{d.type_name} · <span className="num">{size(d.size_bytes)}</span></div>
                  {path && <div className="truncate text-xs text-ink-3" dir="auto">{[KIND_LABEL[d.client_kind], parent, d.client_name, d.folder].filter(Boolean).join(" › ")}</div>}
                  {b ? <div className="mt-1"><Badge tone={STATUS_TONE[b.key]}>{BUCKET_LABEL[b.key]} · {daysLabel(b.days)}</Badge></div> : <div className="mt-1 text-xs text-ink-3">بدون تاريخ انتهاء</div>}
                </div>
                <div className="flex items-center justify-between border-t border-line px-1 py-1">
                  {canOpen && <DocumentPreviewButton id={d.id} />}
                  <div className="flex items-center">
                    {canWrite && <DocumentEditDialog doc={d} clientId={d.client_id} types={types} iconOnly folder={d.folder ?? ""} tag={d.tag ?? ""} />}
                    {canWrite && canMove && <MoveDocumentsDialog ids={[d.id]} currentClientId={d.client_id} targets={moveTargets} iconOnly />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    if (view === "table") {
      return (
        <>
          <Card className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-bg text-xs text-ink-3"><tr>
                {selecting && <th className="w-10 px-3" />}<th className="px-4 py-2.5 text-start font-medium">المستند</th><th className="px-3 py-2.5 text-start font-medium">النوع</th>
                {path && <th className="px-3 py-2.5 text-start font-medium">المكان</th>}
                <th className="px-3 py-2.5 text-start font-medium">الانتهاء</th><th className="px-3 py-2.5 text-start font-medium">الحجم</th><th className="px-3 py-2.5 text-start font-medium">أضيف</th><th />
              </tr></thead>
              <tbody className="divide-y divide-line">
                {list.map((d) => {
                  const b = bucket(d.expiry_date, critical);
                  const parent = d.client_parent_id ? clientById.get(d.client_parent_id)?.name : null;
                  return (
                    <tr key={d.id} className={allPicked.has(d.id) ? "bg-navy-soft" : "hover:bg-bg"}>
                      {selecting && <td className="px-3">{docBox(d.id)}</td>}
                      <td className="max-w-72 truncate px-4 py-2.5 font-medium" dir="auto">{d.title}</td>
                      <td className="px-3 py-2.5 text-ink-2">{d.type_name}</td>
                      {path && <td className="max-w-56 truncate px-3 py-2.5 text-xs text-ink-3" dir="auto">{[KIND_LABEL[d.client_kind], parent, d.client_name, d.folder].filter(Boolean).join(" › ")}</td>}
                      <td className="px-3 py-2.5">{b ? <Badge tone={STATUS_TONE[b.key]}>{BUCKET_LABEL[b.key]} · {daysLabel(b.days)}</Badge> : <span className="text-ink-3">—</span>}</td>
                      <td className="px-3 py-2.5 text-ink-2 num">{size(d.size_bytes)}</td>
                      <td className="px-3 py-2.5 text-ink-2 num">{fmtDate(d.created_at)}</td>
                      <td className="px-2 py-1.5"><div className="flex items-center justify-end">
                        {canOpen && <DocumentPreviewButton id={d.id} />}
                        {canWrite && <DocumentEditDialog doc={d} clientId={d.client_id} types={types} iconOnly folder={d.folder ?? ""} tag={d.tag ?? ""} />}
                        {canWrite && canMove && <MoveDocumentsDialog ids={[d.id]} currentClientId={d.client_id} targets={moveTargets} iconOnly />}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <Card className="md:hidden"><ul className="divide-y divide-line">{list.map((d) => renderRow(d, path))}</ul></Card>
        </>
      );
    }
    return <Card><ul className="divide-y divide-line">{list.map((d) => renderRow(d, path))}</ul></Card>;
  }

  function renderRow(d: LibDoc, path?: boolean) {
    const b = bucket(d.expiry_date, critical);
    const Icon = d.mime_type.startsWith("image/") ? ImageIcon : FileText;
    const parent = d.client_parent_id ? clientById.get(d.client_parent_id)?.name : null;
    return (
      <li key={d.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 ${allPicked.has(d.id) ? "bg-navy-soft" : ""}`}>
        {docBox(d.id)}
        <Icon className="size-5 shrink-0 text-ink-3" strokeWidth={1.6} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" dir="auto">{d.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
            {path && <span dir="auto">{[KIND_LABEL[d.client_kind], parent, d.client_name, d.folder].filter(Boolean).join(" › ")}</span>}
            <span>{d.type_name}</span>
            {d.txn_ref && <Link href={`/transactions/${d.transaction_id}`} className="num hover:text-navy">{d.txn_ref}</Link>}
            {d.expiry_date && <span>ينتهي <span className="num">{fmtDate(d.expiry_date)}</span></span>}
            <span className="num">{size(d.size_bytes)}</span>
          </div>
        </div>
        {b && <Badge tone={STATUS_TONE[b.key]}>{BUCKET_LABEL[b.key]} · {daysLabel(b.days)}</Badge>}
        <div className="flex items-center">
          {canOpen && <DocumentPreviewButton id={d.id} />}
          {canWrite && <DocumentEditDialog doc={d} clientId={d.client_id} types={types} iconOnly folder={d.folder ?? ""} tag={d.tag ?? ""} />}
          {canWrite && canMove && <MoveDocumentsDialog ids={[d.id]} currentClientId={d.client_id} targets={moveTargets} iconOnly />}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-3">
      {canDelete && (
        <div className="flex flex-wrap items-center gap-2">
          {!selecting ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSelecting(true)}><Trash2 /> تحديد وحذف</Button>
          ) : (
            <div className="sticky top-16 z-10 flex w-full flex-wrap items-center gap-2 rounded-card border border-navy bg-navy-soft px-3 py-2">
              <span className="text-[15px] font-semibold text-navy"><b className="num">{allPicked.size}</b> مستند محدد</span>
              <span className="text-xs text-ink-3">اضغط على المجلدات أو المستندات لتحديدها</span>
              <div className="ms-auto flex gap-2">
                <ConfirmButton
                  size="sm" variant="danger" disabled={allPicked.size === 0}
                  title="حذف المحدد" confirmLabel="احذف"
                  message={`سيُحذف ${allPicked.size} مستند${pickedFolders.size ? ` (منها محتويات ${pickedFolders.size} مجلد)` : ""}. تبقى ملفات العملاء نفسها، وتجدها في سلة المحذوفات.`}
                  action={async () => { const r = await deleteDocuments([...allPicked]); if (r.ok) stopSelecting(); return r; }}
                ><Trash2 /> حذف المحدد</ConfirmButton>
                <Button type="button" size="sm" variant="outline" onClick={stopSelecting}>إلغاء</Button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* search + filters: always visible on desktop; behind a button on phones */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={wide ? "بحث موسع: المجلدات والمستندات" : "ابحث باسم مجلد أو عميل"} className={q || searching ? "px-9" : "ps-9"} />
            {(searching || nameSearch) && (
              <button type="button" onClick={() => { setQ(""); setType(""); setStatus(""); setTag(""); setWide(false); }} aria-label="مسح البحث" className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-mute-soft"><X className="size-4" /></button>
            )}
          </div>
          <button
            type="button" onClick={() => setPanel((v) => !v)} aria-expanded={panel} aria-label="تصفية"
            className={`relative flex size-11 shrink-0 items-center justify-center rounded-ctl border ${panel || filtersOn || wide ? "border-navy bg-navy text-white" : "border-line-strong bg-surface text-ink-2"}`}
          >
            <SlidersHorizontal className="size-5" strokeWidth={1.8} />
            {(filtersOn || wide) && !panel && <span className="absolute -end-1 -top-1 size-3 rounded-full bg-orange" />}
          </button>
          <div className="hidden items-center gap-0.5 rounded-ctl border border-line-strong bg-surface p-1 sm:flex" role="group" aria-label="طريقة العرض">
            {([["cards", LayoutGrid, "بطاقات"], ["list", ListIcon, "قائمة"], ["table", Table2, "جدول"]] as const).map(([k, Ic, t]) => (
              <button key={k} type="button" onClick={() => chooseView(k)} aria-pressed={view === k} title={t} aria-label={t} className={`flex size-9 items-center justify-center rounded-md ${view === k ? "bg-navy-soft text-navy" : "text-ink-3 hover:bg-mute-soft"}`}><Ic className="size-[18px]" strokeWidth={1.8} /></button>
            ))}
          </div>
        </div>
        {panel && (
          <div className="grid gap-2 rounded-card border border-line bg-surface p-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-[15px] sm:col-span-3">
              <input type="checkbox" checked={wide} onChange={(e) => setWide(e.target.checked)} className="size-5 accent-navy" />
              بحث موسع: يبحث أيضاً في أسماء المستندات داخل المجلدات
            </label>
            <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="النوع"><option value="">كل الأنواع</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة">
              <option value="">كل الحالات</option>
              {Object.entries(BUCKET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              <option value="none">بدون تاريخ انتهاء</option>
            </Select>
            <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="التصنيف">
              <option value="">كل التصنيفات</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="__none__">بدون تصنيف</option>
            </Select>
          </div>
        )}
      </div>

      {nameSearch ? (
        folderHits.length === 0 ? (
          <Card className="p-4 text-center text-[15px] text-ink-2">
            لا يوجد مجلد بهذا الاسم.
            <div className="mt-2"><Button type="button" variant="outline" onClick={() => setWide(true)}>ابحث في أسماء المستندات أيضاً</Button></div>
          </Card>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-ink-3"><b className="num">{folderHits.length}</b> مجلد <button type="button" className="text-navy hover:underline" onClick={() => setWide(true)}>(بحث موسع في أسماء المستندات)</button></div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {folderHits.map((h) => (
                <FolderTile key={h.key} icon={h.folder ? Folder : Users} name={h.name} hint={h.hint} count={h.count} onClick={() => { setLoc(h.loc); setQ(""); }} />
              ))}
            </div>
          </div>
        )
      ) : searching ? (
        results.length === 0 ? (
          <Card><Empty icon={<FileText />} title="لا توجد مستندات مطابقة" /></Card>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-ink-3"><b className="num">{results.length}</b> نتيجة{results.length > 200 && " — يظهر أول 200، حدّد البحث أكثر"}</div>
            {renderFiles(results.slice(0, 200), true)}
          </div>
        )
      ) : (
        <>
          {/* breadcrumb */}
          {loc.length > 0 && (
            <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="المسار">
              <Button type="button" size="sm" variant="outline" onClick={() => setLoc((l) => l.slice(0, -1))}><ChevronRight /> رجوع</Button>
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronLeft className="size-3.5 text-ink-3" />}
                  {i === crumbs.length - 1 ? <span className="px-1 font-semibold" dir="auto">{c.label}</span> : <button type="button" onClick={() => setLoc(loc.slice(0, c.at))} className="rounded px-1 text-navy hover:underline" dir="auto">{c.label}</button>}
                </React.Fragment>
              ))}
            </nav>
          )}
          {docs.length === 0 && moveTargets.length === 0 ? <Card><Empty icon={<FileText />} title="لا توجد مستندات بعد" /></Card> : renderFolders()}
        </>
      )}
    </div>
  );
}
