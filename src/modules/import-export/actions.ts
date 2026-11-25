"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/auth";
import { safe, type Result } from "@/lib/action";

const rowSchema = z.object({
  client: z.string().min(1),
  title: z.string().min(1),
  govt_fees: z.number().min(0).default(0),
  office_fee: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  status: z.enum(["new", "in_progress", "awaiting_docs", "completed", "cancelled"]).default("new"),
  due_date: z.string().nullable().optional(),
});
export type ImportRow = z.input<typeof rowSchema>;

export async function importTransactions(rows: ImportRow[]): Promise<Result<{ created: number; clients: number }>> {
  return safe(async () => {
    const s = await requireAction("txn.write");
    if (rows.length > 500) throw new Error("الحد الأقصى 500 صف في كل استيراد");
    const supabase = await createClient();
    const parsed = rows.map((r, i) => {
      const p = rowSchema.safeParse(r);
      if (!p.success) throw new Error(`الصف ${i + 2}: ${p.error.issues[0]?.message ?? "بيانات غير صالحة"}`);
      return p.data;
    });

    const { data: existing } = await supabase.from("clients").select("id,name").is("deleted_at", null);
    const map = new Map((existing ?? []).map((c) => [c.name.trim().toLowerCase(), c.id as string]));
    let newClients = 0;
    for (const name of new Set(parsed.map((p) => p.client.trim()))) {
      if (map.has(name.toLowerCase())) continue;
      const { data, error } = await supabase.from("clients").insert({ name, kind: "individual", created_by: s.userId }).select("id").single();
      if (error) throw error;
      map.set(name.toLowerCase(), data.id);
      newClients++;
    }
    let created = 0;
    for (const p of parsed) {
      const { error } = await supabase.from("transactions").insert({
        client_id: map.get(p.client.trim().toLowerCase()), title: p.title, govt_fees: p.govt_fees, office_fee: p.office_fee,
        discount: p.discount, status: p.status, due_date: p.due_date || null, created_by: s.userId, assignee_id: s.userId,
      });
      if (error) throw new Error(`تعذر إدخال "${p.title}": ${error.message}`);
      created++;
    }
    revalidatePath("/transactions");
    revalidatePath("/clients");
    return { created, clients: newClients };
  });
}
