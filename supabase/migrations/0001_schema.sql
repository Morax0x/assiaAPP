-- =====================================================================
-- مكتب الخدمات والمعاملات — Supabase schema (v1 draft for approval)
-- Single office (single tenant), multi-user, 3 editable roles.
-- Money: numeric(14,2). Currency is a single setting (default AED).
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;   -- fast fuzzy search for Ctrl+K

-- ---------- Enums ----------------------------------------------------
create type user_role        as enum ('owner','admin','staff');
create type client_kind      as enum ('individual','company');
create type account_kind     as enum ('cash','bank','other');
create type txn_status       as enum ('new','in_progress','awaiting_docs','completed','cancelled');
create type pay_method       as enum ('cash','bank_card','bank_transfer');
create type ledger_kind      as enum (
  'client_payment',   -- money in from a client
  'govt_fee',         -- government/actual cost paid out
  'expense',          -- operating expense
  'transfer',         -- internal transfer leg (never income/expense)
  'adjustment'        -- reconciliation difference
);
create type ledger_dir       as enum ('in','out');
create type followup_status  as enum ('pending','client_notified','renewal_started','snoozed','done');
create type share_scope      as enum ('transaction','client_folder','documents');

-- ---------- Utility --------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- Profiles & permissions ----------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text,
  role        user_role not null default 'staff',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_upd before update on profiles
  for each row execute function set_updated_at();

-- Editable permission matrix (Settings > Roles). Owner is always allowed.
create table role_permissions (
  role        user_role not null,
  permission  text not null,
  allowed     boolean not null default false,
  primary key (role, permission)
);
insert into role_permissions(role, permission, allowed) values
 -- permissions: clients.write, clients.delete, txn.write, txn.delete, docs.write, docs.delete,
 -- treasury.view, treasury.write, reports.view, share.create, settings.manage, users.manage, audit.view
 ('admin','clients.write',true),('admin','clients.delete',true),
 ('admin','txn.write',true),('admin','txn.delete',true),
 ('admin','docs.write',true),('admin','docs.delete',true),
 ('admin','treasury.view',true),('admin','treasury.write',true),
 ('admin','reports.view',true),('admin','share.create',true),
 ('admin','settings.manage',true),('admin','users.manage',true),('admin','audit.view',true),
 ('staff','clients.write',true),('staff','clients.delete',false),
 ('staff','txn.write',true),('staff','txn.delete',false),
 ('staff','docs.write',true),('staff','docs.delete',false),
 ('staff','treasury.view',false),('staff','treasury.write',false),
 ('staff','reports.view',false),('staff','share.create',true),
 ('staff','settings.manage',false),('staff','users.manage',false),('staff','audit.view',false);

-- Single-row office settings
create table office_settings (
  id               boolean primary key default true check (id),   -- enforces one row
  office_name      text not null default 'المكتب',
  logo_path        text,
  currency         text not null default 'AED',
  phone            text,
  address          text,
  tax_number       text,
  default_reminder_days int[] not null default '{90,60,30,14,7}',
  critical_days    int not null default 14,    -- "expires soon (critical)" threshold
  invoice_footer   text,
  whatsapp_template text not null default
    'السلام عليكم {client}، نود تذكيركم بأن {document} ينتهي بتاريخ {date}. يسعدنا تجديده لكم، يرجى التواصل معنا.',
  updated_at       timestamptz not null default now()
);
insert into office_settings default values;

-- Role helpers (SECURITY DEFINER so RLS policies can call them cheaply)
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when pr.role = 'owner' then true
       else coalesce((select allowed from role_permissions rp
                      where rp.role = pr.role and rp.permission = p), false) end
     from profiles pr where pr.id = auth.uid() and pr.is_active),
    false)
$$;

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and is_active)
$$;

-- ---------- Clients --------------------------------------------------
create table clients (
  id          uuid primary key default gen_random_uuid(),
  kind        client_kind not null default 'individual',
  name        text not null,
  phone       text,
  whatsapp    text,
  email       text,
  notes       text,                       -- internal only, never shared
  deleted_at  timestamptz,                -- soft delete
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index clients_name_trgm on clients using gin (name gin_trgm_ops);
create index clients_phone_idx on clients (phone);
create trigger trg_clients_upd before update on clients
  for each row execute function set_updated_at();

-- ---------- Service templates ---------------------------------------
create table service_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  default_govt_fee  numeric(14,2) not null default 0,
  default_office_fee numeric(14,2) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------- Treasury accounts ---------------------------------------
create table accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            account_kind not null,
  opening_balance numeric(14,2) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
insert into accounts(name, kind) values ('صندوق الكاش','cash'), ('بطاقة البنك','bank');

create table expense_categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  is_active boolean not null default true
);
insert into expense_categories(name) values
 ('إيجار'),('كهرباء وماء'),('رواتب'),('مشتريات'),('ضيافة'),('اتصالات'),('أخرى');

-- ---------- Transactions --------------------------------------------
create table ref_counters (
  prefix text not null, year int not null, last_no int not null default 0,
  primary key (prefix, year)
);
create or replace function next_ref(p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare y int := extract(year from now()); n int;
begin
  insert into ref_counters(prefix, year, last_no) values (p_prefix, y, 1)
  on conflict (prefix, year) do update set last_no = ref_counters.last_no + 1
  returning last_no into n;
  return p_prefix || '-' || y || '-' || lpad(n::text, 4, '0');
end $$;

create table transactions (
  id            uuid primary key default gen_random_uuid(),
  ref_no        text not null unique default next_ref('TRX'),
  client_id     uuid not null references clients(id),
  assignee_id   uuid references profiles(id),
  template_id   uuid references service_templates(id),
  title         text not null,
  status        txn_status not null default 'new',
  govt_fees     numeric(14,2) not null default 0 check (govt_fees >= 0),   -- pass-through cost
  office_fee    numeric(14,2) not null default 0 check (office_fee >= 0),  -- office net profit
  discount      numeric(14,2) not null default 0 check (discount >= 0),
  total         numeric(14,2) generated always as (govt_fees + office_fee - discount) stored,
  due_date      date,
  renewal_of_document uuid,             -- FK added after documents table
  internal_notes text,                  -- never shared externally
  completed_at  timestamptz,
  deleted_at    timestamptz,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index txn_client_idx   on transactions (client_id);
create index txn_status_idx   on transactions (status) where deleted_at is null;
create index txn_assignee_idx on transactions (assignee_id);
create index txn_created_idx  on transactions (created_at desc);
create index txn_ref_trgm     on transactions using gin (ref_no gin_trgm_ops);
create trigger trg_txn_upd before update on transactions
  for each row execute function set_updated_at();

-- ---------- Treasury ledger (single source of truth for balances) ---
create table ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id),
  direction     ledger_dir not null,
  kind          ledger_kind not null,
  amount        numeric(14,2) not null check (amount > 0),
  method        pay_method,
  occurred_at   timestamptz not null default now(),
  transaction_id uuid references transactions(id),
  client_id     uuid references clients(id),
  category_id   uuid references expense_categories(id),   -- for kind = expense
  transfer_id   uuid,                                      -- pairs the two legs of a transfer
  description   text,
  receipt_path  text,                                      -- storage path of expense photo
  voided_at     timestamptz,                               -- never hard-delete money rows
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  check (kind <> 'expense'  or category_id is not null),
  check (kind <> 'transfer' or transfer_id is not null),
  check (kind not in ('client_payment','govt_fee') or transaction_id is not null)
);
create index ledger_account_idx on ledger_entries (account_id, occurred_at desc);
create index ledger_txn_idx     on ledger_entries (transaction_id);
create index ledger_kind_idx    on ledger_entries (kind, occurred_at);

-- Live balances
create view account_balances with (security_invoker = true) as
select a.id as account_id, a.name, a.kind,
       a.opening_balance
       + coalesce(sum(case when l.direction='in' then l.amount else -l.amount end)
                  filter (where l.voided_at is null), 0) as balance
from accounts a
left join ledger_entries l on l.account_id = a.id
group by a.id;

-- Per-transaction payment state (paid / partial / unpaid).
-- Intentionally NOT security_invoker: staff must see paid/remaining per transaction
-- even though they cannot read the raw ledger or account balances.
create view transaction_payment_summary as
select t.id as transaction_id, t.client_id, t.total,
       coalesce(sum(l.amount) filter (where l.kind='client_payment' and l.voided_at is null),0) as paid,
       t.total - coalesce(sum(l.amount) filter (where l.kind='client_payment' and l.voided_at is null),0) as remaining,
       case
         when t.total = 0 then 'paid'
         when coalesce(sum(l.amount) filter (where l.kind='client_payment' and l.voided_at is null),0) >= t.total then 'paid'
         when coalesce(sum(l.amount) filter (where l.kind='client_payment' and l.voided_at is null),0) > 0 then 'partial'
         else 'unpaid' end as payment_status
from transactions t
left join ledger_entries l on l.transaction_id = t.id
where t.deleted_at is null and t.status <> 'cancelled'
group by t.id;

create table reconciliations (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references accounts(id),
  system_balance numeric(14,2) not null,
  actual_balance numeric(14,2) not null,
  difference     numeric(14,2) generated always as (actual_balance - system_balance) stored,
  note           text,
  adjustment_entry_id uuid references ledger_entries(id),   -- optional auto-adjustment
  reconciled_at  timestamptz not null default now(),
  created_by     uuid references profiles(id)
);

-- ---------- Documents vault -----------------------------------------
create table document_types (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  reminder_days    int[],            -- null => use office default; per-type override
  tracks_expiry    boolean not null default true,
  sort_order       int not null default 0
);
insert into document_types(name, reminder_days, sort_order) values
 ('رخصة تجارية','{60,30,14,7}',1),('بطاقة منشأة',null,2),('هوية',null,3),
 ('جواز سفر',null,4),('إقامة','{30,14,7}',5),('عقد إيجار',null,6),
 ('وكالة',null,7),('إيصال',null,8),('تأمين','{15,7}',9),('أخرى',null,10);

create table documents (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null default gen_random_uuid(),  -- same group = versions of one document
  client_id      uuid not null references clients(id),
  transaction_id uuid references transactions(id),
  type_id        uuid not null references document_types(id),
  title          text not null,
  issue_date     date,
  expiry_date    date,
  storage_path   text not null,          -- private bucket path: clients/{client_id}/{uuid}.{ext}
  mime_type      text not null,
  size_bytes     bigint not null,
  is_current     boolean not null default true,
  superseded_at  timestamptz,
  -- follow-up (only meaningful while is_current)
  followup       followup_status not null default 'pending',
  snoozed_until  date,
  notified_at    timestamptz,
  deleted_at     timestamptz,
  uploaded_by    uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);
create index docs_client_idx on documents (client_id) where deleted_at is null;
create index docs_txn_idx    on documents (transaction_id);
create index docs_expiry_idx on documents (expiry_date) where is_current and deleted_at is null;
create index docs_group_idx  on documents (group_id);
create index docs_title_trgm on documents using gin (title gin_trgm_ops);
create unique index docs_one_current_per_group on documents (group_id) where is_current;
create trigger trg_docs_upd before update on documents
  for each row execute function set_updated_at();

alter table transactions
  add constraint txn_renewal_doc_fk foreign key (renewal_of_document) references documents(id);

-- Renewal: atomically archive old version and insert the new one
create or replace function renew_document(
  p_old uuid, p_storage_path text, p_mime text, p_size bigint,
  p_issue date, p_expiry date
) returns uuid language plpgsql security definer set search_path = public as $$
declare o documents; new_id uuid;
begin
  if not has_perm('docs.write') then raise exception 'forbidden'; end if;
  select * into o from documents where id = p_old and is_current for update;
  if not found then raise exception 'document not found or already superseded'; end if;
  update documents set is_current = false, superseded_at = now() where id = o.id;
  insert into documents(group_id, client_id, transaction_id, type_id, title, issue_date,
                        expiry_date, storage_path, mime_type, size_bytes, uploaded_by)
  values (o.group_id, o.client_id, o.transaction_id, o.type_id, o.title, p_issue,
          p_expiry, p_storage_path, p_mime, p_size, auth.uid())
  returning id into new_id;
  return new_id;
end $$;

-- Alert view: computed days left + effective reminder window
create view document_alerts with (security_invoker = true) as
select d.id, d.client_id, c.name as client_name, d.type_id, dt.name as type_name,
       d.title, d.expiry_date, d.followup, d.snoozed_until, d.notified_at,
       (d.expiry_date - current_date) as days_left,
       case
         when d.expiry_date < current_date then 'expired'
         when d.expiry_date - current_date <= os.critical_days then 'critical'
         when d.expiry_date - current_date <= coalesce(
              (select max(x) from unnest(coalesce(dt.reminder_days, os.default_reminder_days)) x), 90)
              then 'upcoming'
         else 'valid' end as bucket
from documents d
join clients c on c.id = d.client_id
join document_types dt on dt.id = d.type_id
cross join office_settings os
where d.is_current and d.deleted_at is null and d.expiry_date is not null
  and c.deleted_at is null
  and (d.snoozed_until is null or d.snoozed_until <= current_date);

-- ---------- External share links ------------------------------------
create table share_links (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,          -- sha256(token); raw token shown once
  scope        share_scope not null,
  client_id    uuid references clients(id),
  transaction_id uuid references transactions(id),
  pin_hash     text,                          -- bcrypt, null = no PIN
  pin_attempts int not null default 0,        -- lock after 5 failures
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  allow_download boolean not null default true,
  last_viewed_at timestamptz,
  view_count   int not null default 0,
  created_by   uuid not null references profiles(id),
  created_at   timestamptz not null default now()
);
create table share_link_documents (
  link_id     uuid not null references share_links(id) on delete cascade,
  document_id uuid not null references documents(id),
  primary key (link_id, document_id)
);

-- ---------- Audit log ------------------------------------------------
create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  user_id     uuid,
  action      text not null,         -- insert | update | delete | custom
  entity      text not null,
  entity_id   text,
  old_data    jsonb,
  new_data    jsonb
);
create index audit_at_idx on audit_log (at desc);
create index audit_entity_idx on audit_log (entity, entity_id);

create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(user_id, action, entity, entity_id, old_data, new_data)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce((case when tg_op='DELETE' then old.id else new.id end)::text, null),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger aud_txn      after insert or update or delete on transactions       for each row execute function audit_row();
create trigger aud_ledger   after insert or update or delete on ledger_entries     for each row execute function audit_row();
create trigger aud_docs     after insert or update or delete on documents          for each row execute function audit_row();
create trigger aud_clients  after insert or update or delete on clients            for each row execute function audit_row();
create trigger aud_share    after insert or update or delete on share_links        for each row execute function audit_row();
create trigger aud_recon    after insert                      on reconciliations   for each row execute function audit_row();
create trigger aud_settings after update                      on office_settings   for each row execute function audit_row();
create trigger aud_profiles after update or delete            on profiles          for each row execute function audit_row();
create trigger aud_perms    after insert or update or delete on role_permissions   for each row execute function audit_row();

-- ---------- Money RPCs (the only write path for treasury) -----------
-- Staff without treasury.view still need to record a client payment, so this
-- is SECURITY DEFINER and checks txn.write itself.
create or replace function record_client_payment(
  p_txn uuid, p_account uuid, p_amount numeric, p_method pay_method, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; eid uuid;
begin
  if not (has_perm('txn.write') or has_perm('treasury.write')) then raise exception 'forbidden'; end if;
  select client_id into cid from transactions where id = p_txn and deleted_at is null;
  if cid is null then raise exception 'transaction not found'; end if;
  insert into ledger_entries(account_id,direction,kind,amount,method,transaction_id,client_id,description,created_by)
  values (p_account,'in','client_payment',p_amount,p_method,p_txn,cid,p_note,auth.uid())
  returning id into eid;
  return eid;
end $$;

create or replace function record_internal_transfer(
  p_from uuid, p_to uuid, p_amount numeric, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid := gen_random_uuid();
begin
  if not has_perm('treasury.write') then raise exception 'forbidden'; end if;
  if p_from = p_to then raise exception 'same account'; end if;
  insert into ledger_entries(account_id,direction,kind,amount,transfer_id,description,created_by)
  values (p_from,'out','transfer',p_amount,tid,p_note,auth.uid()),
         (p_to,  'in', 'transfer',p_amount,tid,p_note,auth.uid());
  return tid;
end $$;

create or replace function reconcile_account(
  p_account uuid, p_actual numeric, p_note text default null, p_adjust boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare sysbal numeric; diff numeric; adj uuid; rid uuid;
begin
  if not has_perm('treasury.write') then raise exception 'forbidden'; end if;
  select balance into sysbal from account_balances where account_id = p_account;
  diff := p_actual - sysbal;
  if p_adjust and diff <> 0 then
    insert into ledger_entries(account_id,direction,kind,amount,description,created_by)
    values (p_account, (case when diff>0 then 'in' else 'out' end)::ledger_dir, 'adjustment', abs(diff),
            coalesce(p_note,'تسوية جرد'), auth.uid())
    returning id into adj;
  end if;
  insert into reconciliations(account_id,system_balance,actual_balance,note,adjustment_entry_id,created_by)
  values (p_account, sysbal, p_actual, p_note, adj, auth.uid()) returning id into rid;
  return rid;
end $$;

-- Reports gated by permission (staff cannot read raw ledger or profit)
create or replace function monthly_summary(p_months int default 6)
returns table(month date, income numeric, govt_paid numeric, expenses numeric, office_net numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_perm('reports.view') then raise exception 'forbidden'; end if;
  return query
  select date_trunc('month', l.occurred_at)::date,
    coalesce(sum(l.amount) filter (where l.kind='client_payment'),0),
    coalesce(sum(l.amount) filter (where l.kind='govt_fee'),0),
    coalesce(sum(l.amount) filter (where l.kind='expense'),0),
    coalesce(sum(l.amount) filter (where l.kind='client_payment'),0)
      - coalesce(sum(l.amount) filter (where l.kind in ('govt_fee','expense')),0)
  from ledger_entries l
  where l.voided_at is null and l.kind <> 'transfer'
    and l.occurred_at >= date_trunc('month', now()) - make_interval(months => p_months-1)
  group by 1 order by 1;
end $$;

-- Dashboard balances respect the "staff may see balances" toggle
create or replace function visible_balances()
returns table(account_id uuid, name text, kind account_kind, balance numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_perm('treasury.view') then return; end if;
  return query select b.account_id, b.name, b.kind, b.balance from account_balances b;
end $$;

-- ---------- Row Level Security --------------------------------------
alter table profiles            enable row level security;
alter table role_permissions    enable row level security;
alter table office_settings     enable row level security;
alter table clients             enable row level security;
alter table service_templates   enable row level security;
alter table accounts            enable row level security;
alter table expense_categories  enable row level security;
alter table transactions        enable row level security;
alter table ledger_entries      enable row level security;
alter table reconciliations     enable row level security;
alter table document_types      enable row level security;
alter table documents           enable row level security;
alter table share_links         enable row level security;
alter table share_link_documents enable row level security;
alter table audit_log           enable row level security;
alter table ref_counters        enable row level security;   -- no policies: function-only

-- profiles
create policy profiles_read   on profiles for select using (is_member());
create policy profiles_manage on profiles for all    using (has_perm('users.manage')) with check (has_perm('users.manage'));

-- permissions matrix: members read (UI needs it); only settings.manage writes; owner row logic in has_perm
create policy perms_read   on role_permissions for select using (is_member());
create policy perms_manage on role_permissions for all using (auth_role()='owner') with check (auth_role()='owner');

-- settings & lookups
create policy settings_read   on office_settings for select using (is_member());
create policy settings_update on office_settings for update using (has_perm('settings.manage'));
create policy tpl_read   on service_templates  for select using (is_member());
create policy tpl_manage on service_templates  for all using (has_perm('settings.manage')) with check (has_perm('settings.manage'));
create policy cat_read   on expense_categories for select using (is_member());
create policy cat_manage on expense_categories for all using (has_perm('settings.manage')) with check (has_perm('settings.manage'));
create policy dtype_read   on document_types for select using (is_member());
create policy dtype_manage on document_types for all using (has_perm('settings.manage')) with check (has_perm('settings.manage'));

-- clients (soft delete: delete policy requires clients.delete)
create policy clients_read   on clients for select using (is_member());
create policy clients_insert on clients for insert with check (has_perm('clients.write'));
create policy clients_update on clients for update using (has_perm('clients.write'));
create policy clients_delete on clients for delete using (has_perm('clients.delete'));

-- transactions
create policy txn_read   on transactions for select using (is_member());
create policy txn_insert on transactions for insert with check (has_perm('txn.write'));
create policy txn_update on transactions for update using (has_perm('txn.write'));
create policy txn_delete on transactions for delete using (has_perm('txn.delete'));

-- treasury: raw tables readable only with treasury.view; writes only via RPC or treasury.write
create policy acc_read   on accounts for select using (has_perm('treasury.view'));
create policy acc_manage on accounts for all using (has_perm('settings.manage')) with check (has_perm('settings.manage'));
create policy ledger_read   on ledger_entries for select using (has_perm('treasury.view'));
create policy ledger_insert on ledger_entries for insert with check (has_perm('treasury.write'));
create policy ledger_update on ledger_entries for update using (has_perm('treasury.write'));   -- void only; no delete policy
create policy recon_read   on reconciliations for select using (has_perm('treasury.view'));
create policy recon_insert on reconciliations for insert with check (has_perm('treasury.write'));

-- documents
create policy docs_read   on documents for select using (is_member());
create policy docs_insert on documents for insert with check (has_perm('docs.write'));
create policy docs_update on documents for update using (has_perm('docs.write'));
create policy docs_delete on documents for delete using (has_perm('docs.delete'));

-- share links: managed by members with share.create; public access is server-only (service role)
create policy share_read   on share_links for select using (has_perm('share.create'));
create policy share_insert on share_links for insert with check (has_perm('share.create') and created_by = auth.uid());
create policy share_update on share_links for update using (has_perm('share.create'));   -- revoke
create policy sld_read   on share_link_documents for select using (has_perm('share.create'));
create policy sld_write  on share_link_documents for all using (has_perm('share.create')) with check (has_perm('share.create'));

-- audit: read-only, no one can insert/update/delete via API (triggers are SECURITY DEFINER)
create policy audit_read on audit_log for select using (has_perm('audit.view'));

-- ---------- Storage (private bucket) --------------------------------
insert into storage.buckets(id, name, public, file_size_limit)
values ('vault','vault', false, 15728640)             -- 15 MB per file
on conflict (id) do nothing;

-- Browser may upload/list only if permitted; downloads happen via server-generated
-- signed URLs (service role), never direct from the client.
create policy vault_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'vault' and has_perm('docs.write'));
create policy vault_read   on storage.objects for select to authenticated
  using (bucket_id = 'vault' and is_member());
create policy vault_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vault' and has_perm('docs.delete'));

-- ---------- New-user bootstrap --------------------------------------
-- First registered user becomes owner; others are created inactive-staff by an admin invite.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email),
          case when not exists(select 1 from profiles) then 'owner'::user_role else 'staff'::user_role end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
