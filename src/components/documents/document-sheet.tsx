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
  const { lang, office: o } = d;
  const rtl = lang !== "en";
  const isQuote = d.kind === "quote";
  const showBank = d.kind === "invoice" && (d.remaining ?? 0) > 0 && (o.iban || o.bank_account_no);
  const desc = (i: SheetItem) => (lang === "en" ? i.description_en || i.description : lang === "ar" ? i.description : null);

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      className="relative mx-auto flex w-[210mm] min-h-[297mm] flex-col overflow-hidden text-[#111827] print:shadow-none"
      style={{ background: "linear-gradient(160deg,#f6f7f9 0%,#eceef2 100%)", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      {/* decorative header wave + logo (from the office's own invoice design) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/header.png" alt="" className="pointer-events-none absolute" style={{ top: "-16.6mm", left: "-1mm", width: "218mm", transform: "scaleX(-1)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-full.png" alt="" className="absolute" style={{ right: "-0.3mm", top: "1.4mm", width: "76mm" }} />

      <div className="relative flex flex-1 flex-col px-[14mm] pb-[8mm]" style={{ paddingTop: "62mm" }}>
        <div className="text-center">
          {lang !== "en" && <div className="text-[34px] font-extrabold tracking-wide">{TITLES[d.kind].ar}</div>}
          {lang !== "ar" && <div className={`font-extrabold tracking-wide ${lang === "en" ? "text-[44px]" : "text-[40px]"}`} dir="ltr">{TITLES[d.kind].en}</div>}
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
                  <td className="py-2.5 pe-2">{desc(i)}{lang === "both" && <><div>{i.description}</div>{i.description_en && <div className="text-[11px] opacity-70" dir="ltr">{i.description_en}</div>}</>}</td>
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
            {showBank && (
              <div className="mb-4 space-y-1" dir="ltr" style={{ textAlign: "left" }}>
                <div className="text-[12px] font-extrabold tracking-wide">FOR BANK TRANSFER</div>
                {o.bank_name && <div>Bank: <b>{o.bank_name}</b></div>}
                {o.bank_account_name && <div>Account Name: <b>{o.bank_account_name}</b></div>}
                {o.iban && <div>IBAN: <b>{o.iban}</b></div>}
                {o.bank_account_no && <div>Account Number: <b>{o.bank_account_no}</b></div>}
              </div>
            )}
            <div className="text-[12px] font-extrabold tracking-[0.12em]" dir="ltr">{o.invoice_footer ? o.invoice_footer : "THANK YOU FOR YOUR BUSINESS"}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/stamp.png" alt="" style={{ width: "36mm", height: "auto" }} />
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-center gap-x-5 gap-y-1 bg-[#164a8f] px-[10mm] py-[3.2mm] text-[11.5px] text-white" dir="ltr">
        {o.phone && <span className="flex items-center gap-1.5"><Phone className="size-3.5" />{o.phone}</span>}
        {o.website && <span className="flex items-center gap-1.5"><Globe className="size-3.5" />{o.website}</span>}
        {o.email && <span className="flex items-center gap-1.5"><Mail className="size-3.5" />{o.email}</span>}
        {o.address && <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{o.address}</span>}
      </div>
    </div>
  );
}

function Meta({ lang, ar, en, v }: { lang: Lang; ar: string; en: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium tracking-wide"><T ar={ar} en={en} lang={lang} />:</dt>
      <dd className="min-w-[24mm] font-semibold num">{v}</dd>
    </div>
  );
}
function Th({ lang, ar, en, w, c, end }: { lang: Lang; ar: string; en: string; w?: string; c?: boolean; end?: boolean }) {
  return <th style={{ width: w }} className={`py-2.5 font-extrabold ${c ? "text-center" : end ? "text-end" : "text-start"}`}><T ar={ar} en={en} lang={lang} /></th>;
}
function Row({ lang, ar, en, v, strong }: { lang: Lang; ar: string; en: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-0.5 ${strong ? "text-[15px] font-extrabold text-[#1d4f91]" : "text-[13px]"}`}>
      <span><T ar={ar} en={en} lang={lang} /></span><span className="num">{v}</span>
    </div>
  );
}
