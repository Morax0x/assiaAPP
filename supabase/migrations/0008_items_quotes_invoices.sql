-- =====================================================================
-- 0008: line items, quotations, invoice numbering, services catalog, bank details
-- =====================================================================

-- ---------- Office details used on invoices ---------------------------
alter table office_settings
  add column if not exists website text,
  add column if not exists email text,
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists iban text,
  add column if not exists bank_account_no text,
  add column if not exists next_invoice_no int not null default 11110,
  add column if not exists quote_terms text;

-- ---------- Services catalog (bilingual, grouped) ---------------------
alter table service_templates
  add column if not exists name_en text,
  add column if not exists category text;

update service_templates s set name_en = v.en, category = v.cat
from (values
 ('إصدار رخصة تجارية','Issue Trade License','التراخيص التجارية'),
 ('حجز اسم تجاري','Trade Name Reservation','التراخيص التجارية'),
 ('موافقة مبدئية','Initial Approval','التراخيص التجارية'),
 ('تجديد رخصة تجارية','Trade License Renewal','التراخيص التجارية'),
 ('تعديل رخصة','Trade License Amendment','التراخيص التجارية'),
 ('إضافة / سحب شريك','Add / Remove Partner','التراخيص التجارية'),
 ('تغيير الاسم التجاري','Change Trade Name','التراخيص التجارية'),
 ('إلغاء رخصة','Cancel Trade License','التراخيص التجارية'),
 ('تجميد رخصة','Freeze Trade License','التراخيص التجارية'),
 ('تصريح تجاري','Commercial Permit','التراخيص التجارية'),
 ('وكيل خدمات','Service Agent','التراخيص التجارية'),
 ('عضوية الغرفة','Chamber Membership','التراخيص التجارية'),
 ('تسجيل علامة تجارية','Trademark Registration','التراخيص التجارية'),
 ('إقامة ذهبية','Golden Visa','الإقامة والتأشيرات'),
 ('إقامة خضراء','Green Visa','الإقامة والتأشيرات'),
 ('إقامة شريك','Partner Residence Visa','الإقامة والتأشيرات'),
 ('إذن دخول','Entry Permit','الإقامة والتأشيرات'),
 ('كفالة أسرة','Family Sponsorship','الإقامة والتأشيرات'),
 ('كفالة والدين','Parents Sponsorship','الإقامة والتأشيرات'),
 ('إقامة مولود','Newborn Residence','الإقامة والتأشيرات'),
 ('تثبيت إقامة','Residence Stamping','الإقامة والتأشيرات'),
 ('تجديد إقامة','Residence Renewal','الإقامة والتأشيرات'),
 ('إلغاء إقامة','Residence Cancellation','الإقامة والتأشيرات'),
 ('نقل إقامة','Residence Transfer','الإقامة والتأشيرات'),
 ('تأشيرة زيارة / تمديد','Visit Visa / Extension','الإقامة والتأشيرات'),
 ('دفع غرامات','Fines Payment','الإقامة والتأشيرات'),
 ('تصريح عمل جديد','New Work Permit','العمل والعمالة'),
 ('عقد عمل','Employment Contract','العمل والعمالة'),
 ('تجديد بطاقة عمل','Labour Card Renewal','العمل والعمالة'),
 ('بلاغ هروب','Absconding Report','العمل والعمالة'),
 ('طلب كوتا','Quota Request','العمل والعمالة'),
 ('نظام حماية الأجور','Wages Protection System','العمل والعمالة'),
 ('إصدار هوية إماراتية','Emirates ID Issuance','الهوية والصحة'),
 ('تجديد هوية إماراتية','Emirates ID Renewal','الهوية والصحة'),
 ('فحص طبي','Medical Fitness Test','الهوية والصحة'),
 ('تأمين صحي','Health Insurance','الهوية والصحة'),
 ('تصديق عقود','Contract Attestation','التوثيق والترجمة'),
 ('وكالة','Power of Attorney','التوثيق والترجمة'),
 ('ترجمة قانونية','Legal Translation','التوثيق والترجمة'),
 ('تصديق الخارجية','MOFA Attestation','التوثيق والترجمة'),
 ('معادلة شهادات','Certificate Equivalency','التوثيق والترجمة'),
 ('شهادة حسن سيرة وسلوك','Good Conduct Certificate','التوثيق والترجمة'),
 ('توثيق إيجاري','Ejari Registration','البلدية والعقارات'),
 ('كهرباء وماء','Electricity & Water','البلدية والعقارات'),
 ('براءة ذمة','Clearance Certificate','البلدية والعقارات'),
 ('تجديد ملكية مركبة','Vehicle Registration Renewal','المركبات'),
 ('نقل ملكية مركبة','Vehicle Ownership Transfer','المركبات'),
 ('تسجيل ضريبة القيمة المضافة','VAT Registration','الضرائب والمالية'),
 ('تسجيل ضريبة الشركات','Corporate Tax Registration','الضرائب والمالية'),
 ('فتح حساب بنكي','Bank Account Opening','الضرائب والمالية'),
 ('كود جمركي','Customs Code','الضرائب والمالية'),
 ('شهادة منشأ','Certificate of Origin','الضرائب والمالية'),
 ('طباعة وتصوير','Printing & Typing','خدمات أخرى')
) as v(ar, en, cat)
where s.name = v.ar;
update service_templates set category = 'خدمات أخرى' where category is null;

-- ---------- Transaction line items ------------------------------------
create table transaction_items (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  position       int not null default 0,
  service_id     uuid references service_templates(id) on delete set null,
  description    text not null,
  description_en text,
  qty            numeric(10,2) not null default 1 check (qty > 0),
  govt_unit      numeric(14,2) not null default 0 check (govt_unit >= 0),   -- government fee per unit (pass-through)
  fee_unit       numeric(14,2) not null default 0 check (fee_unit >= 0),    -- office fee per unit (profit)
  item_date      date
);
create index txn_items_txn_idx on transaction_items (transaction_id, position);

-- Keep transactions.govt_fees / office_fee equal to the sum of the items
create or replace function sync_txn_totals() returns trigger
language plpgsql security definer set search_path = public as $$
declare tid uuid := coalesce(new.transaction_id, old.transaction_id); g numeric; f numeric;
begin
  select coalesce(sum(qty * govt_unit), 0), coalesce(sum(qty * fee_unit), 0) into g, f from transaction_items where transaction_id = tid;
  update transactions set govt_fees = g, office_fee = f
  where id = tid and (govt_fees, office_fee) is distinct from (g, f);
  return null;
end $$;
create trigger trg_txn_items_sync after insert or update or delete on transaction_items
  for each row execute function sync_txn_totals();

-- Existing transactions get one item built from their current amounts
insert into transaction_items(transaction_id, position, description, qty, govt_unit, fee_unit, item_date)
select t.id, 0, t.title, 1, t.govt_fees, t.office_fee, t.created_at::date
from transactions t where not exists (select 1 from transaction_items i where i.transaction_id = t.id);

-- ---------- Quotations -------------------------------------------------
create type quote_status as enum ('draft','sent','accepted','rejected');

create table quotes (
  id             uuid primary key default gen_random_uuid(),
  quote_no       text not null unique default next_ref('QUO'),
  client_id      uuid references clients(id),
  client_name    text,                                  -- for a prospect who is not yet a client
  client_phone   text,
  status         quote_status not null default 'draft',
  valid_until    date,
  discount       numeric(14,2) not null default 0 check (discount >= 0),
  lang           text not null default 'both' check (lang in ('ar','en','both')),
  notes          text,                                  -- printed on the quotation
  internal_notes text,                                  -- never printed
  transaction_id uuid references transactions(id) on delete set null,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  check (client_id is not null or nullif(client_name, '') is not null)
);
create index quotes_client_idx on quotes (client_id);
create index quotes_created_idx on quotes (created_at desc);
create trigger trg_quotes_upd before update on quotes for each row execute function set_updated_at();

create table quote_items (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null references quotes(id) on delete cascade,
  position       int not null default 0,
  service_id     uuid references service_templates(id) on delete set null,
  description    text not null,
  description_en text,
  qty            numeric(10,2) not null default 1 check (qty > 0),
  govt_unit      numeric(14,2) not null default 0 check (govt_unit >= 0),
  fee_unit       numeric(14,2) not null default 0 check (fee_unit >= 0)
);
create index quote_items_idx on quote_items (quote_id, position);

alter table transactions
  add column if not exists quote_id uuid references quotes(id) on delete set null,
  add column if not exists invoice_no int,
  add column if not exists invoice_date date;
create unique index if not exists txn_invoice_no_uq on transactions (invoice_no) where invoice_no is not null;

create or replace view quotes_list as
select q.id, q.quote_no, q.client_id, coalesce(c.name, q.client_name) as party_name, coalesce(c.phone, q.client_phone) as party_phone,
       q.status, q.valid_until, q.discount, q.lang, q.transaction_id, q.created_at, p.full_name as created_by_name,
       coalesce(i.total, 0) as items_total, coalesce(i.total, 0) - q.discount as total, coalesce(i.cnt, 0) as item_count,
       tr.ref_no as transaction_ref
from quotes q
left join clients c on c.id = q.client_id
left join profiles p on p.id = q.created_by
left join transactions tr on tr.id = q.transaction_id
left join lateral (select sum(qty * (govt_unit + fee_unit)) as total, count(*) as cnt from quote_items where quote_id = q.id) i on true
where q.deleted_at is null and is_member();
revoke all on quotes_list from anon;
grant select on quotes_list to authenticated;

-- ---------- Row Level Security ----------------------------------------
alter table transaction_items enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
create policy titems_read   on transaction_items for select using (is_member());
create policy titems_write  on transaction_items for all using (has_perm('txn.write')) with check (has_perm('txn.write'));
create policy quotes_read   on quotes for select using (is_member());
create policy quotes_insert on quotes for insert with check (has_perm('txn.write'));
create policy quotes_update on quotes for update using (has_perm('txn.write'));
create policy quotes_delete on quotes for delete using (has_perm('txn.delete'));
create policy qitems_read   on quote_items for select using (is_member());
create policy qitems_write  on quote_items for all using (has_perm('txn.write')) with check (has_perm('txn.write'));

create trigger aud_quotes after insert or update or delete on quotes for each row execute function audit_row();

-- ---------- Replace all items atomically ------------------------------
create or replace function set_transaction_items(p_txn uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('txn.write') then raise exception 'forbidden'; end if;
  if not exists (select 1 from transactions where id = p_txn and deleted_at is null) then raise exception 'المعاملة غير موجودة'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'أضف بنداً واحداً على الأقل'; end if;
  delete from transaction_items where transaction_id = p_txn;
  insert into transaction_items(transaction_id, position, service_id, description, description_en, qty, govt_unit, fee_unit, item_date)
  select p_txn, (ord - 1)::int, nullif(e->>'service_id', '')::uuid, btrim(e->>'description'), nullif(btrim(e->>'description_en'), ''),
         coalesce(nullif(e->>'qty', '')::numeric, 1), coalesce(nullif(e->>'govt_unit', '')::numeric, 0), coalesce(nullif(e->>'fee_unit', '')::numeric, 0),
         nullif(e->>'item_date', '')::date
  from jsonb_array_elements(p_items) with ordinality as t(e, ord)
  where btrim(coalesce(e->>'description', '')) <> '';
  if not exists (select 1 from transaction_items where transaction_id = p_txn) then raise exception 'اكتب وصف البند'; end if;
end $$;

create or replace function set_quote_items(p_quote uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('txn.write') then raise exception 'forbidden'; end if;
  if not exists (select 1 from quotes where id = p_quote and deleted_at is null) then raise exception 'عرض السعر غير موجود'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'أضف بنداً واحداً على الأقل'; end if;
  delete from quote_items where quote_id = p_quote;
  insert into quote_items(quote_id, position, service_id, description, description_en, qty, govt_unit, fee_unit)
  select p_quote, (ord - 1)::int, nullif(e->>'service_id', '')::uuid, btrim(e->>'description'), nullif(btrim(e->>'description_en'), ''),
         coalesce(nullif(e->>'qty', '')::numeric, 1), coalesce(nullif(e->>'govt_unit', '')::numeric, 0), coalesce(nullif(e->>'fee_unit', '')::numeric, 0)
  from jsonb_array_elements(p_items) with ordinality as t(e, ord)
  where btrim(coalesce(e->>'description', '')) <> '';
  if not exists (select 1 from quote_items where quote_id = p_quote) then raise exception 'اكتب وصف البند'; end if;
end $$;

-- ---------- Quote -> transaction --------------------------------------
create or replace function convert_quote(p_quote uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare q quotes; cid uuid; tid uuid; first_desc text; n int;
begin
  if not has_perm('txn.write') then raise exception 'forbidden'; end if;
  select * into q from quotes where id = p_quote and deleted_at is null for update;
  if not found then raise exception 'عرض السعر غير موجود'; end if;
  if q.transaction_id is not null then raise exception 'تم تحويل هذا العرض إلى معاملة مسبقاً'; end if;
  if not exists (select 1 from quote_items where quote_id = p_quote) then raise exception 'عرض السعر بلا بنود'; end if;

  cid := q.client_id;
  if cid is null then
    insert into clients(kind, name, phone, created_by) values ('individual', q.client_name, nullif(q.client_phone, ''), auth.uid()) returning id into cid;
    update quotes set client_id = cid where id = p_quote;
  end if;

  select description into first_desc from quote_items where quote_id = p_quote order by position limit 1;
  select count(*) into n from quote_items where quote_id = p_quote;
  insert into transactions(client_id, title, status, discount, assignee_id, created_by, quote_id, internal_notes)
  values (cid, first_desc || case when n = 2 then ' (+بند آخر)' when n > 2 then ' (+' || (n - 1) || ' بنود أخرى)' else '' end, 'new', q.discount, auth.uid(), auth.uid(), p_quote,
          'من عرض السعر ' || q.quote_no)
  returning id into tid;

  insert into transaction_items(transaction_id, position, service_id, description, description_en, qty, govt_unit, fee_unit, item_date)
  select tid, position, service_id, description, description_en, qty, govt_unit, fee_unit, current_date from quote_items where quote_id = p_quote;

  update quotes set status = 'accepted', transaction_id = tid where id = p_quote;
  return tid;
end $$;

-- ---------- Invoice numbering -----------------------------------------
create or replace function issue_invoice(p_txn uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not has_perm('txn.write') then raise exception 'forbidden'; end if;
  select invoice_no into n from transactions where id = p_txn and deleted_at is null for update;
  if not found then raise exception 'المعاملة غير موجودة'; end if;
  if n is null then
    update office_settings set next_invoice_no = next_invoice_no + 1 returning next_invoice_no - 1 into n;
    update transactions set invoice_no = n, invoice_date = current_date where id = p_txn;
  end if;
  return n;
end $$;

grant execute on function set_transaction_items(uuid, jsonb), set_quote_items(uuid, jsonb), convert_quote(uuid), issue_invoice(uuid) to authenticated;
revoke execute on function set_transaction_items(uuid, jsonb), set_quote_items(uuid, jsonb), convert_quote(uuid), issue_invoice(uuid) from anon;

-- transactions_list: expose invoice number + quote link (columns appended at the end)
create or replace view transactions_list as
select t.id, t.ref_no, t.client_id, c.name as client_name, c.phone as client_phone,
       t.assignee_id, p.full_name as assignee_name, t.title, t.status,
       t.govt_fees, t.office_fee, t.discount, t.total, t.due_date,
       t.created_at, t.completed_at,
       s.paid, s.remaining, s.payment_status,
       cb.full_name as created_by_name,
       t.invoice_no, t.invoice_date, t.quote_id
from transactions t
join clients c on c.id = t.client_id
left join profiles p on p.id = t.assignee_id
left join profiles cb on cb.id = t.created_by
join transaction_payment_summary s on s.transaction_id = t.id
where t.deleted_at is null and is_member();
