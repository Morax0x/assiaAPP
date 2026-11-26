import { Globe, Mail, MapPin, Phone } from "lucide-react";

export type Lang = "ar" | "en" | "both";
export type SheetOffice = {
  office_name: string | null; phone: string | null; email: string | null; website: string | null; address: string | null;
  bank_name: string | null; bank_account_name: string | null; iban: string | null; bank_account_no: string | null;
  invoice_footer: string | null; quote_terms: string | null; tax_number: string | null;
};
export type SheetItem = { date?: string | null; description: string; description_en?: string | null; qty: number; price: number };
export type SheetData = {
  kind: "invoice" | "receipt" | "quote"; lang: Lang; office: SheetOffice;
  party: { name: string; phone?: string | null };
  number: string; date: string; validUntil?: string | null;
  items: SheetItem[]; discount: number; total: number; paid?: number; remaining?: number;
  paymentStatus?: { ar: string; en: string }; methods?: { ar: string; en: string } | null;
  payments?: { date: string; method: { ar: string; en: string }; ref: string | null; amount: number }[];
  notes?: string | null; sourceRef?: string | null; draft?: boolean;
};

const fmt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
const dmy = (d: string | null | undefined) => { if (!d) return ""; const x = new Date(d); return isNaN(x.getTime()) ? "" : `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`; };
const ymd = (d: string | null | undefined) => { if (!d) return ""; const x = new Date(d); return isNaN(x.getTime()) ? "" : `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")}`; };

const TITLES = {
  invoice: { ar: "فاتورة", en: "INVOICE" },
  receipt: { ar: "إيصال استلام", en: "RECEIPT" },
  quote: { ar: "عرض سعر", en: "QUOTATION" },
};

function T({ ar, en, lang, className }: { ar: string; en: string; lang: Lang; className?: string }) {
  if (lang === "ar") return <span className={className}>{ar}</span>;
  if (lang === "en") return <span className={className}>{en}</span>;
  return <span className={className}>{ar} <span className="text-[0.82em] opacity-75" dir="ltr">{en}</span></span>;
}

/** The office's official A4 document (invoice / receipt / quotation) in Arabic, English, or both. */
export function DocumentSheet({ d }: { d: SheetData }) {
  const { office: o } = d;
  const lang: Lang = d.lang === "en" ? "en" : "ar"; // one language per document
  const rtl = lang !== "en";
  const isQuote = d.kind === "quote";
  const showBank = isQuote || (d.kind === "invoice" && (d.remaining ?? 0) > 0);
  const desc = (i: SheetItem) => (lang === "en" ? i.description_en || i.description : lang === "ar" ? i.description : null);

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      className="sheet relative mx-auto flex w-[210mm] min-h-[297mm] flex-col overflow-hidden text-[#111827] print:shadow-none"
      style={{ backgroundColor: "#f1f1f1", backgroundImage: "url(/brand/background.jpg)", backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      {/* the office's own letterhead is the page background (wave on top, contact bar at the bottom); the logo sits under the wave */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-full.png" alt="" className="absolute" style={{ right: "6mm", top: "9mm", width: "56mm" }} />

      <div className="relative flex flex-1 flex-col px-[14mm] pb-[18mm]" style={{ paddingTop: "60mm" }}>
        <div className="text-center">
          {lang === "ar" && <div className="f-kufi-bold text-[34px] tracking-wide">{TITLES[d.kind].ar}</div>}
          {lang === "en" && <div className={`f-garet tracking-wide ${lang === "en" ? "text-[44px]" : "text-[40px]"}`} dir="ltr">{TITLES[d.kind].en}</div>}
          {d.draft && <div className="mt-1 text-sm font-semibold text-[#f15a27]">{lang === "en" ? "DRAFT" : "مسودة"}</div>}
        </div>

        <div className="mt-6 flex items-start justify-between gap-6 text-[13px] leading-6">
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-wide"><T ar={isQuote ? "مقدّم إلى" : "السيد / السادة"} en={isQuote ? "PREPARED FOR" : "ISSUED TO"} lang={lang} /></div>
            <div className="mt-1 text-[15px] font-bold text-[#1d4f91]">{d.party.name}</div>
            {d.party.phone && <div className="text-xs"><T ar="الهاتف" en="PH. Number" lang={lang} />: <b className="text-[#1d4f91]" dir="ltr">{d.party.phone}</b></div>}
          </div>
          <dl className="space-y-0.5 text-[12.5px]">
            <Meta lang={lang} ar={isQuote ? "رقم العرض" : d.kind === "receipt" ? "رقم الإيصال" : "رقم الفاتورة"} en={isQuote ? "QUOTE NO" : d.kind === "receipt" ? "RECEIPT NO" : "INVOICE NO"} v={d.number} />
            <Meta lang={lang} ar="التاريخ" en="DATE" v={dmy(d.date)} />
            {isQuote && d.validUntil && <Meta lang={lang} ar="صالح حتى" en="VALID UNTIL" v={dmy(d.validUntil)} />}
            {d.kind === "invoice" && <>
              <Meta lang={lang} ar="حالة الدفع" en="PAYMENT STATUS" v={d.paymentStatus ? (lang === "en" ? d.paymentStatus.en : d.paymentStatus.ar) : ""} />
              <Meta lang={lang} ar="طريقة الدفع" en="PAYMENT METHOD" v={d.methods ? (lang === "en" ? d.methods.en : d.methods.ar) : ""} />
              <Meta lang={lang} ar="المبلغ المتبقي" en="BALANCE DUE" v={d.remaining ? `AED ${fmt(d.remaining)}` : ""} />
            </>}
            {d.sourceRef && <Meta lang={lang} ar="بناءً على" en="REF" v={d.sourceRef} />}
          </dl>
        </div>

        <div className="mt-6 rounded-xl bg-white/70 px-4 py-2">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-y border-[#374151] text-[#1d4f91]">
                {d.kind !== "receipt" ? (
                  <>
                    <Th lang={lang} ar="التاريخ" en="DATE" w="16%" /><Th lang={lang} ar="الوصف" en="DESCRIPTION" /><Th lang={lang} ar="السعر" en="PRICE" w="13%" c /><Th lang={lang} ar="الكمية" en="QTY" w="9%" c /><Th lang={lang} ar="المبلغ" en="AMOUNT" w="14%" end />
                  </>
                ) : (
                  <>
                    <Th lang={lang} ar="التاريخ" en="DATE" w="18%" /><Th lang={lang} ar="طريقة الدفع" en="METHOD" /><Th lang={lang} ar="رقم المرجع" en="REFERENCE" w="25%" c /><Th lang={lang} ar="المبلغ" en="AMOUNT" w="16%" end />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {d.kind !== "receipt" ? d.items.map((i, k) => (
                <tr key={k} className="align-top">
                  <td className="py-2.5 num text-[12px]">{ymd(i.date)}</td>
                  <td className="py-2.5 pe-2">{desc(i)}</td>
                  <td className="py-2.5 text-center num">{fmt(i.price)}</td>
                  <td className="py-2.5 text-center num">{fmt(i.qty)}</td>
                  <td className="py-2.5 text-end num">{fmt(i.qty * i.price)}</td>
                </tr>
              )) : (d.payments ?? []).map((p, k) => (
                <tr key={k}>
                  <td className="py-2.5 num">{ymd(p.date)}</td>
                  <td className="py-2.5"><T ar={p.method.ar} en={p.method.en} lang={lang} /></td>
                  <td className="py-2.5 text-center num">{p.ref ?? "—"}</td>
                  <td className="py-2.5 text-end num">{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-[#374151]" />
        </div>

        <div className="mt-5 flex justify-end">
          <div className="min-w-[68mm] rounded-xl bg-white px-4 py-2.5 shadow-sm">
            {d.discount > 0 && <Row lang={lang} ar="الخصم" en="DISCOUNT" v={`− ${fmt(d.discount)}`} />}
            {d.kind === "receipt" ? (
              <>
                <Row lang={lang} ar="إجمالي المستلم" en="TOTAL RECEIVED" v={`AED ${fmt(d.paid ?? 0)}`} strong />
                <Row lang={lang} ar="المتبقي على العميل" en="BALANCE DUE" v={`AED ${fmt(d.remaining ?? 0)}`} />
              </>
            ) : (
              <>
                <Row lang={lang} ar="الإجمالي" en="TOTAL" v={`AED ${fmt(d.total)}`} strong />
                {d.kind === "invoice" && (d.paid ?? 0) > 0 && <Row lang={lang} ar="المدفوع" en="PAID" v={`AED ${fmt(d.paid ?? 0)}`} />}
                {d.kind === "invoice" && (d.remaining ?? 0) > 0 && <Row lang={lang} ar="المتبقي" en="BALANCE DUE" v={`AED ${fmt(d.remaining ?? 0)}`} />}
              </>
            )}
          </div>
        </div>

        {(d.notes || (isQuote && o.quote_terms)) && (
          <div className="mt-5 space-y-1 text-[12px] leading-6 text-[#374151]">
            {d.notes && <p className="whitespace-pre-wrap">{d.notes}</p>}
            {isQuote && o.quote_terms && <p className="whitespace-pre-wrap text-[11.5px] opacity-80">{o.quote_terms}</p>}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-6 pt-8">
          <div className="text-[12.5px]">
            {showBank && lang === "ar" && (o.iban || o.bank_account_no) && (
              <div className="mb-3 space-y-1 text-[13px]" dir="rtl">
                <div className="f-kufi-bold text-[13px]">رقم الحساب البنكي:</div>
                <ul className="list-disc space-y-1 ps-5 marker:text-black">
                  {o.bank_name && <li>المصرف: <b>{o.bank_name}</b></li>}
                  {o.bank_account_name && <li>اسم الحساب: <b>{o.bank_account_name}</b></li>}
                  {o.iban && <li>ايبان الحساب: <b className="f-garet" dir="ltr" style={{ fontWeight: 700 }}>{o.iban}</b></li>}
                  {o.bank_account_no && <li>رقم الحساب: <b className="f-garet" dir="ltr">{o.bank_account_no}</b></li>}
                </ul>
              </div>
            )}
            {showBank && !(lang === "ar" && (o.iban || o.bank_account_no)) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/brand/bank.png" alt="Bank transfer details" className="mb-3" style={{ width: "78mm", height: "auto", mixBlendMode: "multiply" }} />
            )}
            <div className="f-garet text-[12px] tracking-[0.12em]" dir="ltr">{o.invoice_footer ? o.invoice_footer : "THANK YOU FOR YOUR BUSINESS"}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/stamp.webp" alt="" style={{ width: "34mm", height: "auto", mixBlendMode: "multiply" }} />
        </div>
      </div>

    </div>
  );
}

function Meta({ lang, ar, en, v }: { lang: Lang; ar: string; en: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="f-garet tracking-wide"><T ar={ar} en={en} lang={lang} />:</dt>
      <dd className="f-garet min-w-[24mm]">{v}</dd>
    </div>
  );
}
function Th({ lang, ar, en, w, c, end }: { lang: Lang; ar: string; en: string; w?: string; c?: boolean; end?: boolean }) {
  return <th style={{ width: w }} className={`f-garet py-2.5 ${c ? "text-center" : end ? "text-end" : "text-start"}`}><T ar={ar} en={en} lang={lang} /></th>;
}
function Row({ lang, ar, en, v, strong }: { lang: Lang; ar: string; en: string; v: string; strong?: boolean }) {
  return (
    <div className={`f-garet flex items-center justify-between gap-4 py-0.5 ${strong ? "text-[15px] text-[#1d4f91]" : "text-[13px]"}`}>
      <span><T ar={ar} en={en} lang={lang} /></span><span className="num">{v}</span>
    </div>
  );
}
