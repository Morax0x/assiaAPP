"use client";
import * as React from "react";
import { Field, Input, Select } from "@/components/ui/form";

export const CUSTOM_TYPE = "__custom__";
export type TypeOpt = { id: string; name: string };

/** Choose a document type from the list, or pick "another type" and write its name yourself. */
export function DocTypePicker({
  types, typeId, custom, onChange, disabled, label = "نوع المستند",
}: { types: TypeOpt[]; typeId: string; custom: string; onChange: (typeId: string, custom: string) => void; disabled?: boolean; label?: string }) {
  return (
    <>
      <Field label={label}>
        <Select value={typeId} onChange={(e) => onChange(e.target.value, custom)} disabled={disabled}>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          <option value={CUSTOM_TYPE}>＋ نوع آخر (أكتب اسمه)</option>
        </Select>
      </Field>
      {typeId === CUSTOM_TYPE && (
        <Field label="اسم النوع الجديد" hint="يُحفظ ويظهر في القائمة في المرات القادمة">
          <Input value={custom} onChange={(e) => onChange(typeId, e.target.value)} placeholder="مثال: شهادة تأمين مركبة" maxLength={60} autoFocus />
        </Field>
      )}
    </>
  );
}
