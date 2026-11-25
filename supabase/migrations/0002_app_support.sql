-- =====================================================================
-- 0002: push (owner only), alert dispatch log, staff-safe RPCs, list views
-- Run AFTER 0001_schema.sql
-- =====================================================================

-- ---------- Push subscriptions (owner only) --------------------------
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create policy push_own_read   on push_subscriptions for select using (user_id = auth.uid());
create policy push_own_insert on push_subscriptions for insert
  with check (user_id = auth.uid() and auth_role() = 'owner');      -- notifications are for the owner alone
create policy push_own_delete on push_subscriptions for delete using (user_id = auth.uid());

-- One push per (document, threshold) so the daily job is idempotent
create table alert_dispatches (
  document_id uuid not null references documents(id) on delete cascade,
  threshold   int  not null,
  sent_at     timestamptz not null default now(),
  primary key (document_id, threshold)
);
alter table alert_dispatches enable row level security;   -- no policies: service role only

-- ---------- Completed timestamp --------------------------------------
create or replace function txn_set_completed() returns trigger
language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    new.completed_at = now();
  elsif new.status <> 'completed' then
    new.completed_at = null;
  end if;
  return new;
end $$;
create trigger trg_txn_completed before update on transactions
  for each row execute function txn_set_completed();

-- ---------- Views used by lists --------------------------------------
create or replace view transaction_payment_summary as
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
where t.deleted_at is null
group by t.id;

create or replace view transactions_list as
select t.id, t.ref_no, t.client_id, c.name as client_name, c.phone as client_phone,
       t.assignee_id, p.full_name as assignee_name, t.title, t.status,
       t.govt_fees, t.office_fee, t.discount, t.total, t.due_date,
       t.created_at, t.completed_at,
       s.paid, s.remaining, s.payment_status
from transactions t
join clients c on c.id = t.client_id
left join profiles p on p.id = t.assignee_id
join transaction_payment_summary s on s.transaction_id = t.id
where t.deleted_at is null and is_member();      -- is_member() keeps anon out even though view is owner-run

-- Views are owner-run on purpose (staff need paid/remaining); lock out anon explicitly.
revoke all on transaction_payment_summary from anon;
revoke all on transactions_list from anon;
grant select on transaction_payment_summary, transactions_list to authenticated;

-- ---------- Staff-safe RPCs ------------------------------------------
-- Account names without balances, so staff can pick where a payment went.
create or replace function payable_accounts()
returns table(id uuid, name text, kind account_kind)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.kind from accounts a
  where a.is_active and is_member()
  order by a.kind, a.name
$$;

create or replace function record_govt_fee(
  p_txn uuid, p_account uuid, p_amount numeric, p_method pay_method, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; eid uuid;
begin
  if not has_perm('treasury.write') then raise exception 'forbidden'; end if;
  select client_id into cid from transactions where id = p_txn and deleted_at is null;
  if cid is null then raise exception 'transaction not found'; end if;
  insert into ledger_entries(account_id,direction,kind,amount,method,transaction_id,client_id,description,created_by)
  values (p_account,'out','govt_fee',p_amount,p_method,p_txn,cid,p_note,auth.uid())
  returning id into eid;
  return eid;
end $$;

create or replace function void_ledger_entry(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e ledger_entries;
begin
  if not has_perm('treasury.write') then raise exception 'forbidden'; end if;
  select * into e from ledger_entries where id = p_id and voided_at is null;
  if not found then raise exception 'not found'; end if;
  update ledger_entries set voided_at = now() where id = p_id or (e.transfer_id is not null and transfer_id = e.transfer_id);
end $$;

create or replace function soft_delete_record(p_table text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_table = 'clients' then
    if not has_perm('clients.delete') then raise exception 'forbidden'; end if;
    update clients set deleted_at = now() where id = p_id;
  elsif p_table = 'transactions' then
    if not has_perm('txn.delete') then raise exception 'forbidden'; end if;
    update transactions set deleted_at = now() where id = p_id;
  elsif p_table = 'documents' then
    if not has_perm('docs.delete') then raise exception 'forbidden'; end if;
    update documents set deleted_at = now() where id = p_id;
  else raise exception 'unsupported table';
  end if;
  insert into audit_log(user_id, action, entity, entity_id) values (auth.uid(), 'soft_delete', p_table, p_id::text);
end $$;

create or replace function dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; can_bal boolean := has_perm('treasury.view');
begin
  if not is_member() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'cash_balance', case when can_bal then (select coalesce(sum(balance),0) from account_balances_all where kind='cash') end,
    'bank_balance', case when can_bal then (select coalesce(sum(balance),0) from account_balances_all where kind='bank') end,
    'in_progress',  (select count(*) from transactions where deleted_at is null and status in ('new','in_progress','awaiting_docs')),
    'completed_month', (select count(*) from transactions where deleted_at is null and status='completed'
                        and completed_at >= date_trunc('month', now())),
    'urgent_docs', (select count(*) from document_alerts_all where bucket in ('expired','critical'))
  ) into r;
  return r;
end $$;

-- Owner-run copies of the balance / alert views for use inside definer functions only
create or replace view account_balances_all as
select a.id as account_id, a.name, a.kind,
       a.opening_balance + coalesce(sum(case when l.direction='in' then l.amount else -l.amount end)
         filter (where l.voided_at is null), 0) as balance
from accounts a left join ledger_entries l on l.account_id = a.id
group by a.id;
revoke all on account_balances_all from anon, authenticated;

create or replace view document_alerts_all as
select d.id, d.client_id, d.expiry_date,
  case
    when d.expiry_date < current_date then 'expired'
    when d.expiry_date - current_date <= os.critical_days then 'critical'
    else 'other' end as bucket
from documents d cross join office_settings os
where d.is_current and d.deleted_at is null and d.expiry_date is not null
  and (d.snoozed_until is null or d.snoozed_until <= current_date);
revoke all on document_alerts_all from anon, authenticated;

-- Extra document alert columns the UI needs (snoozed docs included, with flag)
create or replace view document_center with (security_invoker = true) as
select d.id, d.group_id, d.client_id, c.name as client_name, c.phone as client_phone, c.whatsapp as client_whatsapp,
       d.type_id, dt.name as type_name, d.title, d.issue_date, d.expiry_date,
       d.followup, d.snoozed_until, d.notified_at, d.transaction_id,
       (d.expiry_date - current_date) as days_left,
       case
         when d.expiry_date < current_date then 'expired'
         when d.expiry_date - current_date <= os.critical_days then 'critical'
         when d.expiry_date - current_date <= coalesce(
              (select max(x) from unnest(coalesce(dt.reminder_days, os.default_reminder_days)) x), 90) then 'upcoming'
         else 'valid' end as bucket
from documents d
join clients c on c.id = d.client_id
join document_types dt on dt.id = d.type_id
cross join office_settings os
where d.is_current and d.deleted_at is null and d.expiry_date is not null and c.deleted_at is null;

-- Accounts for settings page (name only edits) already covered by RLS in 0001.
-- Staff may read document_center (documents/clients/types are member-readable).

-- ---------- Payments list for a transaction (staff-safe) --------------
create or replace function transaction_payments(p_txn uuid)
returns table(id uuid, amount numeric, method pay_method, occurred_at timestamptz, description text, voided boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.amount, l.method, l.occurred_at, l.description, (l.voided_at is not null)
  from ledger_entries l
  where l.transaction_id = p_txn and l.kind = 'client_payment' and is_member()
  order by l.occurred_at
$$;

-- (vault_read from 0001 is kept: only active members can see object metadata; file bytes still require a signed URL.)

-- Expense receipts are uploaded by treasury writers too
drop policy if exists vault_upload on storage.objects;
create policy vault_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'vault' and (has_perm('docs.write') or has_perm('treasury.write')));

-- Audit trigger fix: some audited tables (role_permissions) have no `id` column.
create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  v := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into audit_log(user_id, action, entity, entity_id, old_data, new_data)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(v->>'id', (v->>'role') || ':' || (v->>'permission')),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
