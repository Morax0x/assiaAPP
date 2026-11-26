"use client";
import * as React from "react";
import Link from "next/link";
import { Building2, ChevronLeft, ChevronRight, FileText, Folder, FolderOpen, Image as ImageIcon, Search, ShieldCheck, SlidersHorizontal, User, Users, X } from "lucide-react";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { Card, Empty } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
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
  { key: "sponsor", label: "كفلاء", icon: ShieldCheck },
] as const;
const KIND_LABEL: Record<string, string> = { individual: "أفراد", company: "شركات", sponsor: "كفلاء" };

/** Location in the folder tree. Parts: "k:<kind>", "c:<clientId>", "e" (the employees folder of a company), "d:<folder name>". */
type Loc = string[];

function FolderTile({ icon: Icon, name, count, alert, dim, onClick }: { icon: typeof Folder; name: string; count: number; alert?: { expired: number; critical: number }; dim?: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`group flex min-h-[72px] items-center gap-3 rounded-card border border-line bg-surface p-3 text-start shadow-sm transition hover:border-navy/40 hover:shadow-md ${dim ? "opacity-60" : ""}`}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-soft text-navy"><Icon className="size-6" strokeWidth={1.6} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold" dir="auto">{name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
          <span><b className="num">{count}</b> مستند</span>
          {alert && alert.expired > 0 && <span className="font-medium text-bad"><span className="num">{alert.expired}</span> منتهي</span>}
          {alert && alert.critical > 0 && <span className="font-medium text-warn"><span className="num">{alert.critical}</span> قارب</span>}
        </span>
      </span>
      <ChevronLeft className="size-4 shrink-0 text-ink-3 transition group-hover:-translate-x-0.5 rtl:rotate-0" strokeWidth={1.75} />
    </button>
  );
}

export function DocumentsLibrary({
  docs, types, critical, canWrite, moveTargets,
}: { docs: LibDoc[]; types: { id: string; name: string }[]; critical: number; canWrite: boolean; moveTargets: MoveTarget[] }) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [panel, setPanel] = React.useState(false);
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

  const searching = q.trim() !== "" || !!type || !!status || !!tag;
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
              <button key={k.key} type="button" onClick={() => go(`k:${k.key}`)} className="group rounded-card border border-line bg-surface p-5 text-start shadow-sm transition hover:border-navy/40 hover:shadow-md">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-navy text-white"><k.icon className="size-7" strokeWidth={1.5} /></span>
                <span className="mt-3 block text-lg font-bold">{k.label}</span>
                <span className="mt-0.5 block text-sm text-ink-3"><b className="num">{members.length}</b> ملف · <b className="num">{total}</b> مستند</span>
                {(alert.expired > 0 || alert.critical > 0) && (
                  <span className="mt-2 flex gap-2 text-xs font-medium">
                    {alert.expired > 0 && <span className="text-bad"><span className="num">{alert.expired}</span> منتهي</span>}
                    {alert.critical > 0 && <span className="text-warn"><span className="num">{alert.critical}</span> قارب الانتهاء</span>}
                  </span>
                )}
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
            return <FolderTile key={m.id} icon={kind === "company" ? Building2 : User} name={m.name} count={all.length} alert={health(all)} dim={all.length === 0 && !(employeesOf.get(m.id)?.length)} onClick={() => go(`c:${m.id}`)} />;
          })}
        </div>
      );
    }
    if (client && inEmployees && !dirs.length && loc[loc.length - 1] === "e") {
      const emps = (employeesOf.get(client.id) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "ar"));
      return (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {emps.map((m) => { const own = byClient.get(m.id) ?? []; return <FolderTile key={m.id} icon={User} name={m.name} count={own.length} alert={health(own)} dim={own.length === 0} onClick={() => go(`c:${m.id}`)} />; })}
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
              {emps.length > 0 && <FolderTile icon={Users} name="الموظفون" count={empDocs.length} alert={health(empDocs)} onClick={() => go("e")} />}
              {[...sub.entries()].sort((a, b) => a[0].localeCompare(b[0], "ar")).map(([name, list]) => (
                <FolderTile key={name} icon={Folder} name={name} count={list.length} alert={health(list)} onClick={() => go(`d:${name}`)} />
              ))}
            </div>
          )}
          {files.length > 0 ? (
            <Card><ul className="divide-y divide-line">{files.map((d) => renderRow(d))}</ul></Card>
          ) : emps.length === 0 && sub.size === 0 ? (
            <Card><Empty icon={<FolderOpen />} title="هذا المجلد فارغ" /></Card>
          ) : null}
          {!prefix && <Link href={`/clients/${client.id}`} className="inline-block text-sm text-navy hover:underline">فتح ملف «{client.name}» الكامل (المعاملات والفواتير)</Link>}
        </div>
      );
    }
    return null;
  }

  function renderRow(d: LibDoc, path?: boolean) {
    const b = bucket(d.expiry_date, critical);
    const Icon = d.mime_type.startsWith("image/") ? ImageIcon : FileText;
    const parent = d.client_parent_id ? clientById.get(d.client_parent_id)?.name : null;
    return (
      <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
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
          <DocumentPreviewButton id={d.id} />
          {canWrite && <DocumentEditDialog doc={d} clientId={d.client_id} types={types} iconOnly folder={d.folder ?? ""} tag={d.tag ?? ""} />}
          {canWrite && <MoveDocumentsDialog ids={[d.id]} currentClientId={d.client_id} targets={moveTargets} iconOnly />}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-3">
      {/* search + filters: always visible on desktop; behind a button on phones */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className={`relative min-w-0 flex-1 ${panel ? "block" : "hidden md:block"}`}>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المستند أو العميل أو المجلد" className="ps-9" />
          </div>
          <Button type="button" variant={panel || searching ? "primary" : "outline"} onClick={() => setPanel((v) => !v)} className={panel ? "" : "w-full md:w-auto"} aria-expanded={panel}>
            <SlidersHorizontal /> {panel ? "إخفاء" : "بحث وتصفية"}{searching && !panel ? " •" : ""}
          </Button>
          {searching && (
            <Button type="button" variant="outline" onClick={() => { setQ(""); setType(""); setStatus(""); setTag(""); }} aria-label="مسح البحث"><X /></Button>
          )}
        </div>
        {panel && (
          <div className="grid gap-2 rounded-card border border-line bg-surface p-3 sm:grid-cols-3">
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

      {searching ? (
        results.length === 0 ? (
          <Card><Empty icon={<FileText />} title="لا توجد مستندات مطابقة" /></Card>
        ) : (
          <Card>
            <div className="border-b border-line px-4 py-2 text-xs text-ink-3"><b className="num">{results.length}</b> نتيجة</div>
            <ul className="divide-y divide-line">{results.slice(0, 200).map((d) => renderRow(d, true))}</ul>
            {results.length > 200 && <div className="border-t border-line px-4 py-2 text-center text-xs text-ink-3">يظهر أول 200 مستند، حدّد البحث أكثر.</div>}
          </Card>
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
