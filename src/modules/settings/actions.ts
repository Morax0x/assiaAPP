"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/auth";
import { safe, formObj, emptyToNull, type Result } from "@/lib/action";

const days = (s: string) =>
  [...new Set(s.split(/[,\s،]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0 && n <= 730))].sort((a, b) => b - a);

export async function updateOffice(fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("settings.manage");
    const o = formObj(fd);
    const v = z.object({
      office_name: z.string().min(2, "اسم المكتب مطلوب"), phone: z.string().optional(), address: z.string().optional(),
      tax_number: z.string().optional(), invoice_footer: z.string().optional(), whatsapp_template: z.string().min(10, "نص الرسالة قصير"),
      website: z.string().optional(), email: z.string().optional(), bank_name: z.string().optional(), bank_account_name: z.string().optional(),
      iban: z.string().optional(), bank_account_no: z.string().optional(), quote_terms: z.string().optional(),
      next_invoice_no: z.coerce.number().int().min(1, "رقم الفاتورة غير صالح").max(99999999),
    }).parse(o);
    const supabase = await createClient();
    const { error } = await supabase.from("office_settings").update({
      office_name: v.office_name, phone: emptyToNull(v.phone), address: emptyToNull(v.address), tax_number: emptyToNull(v.tax_number),
      invoice_footer: emptyToNull(v.invoice_footer), whatsapp_template: v.whatsapp_template,
      website: emptyToNull(v.website), email: emptyToNull(v.email), bank_name: emptyToNull(v.bank_name), bank_account_name: emptyToNull(v.bank_account_name),
      iban: emptyToNull(v.iban?.replace(/\s+/g, "").toUpperCase()), bank_account_no: emptyToNull(v.bank_account_no), quote_terms: emptyToNull(v.quote_terms),
      next_invoice_no: v.next_invoice_no,
    }).eq("id", true);
    if (error) throw error;
    revalidatePath("/settings/general");
  });
}

export async function updateReminders(fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("settings.manage");
    const o = formObj(fd);
    const def = days(o.default_days ?? "");
    if (!def.length) throw new Error("أدخل فترة تذكير واحدة على الأقل");
    const critical = z.coerce.number().int().min(1).max(180).parse(o.critical_days);
    const supabase = await createClient();
    const { error } = await supabase.from("office_settings").update({ default_reminder_days: def, critical_days: critical }).eq("id", true);
    if (error) throw error;
    // Per-type overrides: fields named type_<uuid>; empty = use default
    const types = Object.keys(o).filter((k) => k.startsWith("type_"));
    for (const k of types) {
      const id = k.slice(5);
      const list = days(o[k]);
      const { error: e2 } = await supabase.from("document_types").update({ reminder_days: list.length ? list : null }).eq("id", id);
      if (e2) throw e2;
    }
    revalidatePath("/settings/reminders");
    revalidatePath("/alerts");
  });
}

export async function saveTemplate(fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("settings.manage");
    const v = z.object({
      id: z.string().optional(), name: z.string().min(2, "الاسم مطلوب"), name_en: z.string().optional(), category: z.string().optional(),
      default_govt_fee: z.coerce.number().min(0, "الرسوم لا يمكن أن تكون سالبة").default(0), default_office_fee: z.coerce.number().min(0, "الأتعاب لا يمكن أن تكون سالبة").default(0),
    }).parse(formObj(fd));
    const supabase = await createClient();
    const row = { name: v.name, name_en: emptyToNull(v.name_en), category: emptyToNull(v.category) ?? "خدمات أخرى", default_govt_fee: v.default_govt_fee, default_office_fee: v.default_office_fee, is_active: true };
    const { error } = v.id ? await supabase.from("service_templates").update(row).eq("id", v.id) : await supabase.from("service_templates").insert(row);
    if (error) throw error;
    revalidatePath("/services");
  });
}

export async function deleteTemplate(id: string): Promise<Result> {
  return safe(async () => {
    await requireAction("settings.manage");
    const supabase = await createClient();
    const { error } = await supabase.from("service_templates").update({ is_active: false }).eq("id", id);
    if (error) throw error;
    revalidatePath("/services");
  });
}
