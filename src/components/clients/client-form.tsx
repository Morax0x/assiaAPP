"use client";
import * as React from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

export type ClientValues = { kind?: string; name?: string; phone?: string | null; whatsapp?: string | null; email?: string | null; notes?: string | null; parent_id?: string | null };

export function ClientFields({ v = {}, companies }: { v?: ClientValues; companies?: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="النوع">
        <Select name="kind" defaultValue={v.kind ?? "individual"}>
          <option value="individual">فرد</option>
          <option value="company">شركة / منشأة</option>
          <option value="sponsor">كفيل</option>
        </Select>
      </Field>
      {companies && companies.length > 0 && (
        <Field label="يتبع شركة (اختياري)" hint="مثلاً موظف داخل ملف شركة. تبقى مستنداته داخل ملف الشركة" className="sm:col-span-2">
          <Select name="parent_id" defaultValue={v.parent_id ?? ""}>
            <option value="">لا يتبع شركة</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="الاسم"><Input name="name" defaultValue={v.name ?? ""} required /></Field>
      <Field label="الهاتف"><Input name="phone" defaultValue={v.phone ?? ""} dir="ltr" className="text-start" inputMode="tel" /></Field>
      <Field label="واتساب" hint="اتركه فارغاً إن كان نفس الهاتف">
        <Input name="whatsapp" defaultValue={v.whatsapp ?? ""} dir="ltr" className="text-start" inputMode="tel" />
      </Field>
      <Field label="البريد الإلكتروني" className="sm:col-span-2"><Input name="email" type="email" defaultValue={v.email ?? ""} dir="ltr" className="text-start" /></Field>
      <Field label="ملاحظات داخلية" hint="لا تظهر في روابط المشاركة" className="sm:col-span-2">
        <Textarea name="notes" defaultValue={v.notes ?? ""} />
      </Field>
    </div>
  );
}
