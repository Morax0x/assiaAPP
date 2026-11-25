import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { LEDGER_KIND_LABEL, METHOD_LABEL, PAY_STATUS_LABEL, TXN_STATUS_LABEL } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const d = (v: string | null) => (v ? v.slice(0, 10) : "");

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return new NextResponse("Unauthorized", { status: 401 });
  const type = new URL(req.url).searchParams.get("type") ?? "transactions";
  const supabase = await createClient();
  let rows: Record<string, unknown>[] = [];
  let name = type;

  if (type === "backup") {
    if (s.profile.role !== "owner") return new NextResponse("Forbidden", { status: 403 });
    const tables: [string, string][] = [
      ["clients", "العملاء"], ["transactions", "المعاملات"], ["ledger_entries", "حركات الخزينة"], ["accounts", "الحسابات"],
      ["expense_categories", "بنود المصاريف"], ["documents", "المستندات"], ["reconciliations", "الجرد"], ["service_templates", "قوالب الخدمات"], ["profiles", "المستخدمون"],
    ];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    for (const [t, label] of tables) {
      const { data } = await supabase.from(t).select("*").limit(50000);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data ?? []), label);
    }
    const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(out), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("نسخة-احتياطية")}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      },
    });
  }

  if (type === "transactions" || type === "receivables") {
    let q = supabase.from("transactions_list").select("*").order("created_at", { ascending: false }).limit(10000);
    if (type === "receivables") q = q.neq("status", "cancelled").gt("remaining", 0);
    const { data } = await q;
    rows = (data ?? []).map((t) => ({
      "الرقم المرجعي": t.ref_no, "العميل": t.client_name, "المعاملة": t.title, "الحالة": TXN_STATUS_LABEL[t.status],
      "الموظف المسؤول": t.assignee_name ?? "", "سجّلها": t.created_by_name ?? "", "الرسوم الحكومية": Number(t.govt_fees), "أتعاب المكتب": Number(t.office_fee),
      "الخصم": Number(t.discount), "الإجمالي": Number(t.total), "المدفوع": Number(t.paid), "المتبقي": Number(t.remaining),
      "حالة الدفع": PAY_STATUS_LABEL[t.payment_status], "تاريخ الإنشاء": d(t.created_at),
    }));
    name = type === "receivables" ? "المستحقات" : "المعاملات";
  } else if (type === "clients") {
    const [{ data: c }, { data: owing }] = await Promise.all([
      supabase.from("clients").select("name,kind,phone,email,created_at").is("deleted_at", null).order("name"),
      supabase.from("transactions_list").select("client_name,remaining").neq("status", "cancelled").gt("remaining", 0),
    ]);
    const due = new Map<string, number>();
    (owing ?? []).forEach((r) => due.set(r.client_name, (due.get(r.client_name) ?? 0) + Number(r.remaining)));
    rows = (c ?? []).map((x) => ({ "الاسم": x.name, "النوع": x.kind === "company" ? "شركة" : "فرد", "الهاتف": x.phone ?? "", "البريد": x.email ?? "", "المستحق": due.get(x.name) ?? 0, "تاريخ الإضافة": d(x.created_at) }));
    name = "العملاء";
  } else if (type === "ledger") {
    if (!s.perms.has("treasury.view")) return new NextResponse("Forbidden", { status: 403 });
    const { data } = await supabase
      .from("ledger_entries")
      .select("occurred_at,direction,kind,amount,method,description,voided_at,accounts(name),expense_categories(name),transactions(ref_no)")
      .order("occurred_at", { ascending: false }).limit(20000);
    rows = (data ?? []).map((l) => {
      const x = l as unknown as { accounts: { name: string } | null; expense_categories: { name: string } | null; transactions: { ref_no: string } | null } & typeof l;
      return {
        "التاريخ": d(x.occurred_at), "الحساب": x.accounts?.name ?? "", "النوع": LEDGER_KIND_LABEL[x.kind],
        "البند": x.expense_categories?.name ?? "", "الاتجاه": x.direction === "in" ? "وارد" : "صادر", "المبلغ": Number(x.amount),
        "الوسيلة": x.method ? METHOD_LABEL[x.method] : "", "المعاملة": x.transactions?.ref_no ?? "", "الوصف": x.description ?? "", "ملغاة": x.voided_at ? "نعم" : "",
      };
    });
    name = "حركات الخزينة";
  } else if (type === "report") {
    if (!s.perms.has("reports.view")) return new NextResponse("Forbidden", { status: 403 });
    const { data } = await supabase.rpc("monthly_summary", { p_months: 12 });
    rows = ((data ?? []) as { month: string; income: number; govt_paid: number; expenses: number; office_net: number }[]).map((m) => ({
      "الشهر": m.month.slice(0, 7), "الوارد": Number(m.income), "رسوم حكومية مدفوعة": Number(m.govt_paid), "مصاريف تشغيلية": Number(m.expenses), "صافي الأتعاب": Number(m.office_net),
    }));
    name = "تقرير الأرباح";
  } else {
    return new NextResponse("Bad request", { status: 400 });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] ?? { a: 1 }).map((k) => ({ wch: Math.max(12, k.length + 4) }));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    },
  });
}
