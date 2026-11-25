"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/auth";
import { safe, type Result } from "@/lib/action";

export async function restoreRecord(table: "clients" | "transactions" | "documents", id: string): Promise<Result> {
  return safe(async () => {
    await requireAction();
    const supabase = await createClient();
    const { error } = await supabase.rpc("restore_record", { p_table: table, p_id: id });
    if (error) throw error;
    ["/settings/trash", "/clients", "/transactions", "/documents", "/alerts", "/dashboard"].forEach((p) => revalidatePath(p));
  });
}
