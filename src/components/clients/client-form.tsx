"use client";
import * as React from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

export type ClientValues = { kind?: string; name?: string; phone?: string | null; whatsapp?: string | null; email?: string | null; notes?: string | null };

export function ClientFields({ v = {} }: { v?: ClientValues }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="النوع">
        <Select name="kind" defaultValue={v.kind ?? "individual"}>
          <option value="individual">فرد</option>
          <option value="company">شركة / منشأة</option>
        </Select>
      </Field>
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
