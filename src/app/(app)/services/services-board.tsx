"use client";
import * as React from "react";
import { Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-form";
import { Card, Empty } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Input } from "@/components/ui/form";
import { deleteTemplate, saveTemplate } from "@/modules/settings/actions";
import { money } from "@/lib/utils";

export type Service = { id: string; name: string; name_en: string; category: string; govt: number; fee: number };

function Fields({ s, categories }: { s?: Service; categories: string[] }) {
  const listId = React.useId();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="اسم الخدمة بالعربية"><Input name="name" defaultValue={s?.name} required placeholder="مثال: تجديد رخصة تجارية" /></Field>
      <Field label="الاسم بالإنجليزية (يظهر في الفاتورة)"><Input name="name_en" defaultValue={s?.name_en} dir="ltr" className="text-start" placeholder="Trade License Renewal" /></Field>
      <Field label="التصنيف" className="sm:col-span-2">
        <Input name="category" list={listId} defaultValue={s?.category} placeholder="اختر أو اكتب تصنيفاً جديداً" />
        <datalist id={listId}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="الرسوم الحكومية الافتراضية" hint="ما يُدفع للجهة الحكومية، وليس ربحاً"><Input name="default_govt_fee" type="number" step="0.01" min="0" defaultValue={s?.govt ?? 0} dir="ltr" className="text-start" inputMode="decimal" /></Field>
      <Field label="أتعاب المكتب الافتراضية" hint="ربح المكتب"><Input name="default_office_fee" type="number" step="0.01" min="0" defaultValue={s?.fee ?? 0} dir="ltr" className="text-start" inputMode="decimal" /></Field>
    </div>
  );
}

export function ServicesBoard({ rows, canEdit }: { rows: Service[]; canEdit: boolean }) {
  const [q, setQ] = React.useState("");
  const categories = React.useMemo(() => [...new Set(rows.map((r) => r.category))].sort((a, b) => a.localeCompare(b, "ar")), [rows]);
  const groups = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = rows.filter((r) => !t || r.name.toLowerCase().includes(t) || r.name_en.toLowerCase().includes(t) || r.category.includes(t));
    const m = new Map<string, Service[]>();
    list.forEach((r) => m.set(r.category, [...(m.get(r.category) ?? []), r]));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "ar"));
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن خدمة بالعربية أو الإنجليزية" className="ps-9" />
        </div>
        {canEdit && (
          <ActionDialog title="إضافة خدمة جديدة" trigger={<><Plus /> إضافة خدمة</>} triggerProps={{ variant: "primary" }} action={saveTemplate}>
            <Fields categories={categories} />
          </ActionDialog>
        )}
        <span className="text-sm text-ink-3">{rows.length} خدمة</span>
      </div>

      {groups.length === 0 ? (
        <Card><Empty icon={<Tags />} title="لا توجد خدمات مطابقة" hint={canEdit ? "اضغط «إضافة خدمة» لتسجيل خدمة وسعرها" : undefined} /></Card>
      ) : (
        groups.map(([cat, list]) => (
          <Card key={cat}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold">{cat}</h2>
              <span className="rounded-full bg-mute-soft px-2.5 text-xs text-ink-2 num">{list.length}</span>
            </div>
            <ul className="divide-y divide-line">
              {list.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{s.name}</div>
                    {s.name_en && <div className="text-sm text-ink-3" dir="ltr" style={{ textAlign: "start" }}>{s.name_en}</div>}
                  </div>
                  <div className="text-end text-sm">
                    <div className="font-semibold num">{money(s.govt + s.fee)}</div>
                    <div className="text-xs text-ink-3">رسوم <span className="num">{money(s.govt, "")}</span> + أتعاب <span className="num">{money(s.fee, "")}</span></div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center">
                      <ActionDialog title="تعديل الخدمة" trigger={<Pencil />} triggerProps={{ size: "icon", variant: "ghost" }} action={saveTemplate}>
                        <Fields s={s} categories={categories} />
                      </ActionDialog>
                      <ConfirmButton size="icon" variant="ghost" title="حذف الخدمة" message="لن تظهر الخدمة في القائمة عند إنشاء الفواتير. الفواتير السابقة لا تتأثر." action={() => deleteTemplate(s.id)} confirmLabel="حذف">
                        <Trash2 className="text-bad" />
                      </ConfirmButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
