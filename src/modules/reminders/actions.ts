"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/auth";
import { safe, formObj, emptyToNull, type Result } from "@/lib/action";

const schema = z.object({
  title: z.string().trim().min(2, "اكتب نص التذكير"),
  note: z.string().optional(),
  remind_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "اختر تاريخ التذكير"),
  client_id: z.string().optional(),
});

export async function createReminder(fd: FormData): Promise<Result> {
  return safe(async () => {
    const s = await requireAction();
    const v = schema.parse(formObj(fd));
    const supabase = await createClient();
    const { error } = await supabase.from("reminders").insert({
      title: v.title, note: emptyToNull(v.note), remind_date: v.remind_date,
      client_id: emptyToNull(v.client_id), created_by: s.userId,
    });
    if (error) throw error;
    revalidatePath("/alerts");
  });
}

export async function setReminderDone(id: string, done: boolean): Promise<Result> {
  return safe(async () => {
    await requireAction();
    const supabase = await createClient();
    const { error } = await supabase.from("reminders").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
    if (error) throw error;
    revalidatePath("/alerts");
  });
}

export async function deleteReminder(id: string): Promise<Result> {
  return safe(async () => {
    await requireAction();
    const supabase = await createClient();
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/alerts");
  });
}
