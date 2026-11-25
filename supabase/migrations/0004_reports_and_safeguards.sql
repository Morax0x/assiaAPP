-- =====================================================================
-- 0004: period reports, statements, and accounting safeguards
-- Run AFTER 0003.
-- =====================================================================

-- ---------- Safeguards ------------------------------------------------
-- 1) Cash can never go negative (physical cash). Bank accounts may (pending deposits).
create or replace function ledger_check_balance() returns trigger
language plpgsql security definer set search_path = public as $$
declare k account_kind; bal numeric;
begin
  if new.direction = 'out' and new.kind <> 'adjustment' and new.voided_at is null then
    select a.kind into k from accounts a where a.id = new.account_id;
    if k = 'cash' then
      select b.balance into bal from account_balances_all b where b.account_id = new.account_id;
      if bal < new.amount then
        raise exception 'رصيد الكاش غير كافٍ (المتاح %)', to_char(bal, 'FM999999990.00');
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_ledger_check_balance on ledger_entries;
create trigger trg_ledger_check_balance before insert on ledger_entries
  for each row execute function ledger_check_balance();

-- 2) A payment can't exceed what the client still owes, and not on cancelled transactions.
create or replace function record_client_payment(
  p_txn uuid, p_account uuid, p_amount numeric, p_method pay_method, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; st txn_status; rem numeric; eid uuid;
begin
  if not (has_perm('txn.write') or has_perm('treasury.write')) then raise exception 'forbidden'; end if;
  select t.client_id, t.status into cid, st from transactions t where t.id = p_txn and t.deleted_at is null for update;
  if cid is null then raise exception 'المعاملة غير موجودة'; end if;
  if st = 'cancelled' then raise exception 'لا يمكن تسجيل دفعة على معاملة ملغاة'; end if;
  select s.remaining into rem from transaction_payment_summary s where s.transaction_id = p_txn;
  if p_amount > rem + 0.005 then
    raise exception 'المبلغ أكبر من المتبقي على المعاملة (%)', to_char(rem, 'FM999999990.00');
  end if;
  insert into ledger_entries(account_id,direction,kind,amount,method,transaction_id,client_id,description,created_by)
  values (p_account,'in','client_payment',p_amount,p_method,p_txn,cid,p_note,auth.uid())
  returning id into eid;
  return eid;
end $$;

-- ---------- Period report (owner/admin: reports.view) -----------------
create or replace function period_report(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not has_perm('reports.view') then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'income',    coalesce((select sum(l.amount) from ledger_entries l where l.kind='client_payment' and l.voided_at is null and l.occurred_at::date between p_from and p_to),0),
    'govt_paid', coalesce((select sum(l.amount) from ledger_entries l where l.kind='govt_fee'       and l.voided_at is null and l.occurred_at::date between p_from and p_to),0),
    'expenses',  coalesce((select sum(l.amount) from ledger_entries l where l.kind='expense'        and l.voided_at is null and l.occurred_at::date between p_from and p_to),0),
    'billed_fees', coalesce((select sum(t.office_fee - t.discount) from transactions t where t.deleted_at is null and t.status <> 'cancelled' and t.created_at::date between p_from and p_to),0),
    'billed_total', coalesce((select sum(t.total) from transactions t where t.deleted_at is null and t.status <> 'cancelled' and t.created_at::date between p_from and p_to),0),
    'txn_count', (select count(*) from transactions t where t.deleted_at is null and t.created_at::date between p_from and p_to),
    'completed_count', (select count(*) from transactions t where t.deleted_at is null and t.status='completed' and t.completed_at::date between p_from and p_to),
    'expenses_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'total', x.total) order by x.total desc)
      from (select l.category_id, sum(l.amount) total from ledger_entries l
            where l.kind='expense' and l.voided_at is null and l.occurred_at::date between p_from and p_to group by l.category_id) x
      join expense_categories c on c.id = x.category_id), '[]'::jsonb),
    'by_employee', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(p.full_name,'غير محدد'), 'count', x.cnt, 'fees', x.fees) order by x.fees desc)
      from (select t.assignee_id, count(*) cnt, sum(t.office_fee - t.discount) fees from transactions t
            where t.deleted_at is null and t.status <> 'cancelled' and t.created_at::date between p_from and p_to group by t.assignee_id) x
      left join profiles p on p.id = x.assignee_id), '[]'::jsonb),
    'top_clients', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'total', x.total, 'count', x.cnt) order by x.total desc)
      from (select t.client_id, sum(t.total) total, count(*) cnt from transactions t
            where t.deleted_at is null and t.status <> 'cancelled' and t.created_at::date between p_from and p_to
            group by t.client_id order by sum(t.total) desc limit 5) x
      join clients c on c.id = x.client_id), '[]'::jsonb),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', x.method, 'total', x.total))
      from (select l.method, sum(l.amount) total from ledger_entries l
            where l.kind='client_payment' and l.voided_at is null and l.occurred_at::date between p_from and p_to group by l.method) x), '[]'::jsonb),
    'aging', (
      select jsonb_build_object(
        'd0_30',  coalesce(sum(s.remaining) filter (where current_date - t.created_at::date <= 30),0),
        'd31_60', coalesce(sum(s.remaining) filter (where current_date - t.created_at::date between 31 and 60),0),
        'd61_90', coalesce(sum(s.remaining) filter (where current_date - t.created_at::date between 61 and 90),0),
        'd90p',   coalesce(sum(s.remaining) filter (where current_date - t.created_at::date > 90),0),
        'total',  coalesce(sum(s.remaining),0))
      from transaction_payment_summary s join transactions t on t.id = s.transaction_id
      where t.status <> 'cancelled' and s.remaining > 0)
  ) into r;
  return r;
end $$;

-- ---------- Account statement with running balance --------------------
create or replace function account_statement(p_account uuid, p_from date, p_to date)
returns table(entry_at timestamptz, kind text, direction text, amount numeric, description text, txn_ref text, balance numeric, is_opening boolean)
language sql stable security definer set search_path = public as $$
  with guard as (select 1 as ok where has_perm('treasury.view')),
  acc as (select a.opening_balance as ob from accounts a where a.id = p_account),
  pre as (select coalesce(sum(case when l.direction='in' then l.amount else -l.amount end),0) as s
          from ledger_entries l where l.account_id = p_account and l.voided_at is null and l.occurred_at::date < p_from),
  rows as (select l.occurred_at, l.created_at, l.id, l.kind::text as kind, l.direction::text as direction, l.amount, l.description, t.ref_no
           from ledger_entries l left join transactions t on t.id = l.transaction_id
           where l.account_id = p_account and l.voided_at is null and l.occurred_at::date between p_from and p_to),
  base as (select (select ob from acc) + (select s from pre) as b)
  select * from (
    select p_from::timestamptz as entry_at, null::text as kind, null::text as direction, 0::numeric as amount,
           'رصيد أول المدة'::text as description, null::text as txn_ref, (select b from base) as balance, true as is_opening
    where exists (select 1 from guard)
    union all
    select r.occurred_at, r.kind, r.direction, r.amount, r.description, r.ref_no,
           (select b from base) + sum(case when r.direction='in' then r.amount else -r.amount end) over (order by r.occurred_at, r.created_at, r.id),
           false
    from rows r where exists (select 1 from guard)
  ) q order by q.is_opening desc, q.entry_at, q.balance
$$;

-- ---------- Client statement (invoices vs payments) -------------------
create or replace function client_statement(p_client uuid)
returns table(entry_at timestamptz, kind text, ref_no text, description text, debit numeric, credit numeric, balance numeric)
language sql stable security definer set search_path = public as $$
  with ev as (
    select t.created_at as at, 'invoice'::text as k, t.ref_no as ref, t.title as descr, t.total as debit, 0::numeric as credit
    from transactions t where t.client_id = p_client and t.deleted_at is null and t.status <> 'cancelled'
    union all
    select l.occurred_at, 'payment'::text, t.ref_no, coalesce(l.description,'دفعة'), 0::numeric, l.amount
    from ledger_entries l join transactions t on t.id = l.transaction_id
    where l.client_id = p_client and l.kind = 'client_payment' and l.voided_at is null
      and t.deleted_at is null and t.status <> 'cancelled'
  )
  select ev.at, ev.k, ev.ref, ev.descr, ev.debit, ev.credit,
         sum(ev.debit - ev.credit) over (order by ev.at, ev.k desc)
  from ev where is_member()
  order by ev.at, ev.k desc
$$;

grant execute on function period_report(date, date), account_statement(uuid, date, date), client_statement(uuid) to authenticated;
revoke execute on function period_report(date, date), account_statement(uuid, date, date), client_statement(uuid) from anon;
