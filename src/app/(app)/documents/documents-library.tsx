"use client";
import * as React from "react";
import Link from "next/link";
import { FileText, Image as ImageIcon, Search } from "lucide-react";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { Card, Empty } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { DocumentPreviewButton } from "@/components/documents/document-preview";
import { BUCKET_LABEL, CLIENT_KIND_PLURAL } from "@/lib/permissions";
import { daysLabel, fmtDate } from "@/lib/utils";

export type LibDoc = {
  id: string; client_id: string; transaction_id: string | null; title: string; issue_date: string | null; expiry_date: string | null;
  mime_type: string; size_bytes: number; created_at: string; type_id: string; type_name: string; client_name: string; client_kind: string; txn_ref: string | null;
};

function bucket(expiry: string | null, critical: number) {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  return { days, key: days < 0 ? "expired" : days <= critical ? "critical" : days <= 90 ? "upcoming" : "valid" };
}
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function DocumentsLibrary({ docs, types, critical }: { docs: LibDoc[]; types: { id: string; name: string }[]; critical: number }) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [group, setGroup] = React.useState<"kind" | "client" | "type" | "none">("kind");
  const [kind, setKind] = React.useState("");

  const list = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    return docs.filter((d) => {
      const b = bucket(d.expiry_date, critical);
      return (!type || d.type_id === type) && (!kind || d.client_kind === kind)
        && (!status || (status === "none" ? !b : b?.key === status))
        && (!t || d.title.toLowerCase().includes(t) || d.client_name.toLowerCase().includes(t) || (d.txn_ref ?? "").toLowerCase().includes(t) || d.type_name.toLowerCase().includes(t));
    });
  }, [docs, q, type, status, critical, kind]);

  const groups = React.useMemo(() => {
    const m = new Map<string, { key: string; title: string; href?: string; items: LibDoc[] }>();
    list.forEach((d) => {
      const k = group === "kind" ? d.client_kind : group === "client" ? d.client_id : group === "type" ? d.type_id : "all";
      const g = m.get(k) ?? { key: k, title: group === "kind" ? CLIENT_KIND_PLURAL[d.client_kind] ?? "عملاء" : group === "client" ? d.client_name : group === "type" ? d.type_name : "كل المستندات", href: group === "client" ? `/clients/${d.client_id}` : undefined, items: [] };
      g.items.push(d); m.set(k, g);
    });
    const order = [CLIENT_KIND_PLURAL.individual, CLIENT_KIND_PLURAL.company, CLIENT_KIND_PLURAL.sponsor];
    return [...m.values()].sort((a, b) => group === "kind" ? order.indexOf(a.title) - order.indexOf(b.title) : a.title.localeCompare(b.title, "ar"));
  }, [list, group]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-4">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم المستند أو العميل أو رقم المعاملة" className="ps-9" />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="النوع"><option value="">كل الأنواع</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة">
          <option value="">كل الحالات</option>
          {Object.entries(BUCKET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="none">بدون تاريخ انتهاء</option>
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="فئة العميل">
          <option value="">كل الفئات (أفراد، شركات، كفلاء)</option>
          <option value="individual">أفراد فقط</option><option value="company">شركات فقط</option><option value="sponsor">كفلاء فقط</option>
        </Select>
        <Select value={group} onChange={(e) => setGroup(e.target.value as typeof group)} aria-label="التقسيم">
          <option value="kind">تقسيم حسب الفئة (أفراد / شركات / كفلاء)</option>
          <option value="client">تقسيم حسب العميل</option>
          <option value="type">تقسيم حسب النوع</option>
          <option value="none">بدون تقسيم</option>
        </Select>
      </div>

      {list.length === 0 ? (
        <Card><Empty icon={<FileText />} title="لا توجد مستندات مطابقة" /></Card>
      ) : (
        groups.map((g) => (
          <Card key={g.key}>
            {group !== "none" && (
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                {g.href ? <Link href={g.href} className="text-sm font-semibold hover:text-navy">{g.title}</Link> : <span className="text-sm font-semibold">{g.title}</span>}
                <span className="rounded-full bg-mute-soft px-2 text-xs text-ink-2 num">{g.items.length}</span>
              </div>
            )}
            <ul className="divide-y divide-line">
              {g.items.map((d) => {
                const b = bucket(d.expiry_date, critical);
                const Icon = d.mime_type.startsWith("image/") ? ImageIcon : FileText;
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                    <Icon className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{d.title}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                        {group !== "type" && <span>{d.type_name}</span>}
                        {group !== "client" && <Link href={`/clients/${d.client_id}`} className="hover:text-navy">{d.client_name}</Link>}
                        {d.txn_ref && <Link href={`/transactions/${d.transaction_id}`} className="num hover:text-navy">{d.txn_ref}</Link>}
                        {d.expiry_date && <span>ينتهي <span className="num">{fmtDate(d.expiry_date)}</span></span>}
                        <span className="num">{size(d.size_bytes)}</span>
                      </div>
                    </div>
                    {b && <Badge tone={STATUS_TONE[b.key]}>{BUCKET_LABEL[b.key]} · {daysLabel(b.days)}</Badge>}
                    <DocumentPreviewButton id={d.id} />
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
