"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/auth";
import { safe, formObj, emptyToNull, type Result } from "@/lib/action";

const schema = z.object({
  kind: z.enum(["individual", "company", "sponsor"]),
  name: z.string().min(2, "الاسم مطلوب"),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.union([z.string().email("البريد غير صالح"), z.literal("")]).optional(),
  notes: z.string().optional(),
  parent_id: z.string().optional(),
});

export async function createClientAction(fd: FormData): Promise<Result<{ id: string }>> {
  return safe(async () => {
    const s = await requireAction("clients.write");
    const v = schema.parse(formObj(fd));
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...v, phone: emptyToNull(v.phone), whatsapp: emptyToNull(v.whatsapp), email: emptyToNull(v.email), notes: emptyToNull(v.notes), parent_id: v.kind === "company" ? null : emptyToNull(v.parent_id), created_by: s.userId })
      .select("id").single();
    if (error) throw error;
    revalidatePath("/clients");
    return { id: data.id as string };
  });
}

export async function createClientAndGo(fd: FormData) {
  const r = await createClientAction(fd);
  if (!r.ok) return r;
  redirect(`/clients/${(r.data as { id: string }).id}`);
}

export async function updateClientAction(id: string, fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("clients.write");
    const v = schema.parse(formObj(fd));
    const supabase = await createClient();
    const { error } = await supabase.from("clients").update({
      ...v, phone: emptyToNull(v.phone), whatsapp: emptyToNull(v.whatsapp), email: emptyToNull(v.email), notes: emptyToNull(v.notes),
      parent_id: v.kind === "company" ? null : emptyToNull(v.parent_id),
    }).eq("id", id);
    if (error) throw error;
    revalidatePath(`/clients/${id}`);
  });
}

export async function deleteClientAction(id: string): Promise<Result> {
  const r = await safe(async () => {
    await requireAction("clients.delete");
    const supabase = await createClient();
    const { error } = await supabase.rpc("soft_delete_record", { p_table: "clients", p_id: id });
    if (error) throw error;
  });
  if (r.ok) redirect("/clients");
  return r;
}
