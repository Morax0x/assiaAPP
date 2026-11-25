"use server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import {
  BUCKET_LABEL, LEDGER_KIND_LABEL, METHOD_LABEL, PAY_STATUS_LABEL, TXN_STATUS_LABEL,
} from "@/lib/permissions";
import { fmtDate, money } from "@/lib/utils";

export type Tone = "ok" | "warn" | "bad" | "mute" | "navy" | "orange";
export type SmartItem = { id: string; title: string; sub?: string; meta?: string; badge?: { label: string; tone: Tone }; href: string };
export type SmartSection = { key: string; title: string; count: number; items: SmartItem[] };
export type SmartResult = { chips: string[]; answers: string[]; sections: SmartSection[]; empty: boolean };

/* ---------- Arabic normalisation ---------- */
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const norm = (s: string) =>
  s.replace(/[ً-ٰٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).toLowerCase();

const STOP = new Set(("لي لنا لك عن من في على الى الي مع هل ما ماهي ماهو كم وين اين ابي ابغي ابغا اريد ابحث ابحثلي اعرض اعرضلي اعطني اعطيني " +
  "هات جيب جبلي طلع طلعلي اظهر اظهرلي كل جميع الكل كلهم عند عندي عندهم الي اللي التي الذي هذا هذه ذلك و او ثم بس فقط يوجد موجود موجوده هي هو").split(" ").map(norm));

const stem = (t: string) => (t.length > 4 && t.startsWith("ال") ? t.slice(2) : t);
const has = (toks: string[], words: string[]) => toks.some((t) => words.includes(t));
const DOC_WORDS = ["مستند", "مستندات", "وثيقه", "وثائق", "وثايق", "ملف", "ملفات", "اوراق", "ورقه", "رخصه", "رخص", "اقامه", "اقامات", "جواز", "جوازات", "هويه", "هويات", "وكاله", "وكالات", "تامين", "عقد", "عقود", "ايجار"];
const TXN_WORDS = ["معامله", "معاملات", "فاتوره", "فواتير", "طلب", "طلبات", "مهمه", "مهام", "ايصال", "ايصالات"];
const CLIENT_WORDS = ["عميل", "عملاء", "زبون", "زبائن"];
const MONEY_WORDS = ["رصيد", "ارصده", "كاش", "نقد", "نقدي", "نقدا", "بطاقه", "بنك", "بنكي", "مصاريف", "مصروف", "مصروفات", "ايراد", "ايرادات", "وارد", "صادر", "ربح", "ارباح", "صندوق", "حركه", "حركات", "خزينه", "رواتب", "كهرباء", "ضيافه", "مشتريات", "تحويل", "تحويلات", "جرد"];
const EXPIRE_WORDS = ["تنتهي", "ينتهي", "انتهت", "انتهى", "منتهي", "منتهيه", "منتهين", "قريب", "قريبه", "قرب", "تجديد", "تجدد", "صلاحيه", "اوشكت", "توشك"];
const DEBT_WORDS = ["اجل", "آجل", "مستحق", "مستحقه", "مستحقات", "متبقي", "متبقيه", "باقي", "ديون", "دين", "عليهم", "عليه", "غير مدفوعه"];
const STATUS_WORDS: Record<string, string> = {
  جديده: "new", جديد: "new", قيد: "in_progress", جاريه: "in_progress", جاري: "in_progress", بانتظار: "awaiting_docs", ناقصه: "awaiting_docs",
  مكتمله: "completed", مكتمل: "completed", منجزه: "completed", منجز: "completed", خلصت: "completed", تمت: "completed", ملغاه: "cancelled", ملغي: "cancelled", الغيت: "cancelled",
};

function dayAdd(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Range = { from: string; to: string; label: string };
function parseRange(q: string, forward: boolean): Range | null {
  const now = new Date();
  const today = iso(now);
  const y = now.getFullYear(), m = now.getMonth();
  const monthRange = (yy: number, mm: number, label: string): Range => ({ from: iso(new Date(Date.UTC(yy, mm, 1))), to: iso(new Date(Date.UTC(yy, mm + 1, 0))), label });
  let r: RegExpMatchArray | null;
  if ((r = q.match(/(?:خلال|بعد|في ال|اخر|ال)\s*(\d+)\s*(يوم|ايام|اسبوع|اسابيع|شهر|اشهر|شهور)/))) {
    const n = Number(r[1]); const unit = r[2];
    const days = /يوم|ايام/.test(unit) ? n : /اسبوع|اسابيع/.test(unit) ? n * 7 : n * 30;
    return forward ? { from: today, to: iso(dayAdd(now, days)), label: `خلال ${n} ${unit}` } : { from: iso(dayAdd(now, -days)), to: today, label: `آخر ${n} ${unit}` };
  }
  if (/الشهر الماضي|الشهر الفائت|الشهر السابق/.test(q)) return monthRange(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, "الشهر الماضي");
  if (/الشهر القادم|الشهر الجاي|الشهر الجايي/.test(q)) return monthRange(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, "الشهر القادم");
  if (/هذا الشهر|هالشهر|الشهر الحالي|هذي الشهر|الشهر هذا/.test(q)) return monthRange(y, m, "هذا الشهر");
  if (/هذه السنه|هذي السنه|هالسنه|السنه الحاليه|هذا العام/.test(q)) return { from: `${y}-01-01`, to: `${y}-12-31`, label: "هذه السنة" };
  if (/الاسبوع الماضي/.test(q)) return { from: iso(dayAdd(now, -7)), to: today, label: "الأسبوع الماضي" };
  if (/هذا الاسبوع|هالاسبوع|الاسبوع الحالي|الاسبوع القادم|الاسبوع الجاي/.test(q)) return forward ? { from: today, to: iso(dayAdd(now, 7)), label: "هذا الأسبوع" } : { from: iso(dayAdd(now, -((now.getDay() + 1) % 7))), to: today, label: "هذا الأسبوع" };
  if (/\bامس\b|البارح/.test(q)) return { from: iso(dayAdd(now, -1)), to: iso(dayAdd(now, -1)), label: "أمس" };
  if (/\bاليوم\b|الحين/.test(q)) return { from: today, to: today, label: "اليوم" };
  return null;
}

export async function smartSearch(raw: string): Promise<SmartResult> {
  const s = await getSession();
  const out: SmartResult = { chips: [], answers: [], sections: [], empty: true };
  if (!s) return out;
  const text = raw.trim().slice(0, 200);
  if (text.length < 2) return out;
  const supabase = await createClient();
  const canTreasury = s.perms.has("treasury.view");
  const canReports = s.perms.has("reports.view");

  const q = norm(text);
  const origTokens = text.split(/\s+/);
  const normTokens = origTokens.map((t) => stem(norm(t)));
  const used = new Array(normTokens.length).fill(false);
  const mark = (words: string[]) => normTokens.forEach((t, i) => { if (words.includes(t)) used[i] = true; });

  const wantsDocs = has(normTokens, DOC_WORDS);
  const wantsTxn = has(normTokens, TXN_WORDS);
  const wantsClients = has(normTokens, CLIENT_WORDS);
  const wantsMoney = has(normTokens, MONEY_WORDS);
  const expireIntent = has(normTokens, EXPIRE_WORDS);
  const expiredOnly = has(normTokens, ["انتهت", "انتهى", "منتهي", "منتهيه", "منتهين"]);
  const debtIntent = has(normTokens, DEBT_WORDS) || /غير مدفوع/.test(q);
  const partialIntent = has(normTokens, ["جزئي", "جزئيا", "جزئيه"]);
  const paidIntent = !debtIntent && has(normTokens, ["مدفوعه", "مدفوع", "مسدد", "مسدده", "سددت"]);
  const status = normTokens.map((t) => STATUS_WORDS[t]).find(Boolean);
  const hasStatusWord = !!status && !(expireIntent && status === "completed");

  [DOC_WORDS, TXN_WORDS, CLIENT_WORDS, MONEY_WORDS, EXPIRE_WORDS, DEBT_WORDS].forEach(mark);
  normTokens.forEach((t, i) => { if (STATUS_WORDS[t] || ["جزئي", "جزئيا", "مدفوعه", "مدفوع", "مسدد", "غير"].includes(t)) used[i] = true; });

  // Document type (by name)
  const { data: types } = await supabase.from("document_types").select("id,name");
  const matchedType = wantsMoney && !wantsDocs ? undefined : (types ?? []).find((t) => {
    const n = norm(t.name);
    const first = n.split(" ")[0];
    const pre = first.slice(0, Math.max(3, first.length - 1));
    return q.includes(n) || (first.length >= 3 && normTokens.some((x) => x === first || x.startsWith(pre)));
  });
  if (matchedType) {
    const first = norm(matchedType.name).split(" ")[0];
    const pre = first.slice(0, Math.max(3, first.length - 1));
    normTokens.forEach((t, i) => { if (t === first || t.startsWith(pre) || norm(matchedType.name).split(" ").includes(t)) used[i] = true; });
  }

  // Dates
  const forward = expireIntent || wantsDocs;
  const range = parseRange(q, forward && !wantsMoney && !wantsTxn);
  const amountMore = q.match(/(?:اكثر من|فوق|اعلى من|يزيد عن)\s*(\d+(?:\.\d+)?)/);
  const amountLess = q.match(/(?:اقل من|دون|تحت|ينقص عن)\s*(\d+(?:\.\d+)?)/);
  // numbers & date phrases are not name terms
  normTokens.forEach((t, i) => {
    if (/^\d+(\.\d+)?$/.test(t) || ["خلال", "بعد", "الشهر", "الماضي", "الفائت", "القادم", "الحالي", "هذا", "هذه", "هذي", "السنه", "الاسبوع", "اليوم", "امس", "ايام", "يوم", "اسبوع", "شهر", "اشهر", "اكثر", "اقل", "فوق", "تحت", "دون", "اخر", "الجاي"].includes(t)) used[i] = true;
  });

  const terms = origTokens.filter((_, i) => !used[i] && !STOP.has(normTokens[i]) && normTokens[i].length >= 2);
  const term = terms.join(" ").replace(/[%,()*"\\]/g, " ").replace(/\s+/g, " ").trim();
  const like = term ? `%${term}%` : "";
  const likeQ = `"${like}"`; // quoted for PostgREST or() filters

  const anyIntent = wantsDocs || wantsTxn || wantsClients || wantsMoney || expireIntent || debtIntent || hasStatusWord || partialIntent || paidIntent || !!matchedType;

  // chips: what was understood
  if (matchedType) out.chips.push(`نوع المستند: ${matchedType.name}`);
  if (expireIntent) out.chips.push(expiredOnly ? "المنتهية" : "القريبة من الانتهاء");
  if (hasStatusWord) out.chips.push(`الحالة: ${TXN_STATUS_LABEL[status!]}`);
  if (debtIntent) out.chips.push("غير مسددة بالكامل");
  if (partialIntent) out.chips.push("مدفوعة جزئياً");
  if (paidIntent) out.chips.push("مدفوعة بالكامل");
  if (range) out.chips.push(range.label);
  if (amountMore) out.chips.push(`أكثر من ${amountMore[1]}`);
  if (amountLess) out.chips.push(`أقل من ${amountLess[1]}`);
  if (term) out.chips.push(`الاسم/النص: ${term}`);

  const runDocs = wantsDocs || expireIntent || !!matchedType || !anyIntent;
  const runTxn = wantsTxn || hasStatusWord || debtIntent || partialIntent || paidIntent || !anyIntent || (wantsClients && debtIntent);
  const runClients = wantsClients || !anyIntent || (!!term && !wantsDocs && !wantsTxn && !wantsMoney);
  const runMoney = wantsMoney && (canTreasury || canReports);
  const BAL = ["رصيد", "ارصده", "كاش", "نقد", "نقدي", "نقدا", "بطاقه", "بنك", "بنكي", "صندوق"];
  const moneyToks = normTokens.filter((t) => MONEY_WORDS.includes(t));
  const balanceOnly = moneyToks.length > 0 && moneyToks.every((t) => BAL.includes(t)) && !range && !term;

  // Matching client ids for free text (used for docs/ledger)
  let clientIds: string[] = [];
  if (term) {
    const { data } = await supabase.from("clients").select("id").is("deleted_at", null).or(`name.ilike.${likeQ},phone.ilike.${likeQ},email.ilike.${likeQ}`).limit(60);
    clientIds = (data ?? []).map((c) => c.id);
  }

  /* ---- Clients ---- */
  if (runClients) {
    let cq = supabase.from("clients").select("id,name,kind,phone,email", { count: "exact" }).is("deleted_at", null).order("name").limit(25);
    if (term) cq = cq.or(`name.ilike.${likeQ},phone.ilike.${likeQ},email.ilike.${likeQ}`);
    const { data, count } = await cq;
    let items: SmartItem[] = (data ?? []).map((c) => ({
      id: c.id, title: c.name, sub: [c.phone, c.email].filter(Boolean).join(" · ") || undefined,
      badge: { label: c.kind === "company" ? "شركة" : "فرد", tone: "mute" as Tone }, href: `/clients/${c.id}`,
    }));
    // debtors only
    if (wantsClients && debtIntent) {
      const { data: owing } = await supabase.from("transactions_list").select("client_id,remaining").neq("status", "cancelled").gt("remaining", 0);
      const due = new Map<string, number>();
      (owing ?? []).forEach((r) => due.set(r.client_id, (due.get(r.client_id) ?? 0) + Number(r.remaining)));
      const { data: all } = await supabase.from("clients").select("id,name,phone").is("deleted_at", null).in("id", [...due.keys()].slice(0, 200));
      items = (all ?? []).filter((c) => !term || c.name.toLowerCase().includes(term.toLowerCase()))
        .map((c) => ({ id: c.id, title: c.name, sub: c.phone ?? undefined, badge: { label: `مستحق ${money(due.get(c.id) ?? 0)}`, tone: "bad" as Tone }, href: `/clients/${c.id}` }))
        .sort((a, b) => (due.get(b.id) ?? 0) - (due.get(a.id) ?? 0));
      const total = items.reduce((a, i) => a + (due.get(i.id) ?? 0), 0);
      out.answers.push(`عدد العملاء المدينين: ${items.length} — إجمالي المستحق ${money(total)}`);
      out.sections.push({ key: "clients", title: "العملاء", count: items.length, items: items.slice(0, 25) });
    } else if (items.length) {
      out.sections.push({ key: "clients", title: "العملاء", count: count ?? items.length, items });
    }
  }

  /* ---- Transactions ---- */
  if (runTxn) {
    let tq = supabase.from("transactions_list").select("id,ref_no,title,client_name,status,total,paid,remaining,payment_status,created_at", { count: "exact" })
      .order("created_at", { ascending: false }).limit(25);
    if (term) tq = tq.or(`ref_no.ilike.${likeQ},title.ilike.${likeQ},client_name.ilike.${likeQ}`);
    if (hasStatusWord) tq = tq.eq("status", status!);
    if (debtIntent) tq = tq.neq("status", "cancelled").gt("remaining", 0);
    if (partialIntent) tq = tq.eq("payment_status", "partial");
    if (paidIntent) tq = tq.eq("payment_status", "paid");
    if (range && !expireIntent) tq = tq.gte("created_at", range.from).lte("created_at", range.to + "T23:59:59");
    if (amountMore) tq = tq.gt("total", Number(amountMore[1]));
    if (amountLess) tq = tq.lt("total", Number(amountLess[1]));
    const { data, count } = await tq;
    if (data?.length) {
      out.sections.push({
        key: "transactions", title: "المعاملات", count: count ?? data.length,
        items: data.map((t) => ({
          id: t.id, title: t.title, sub: `${t.client_name} · ${t.ref_no}`, meta: money(t.total),
          badge: { label: Number(t.remaining) > 0 && t.status !== "cancelled" ? `متبقي ${money(t.remaining)}` : PAY_STATUS_LABEL[t.payment_status], tone: (t.payment_status === "paid" ? "ok" : t.payment_status === "partial" ? "warn" : "bad") as Tone },
          href: `/transactions/${t.id}`,
        })),
      });
      if (debtIntent) {
        let aq = supabase.from("transactions_list").select("remaining").neq("status", "cancelled").gt("remaining", 0);
        if (term) aq = aq.or(`ref_no.ilike.${likeQ},title.ilike.${likeQ},client_name.ilike.${likeQ}`);
        const { data: all } = await aq;
        out.answers.push(`إجمالي المستحق المطابق: ${money((all ?? []).reduce((a, r) => a + Number(r.remaining), 0))}`);
      }
    }
  }

  /* ---- Documents ---- */
  if (runDocs) {
    let dq = supabase.from("document_center").select("id,client_id,client_name,type_name,title,expiry_date,days_left,bucket", { count: "exact" }).order("expiry_date").limit(25);
    if (term) dq = clientIds.length ? dq.or(`title.ilike.${likeQ},client_id.in.(${clientIds.join(",")})`) : dq.ilike("title", like);
    if (matchedType) dq = dq.eq("type_id", matchedType.id);
    if (expireIntent) {
      if (expiredOnly) dq = dq.lt("days_left", 0);
      else if (range) dq = dq.gte("expiry_date", range.from).lte("expiry_date", range.to);
      else dq = dq.lte("days_left", 30);
    } else if (range && forward) dq = dq.gte("expiry_date", range.from).lte("expiry_date", range.to);
    const { data, count } = await dq;
    let items: SmartItem[] = (data ?? []).map((d) => ({
      id: d.id, title: d.title, sub: `${d.client_name} · ${d.type_name}`, meta: d.expiry_date ? `ينتهي ${fmtDate(d.expiry_date)}` : undefined,
      badge: { label: BUCKET_LABEL[d.bucket], tone: (d.bucket === "expired" ? "bad" : d.bucket === "critical" ? "warn" : d.bucket === "upcoming" ? "navy" : "ok") as Tone },
      href: d.bucket === "valid" || d.bucket === "upcoming" ? `/clients/${d.client_id}` : "/alerts",
    }));
    // documents without an expiry date are searchable too (plain files)
    if (!expireIntent && !range) {
      let pq = supabase.from("documents").select("id,client_id,title,mime_type,document_types(name),clients(name)").is("deleted_at", null).eq("is_current", true).is("expiry_date", null).limit(15);
      if (term) pq = clientIds.length ? pq.or(`title.ilike.${likeQ},client_id.in.(${clientIds.join(",")})`) : pq.ilike("title", like);
      if (matchedType) pq = pq.eq("type_id", matchedType.id);
      const { data: plain } = await pq;
      items = items.concat((plain ?? []).map((d) => {
        const x = d as unknown as { document_types: { name: string } | null; clients: { name: string } | null };
        return { id: d.id, title: d.title, sub: `${x.clients?.name ?? ""} · ${x.document_types?.name ?? ""}`, badge: { label: "بدون تاريخ انتهاء", tone: "mute" as Tone }, href: `/clients/${d.client_id}` };
      }));
    }
    if (items.length) out.sections.push({ key: "documents", title: "المستندات", count: (count ?? 0) + (items.length - (data?.length ?? 0)), items });
  }

  /* ---- Money ---- */
  if (runMoney) {
    if (canTreasury && has(normTokens, ["رصيد", "ارصده", "كاش", "نقد", "نقدي", "نقدا", "بطاقه", "بنك", "بنكي", "صندوق"])) {
      const { data: bal } = await supabase.from("account_balances").select("name,kind,balance");
      const wantCash = has(normTokens, ["كاش", "نقد", "نقدي", "نقدا", "صندوق"]);
      const wantBank = has(normTokens, ["بطاقه", "بنك", "بنكي"]);
      (bal ?? []).filter((b) => (!wantCash && !wantBank) || (wantCash && b.kind === "cash") || (wantBank && b.kind === "bank"))
        .forEach((b) => out.answers.push(`${b.name}: ${money(b.balance)}`));
    }
    if (canTreasury && !balanceOnly) {
      let lq = supabase.from("ledger_entries")
        .select("id,direction,kind,amount,method,occurred_at,description,accounts(name),expense_categories(name),transactions(id,ref_no)", { count: "exact" })
        .is("voided_at", null).order("occurred_at", { ascending: false }).limit(25);
      const catHit = term ? (await supabase.from("expense_categories").select("id,name").ilike("name", like)).data ?? [] : [];
      if (term) lq = catHit.length ? lq.or(`description.ilike.${likeQ},category_id.in.(${catHit.map((c) => c.id).join(",")})`) : lq.ilike("description", like);
      if (has(normTokens, ["مصاريف", "مصروف", "مصروفات"])) lq = lq.eq("kind", "expense");
      if (has(normTokens, ["رواتب", "كهرباء", "ضيافه", "مشتريات"])) {
        const names: Record<string, string> = { رواتب: "رواتب", كهرباء: "كهرباء", ضيافه: "ضيافة", مشتريات: "مشتريات" };
        const word = normTokens.find((t) => names[t]);
        const { data: cats } = await supabase.from("expense_categories").select("id").ilike("name", `%${names[word!]}%`);
        if (cats?.length) lq = lq.in("category_id", cats.map((c) => c.id)).eq("kind", "expense");
      }
      if (has(normTokens, ["تحويل", "تحويلات"])) lq = lq.eq("kind", "transfer");
      if (has(normTokens, ["ايراد", "ايرادات", "وارد"])) lq = lq.eq("kind", "client_payment");
      if (range) lq = lq.gte("occurred_at", range.from).lte("occurred_at", range.to + "T23:59:59");
      if (amountMore) lq = lq.gt("amount", Number(amountMore[1]));
      if (amountLess) lq = lq.lt("amount", Number(amountLess[1]));
      const { data, count } = await lq;
      if (data?.length) {
        const rows = data as unknown as { id: string; direction: string; kind: string; amount: number; method: string | null; occurred_at: string; description: string | null; accounts: { name: string } | null; expense_categories: { name: string } | null; transactions: { id: string; ref_no: string } | null }[];
        const tin = rows.filter((r) => r.kind !== "transfer" && r.direction === "in").reduce((a, r) => a + Number(r.amount), 0);
        const tout = rows.filter((r) => r.kind !== "transfer" && r.direction === "out").reduce((a, r) => a + Number(r.amount), 0);
        if ((count ?? 0) <= 25) out.answers.push(`الحركات المطابقة: وارد ${money(tin)} — صادر ${money(tout)}`);
        out.sections.push({
          key: "ledger", title: "حركات الخزينة", count: count ?? rows.length,
          items: rows.map((r) => ({
            id: r.id, title: r.kind === "expense" ? r.expense_categories?.name ?? "مصروف" : LEDGER_KIND_LABEL[r.kind],
            sub: `${fmtDate(r.occurred_at)} · ${r.accounts?.name ?? ""}${r.method ? ` · ${METHOD_LABEL[r.method]}` : ""}${r.description ? ` · ${r.description}` : ""}`,
            meta: `${r.direction === "in" ? "+" : "−"}${money(r.amount)}`,
            badge: { label: r.kind === "transfer" ? "تحويل" : r.direction === "in" ? "وارد" : "صادر", tone: (r.kind === "transfer" ? "navy" : r.direction === "in" ? "ok" : "bad") as Tone },
            href: r.transactions ? `/transactions/${r.transactions.id}` : "/treasury",
          })),
        });
      }
    }
  }

  out.empty = out.sections.length === 0 && out.answers.length === 0;
  return out;
}
