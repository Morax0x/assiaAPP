import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/layout/logo";
import { PrintButton } from "./print-button";
import { fmtDate, money } from "@/lib/utils";
import { METHOD_LABEL } from "@/lib/permissions";

export const metadata = { title: "فاتورة" };

export default async function PrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const { id } = await params;
  const { type } = await searchParams;
  const isReceipt = type === "receipt";
  await requireSession();
  const supabase = await createClient();
  const [{ data: t }, { data: os }, { data: pays }] = await Promise.all([
    supabase.from("transactions_list").select("*").eq("id", id).maybeSingle(),
    supabase.from("office_settings").select("*").single(),
    supabase.rpc("transaction_payments", { p_txn: id }),
  ]);
  if (!t) notFound();
  const cur = os?.currency ?? "AED";
  const payments = ((pays ?? []) as { id: string; amount: number; method: string; occurred_at: string; voided: boolean }[]).filter((p) => !p.voided);
  const docNo = `${isReceipt ? "RCT" : "INV"}-${t.ref_no.replace("TRX-", "")}`;

  return (
    <div className="min-h-dvh bg-bg py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-3">
        <span className="text-sm text-ink-3">للحفظ كملف PDF اختر «حفظ كـ PDF» من نافذة الطباعة</span>
        <PrintButton />
      </div>
      <div className="print-sheet mx-auto max-w-3xl rounded-card border border-line bg-surface p-8 text-[13px] leading-6">
        <header className="flex items-start justify-between border-b-2 border-navy pb-5">
          <div className="flex items-center gap-3">
            <LogoMark className="size-12" />
            <div>
              <div className="text-lg font-bold text-navy">{os?.office_name ?? "المكتب"}</div>
              {os?.address && <div className="text-xs text-ink-2">{os.address}</div>}
              {os?.phone && <div className="text-xs text-ink-2 num">{os.phone}</div>}
              {os?.tax_number && <div className="text-xs text-ink-2">الرقم الضريبي: <span className="num">{os.tax_number}</span></div>}
            </div>
          </div>
          <div className="text-end">
            <div className="text-xl font-bold">{isReceipt ? "إيصال استلام" : "فاتورة"}</div>
            <div className="mt-1 text-xs text-ink-2">الرقم: <span className="num font-medium">{docNo}</span></div>
            <div className="text-xs text-ink-2">التاريخ: <span className="num">{fmtDate(new Date())}</span></div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-5">
          <div>
            <div className="text-xs text-ink-3">العميل</div>
            <div className="text-base font-semibold">{t.client_name}</div>
            {t.client_phone && <div className="text-xs text-ink-2 num">{t.client_phone}</div>}
          </div>
          <div className="text-end">
            <div className="text-xs text-ink-3">المعاملة</div>
            <div className="font-medium">{t.title}</div>
            <div className="text-xs text-ink-2">المرجع: <span className="num">{t.ref_no}</span></div>
          </div>
        </section>

        {!isReceipt ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-navy text-white">
                <th className="px-3 py-2 text-start font-medium">البيان</th>
                <th className="px-3 py-2 text-end font-medium">المبلغ ({cur})</th>
              </tr>
            </thead>
            <tbody>
              {Number(t.govt_fees) > 0 && <tr className="border-b border-line"><td className="px-3 py-2.5">رسوم حكومية</td><td className="px-3 py-2.5 text-end num">{money(t.govt_fees, "").trim()}</td></tr>}
              {Number(t.office_fee) > 0 && <tr className="border-b border-line"><td className="px-3 py-2.5">أتعاب خدمة</td><td className="px-3 py-2.5 text-end num">{money(t.office_fee, "").trim()}</td></tr>}
              {Number(t.discount) > 0 && <tr className="border-b border-line"><td className="px-3 py-2.5">خصم</td><td className="px-3 py-2.5 text-end num">−{money(t.discount, "").trim()}</td></tr>}
            </tbody>
            <tfoot>
              <tr><td className="px-3 pt-4 text-base font-bold">الإجمالي</td><td className="px-3 pt-4 text-end text-base font-bold num">{money(t.total, cur)}</td></tr>
              <tr><td className="px-3 pt-1 text-ok">المدفوع</td><td className="px-3 pt-1 text-end text-ok num">{money(t.paid, cur)}</td></tr>
              <tr><td className="px-3 pt-1 font-semibold">المتبقي</td><td className="px-3 pt-1 text-end font-semibold num">{money(t.remaining, cur)}</td></tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-navy text-white">
                <th className="px-3 py-2 text-start font-medium">التاريخ</th>
                <th className="px-3 py-2 text-start font-medium">وسيلة الدفع</th>
                <th className="px-3 py-2 text-end font-medium">المبلغ ({cur})</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="px-3 py-2.5 num">{fmtDate(p.occurred_at)}</td>
                  <td className="px-3 py-2.5">{METHOD_LABEL[p.method] ?? ""}</td>
                  <td className="px-3 py-2.5 text-end num">{money(p.amount, "").trim()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2} className="px-3 pt-4 text-base font-bold">إجمالي المستلم</td><td className="px-3 pt-4 text-end text-base font-bold num">{money(t.paid, cur)}</td></tr>
              <tr><td colSpan={2} className="px-3 pt-1">المتبقي على العميل</td><td className="px-3 pt-1 text-end num">{money(t.remaining, cur)}</td></tr>
            </tfoot>
          </table>
        )}

        <footer className="mt-16 flex items-end justify-between text-xs text-ink-2">
          <div>{os?.invoice_footer || "شكراً لتعاملكم معنا"}</div>
          <div className="w-48 border-t border-ink-3 pt-1 text-center">التوقيع / الختم</div>
        </footer>
      </div>
    </div>
  );
}
