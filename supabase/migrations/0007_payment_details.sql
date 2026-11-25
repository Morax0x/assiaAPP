-- =====================================================================
-- 0007: payment details (date, reference, payer, receipt), who-did-what,
--       transaction history, extra document types
-- =====================================================================

alter table ledger_entries add column if not exists reference_no text;   -- transfer / card / cheque number
alter table ledger_entries add column if not exists paid_by text;        -- name of the person who paid / transferred

-- ---------- Record a client payment (with full details) ---------------
drop function if exists record_client_payment(uuid, uuid, numeric, pay_method, text);
create or replace function record_client_payment(
  p_txn uuid, p_account uuid, p_amount numeric, p_method pay_method, p_note text default null,
  p_occurred_at date default null, p_reference text default null, p_receipt text default null, p_paid_by text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; st txn_status; rem numeric; eid uuid; d date := coalesce(p_occurred_at, current_date);
begin
  if not (has_perm('txn.write') or has_perm('treasury.write')) then raise exception 'forbidden'; end if;
  if d > current_date + 1 then raise exception 'تاريخ الدفعة لا يمكن أن يكون في المستقبل'; end if;
  if p_receipt is not null and p_receipt <> '' and p_receipt not like 'receipts/%' then raise exception 'مسار الإيصال غير صالح'; end if;
  select t.client_id, t.status into cid, st from transactions t where t.id = p_txn and t.deleted_at is null for update;
  if cid is null then raise exception 'المعاملة غير موجودة'; end if;
  if st = 'cancelled' then raise exception 'لا يمكن تسجيل دفعة على معاملة ملغاة'; end if;
  select s.remaining into rem from transaction_payment_summary s where s.transaction_id = p_txn;
  if p_amount > rem + 0.005 then
    raise exception 'المبلغ أكبر من المتبقي على المعاملة (%)', to_char(rem, 'FM999999990.00');
  end if;
  insert into ledger_entries(account_id,direction,kind,amount,method,transaction_id,client_id,description,
                             occurred_at,reference_no,receipt_path,paid_by,created_by)
  values (p_account,'in','client_payment',p_amount,p_method,p_txn,cid,nullif(p_note,''),
          d::timestamptz + (now()::time)::interval, nullif(p_reference,''), nullif(p_receipt,''), nullif(p_paid_by,''), auth.uid())
  returning id into eid;
  return eid;
end $$;

-- ---------- Record a government-fee payout (with details) -------------
drop function if exists record_govt_fee(uuid, uuid, numeric, pay_method, text);
create or replace function record_govt_fee(
  p_txn uuid, p_account uuid, p_amount numeric, p_method pay_method, p_note text default null,
  p_occurred_at date default null, p_reference text default null, p_receipt text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; eid uuid; d date := coalesce(p_occurred_at, current_date);
begin
  if not has_perm('treasury.write') then raise exception 'forbidden'; end if;
  if d > current_date + 1 then raise exception 'التاريخ لا يمكن أن يكون في المستقبل'; end if;
  if p_receipt is not null and p_receipt <> '' and p_receipt not like 'receipts/%' then raise exception 'مسار الإيصال غير صالح'; end if;
  select client_id into cid from transactions where id = p_txn and deleted_at is null;
  if cid is null then raise exception 'المعاملة غير موجودة'; end if;
  insert into ledger_entries(account_id,direction,kind,amount,method,transaction_id,client_id,description,
                             occurred_at,reference_no,receipt_path,created_by)
  values (p_account,'out','govt_fee',p_amount,p_method,p_txn,cid,nullif(p_note,''),
          d::timestamptz + (now()::time)::interval, nullif(p_reference,''), nullif(p_receipt,''), auth.uid())
  returning id into eid;
  return eid;
end $$;

-- ---------- Internal transfer with date + reference -------------------
drop function if exists record_internal_transfer(uuid, uuid, numeric, text);
create or replace function record_internal_transfer(
  p_from uuid, p_to uuid, p_amount numeric, p_note text default null,
  p_occurred_at date default null, p_reference text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid := gen_random_uuid(); d date := coalesce(p_occurred_at, current_date);
begin
  if not has_perm('treasury.write') then raise exception 'forbidden'; end if;
  if p_from = p_to then raise exception 'اختر حسابين مختلفين'; end if;
  if d > current_date + 1 then raise exception 'التاريخ لا يمكن أن يكون في المستقبل'; end if;
  insert into ledger_entries(account_id,direction,kind,amount,transfer_id,description,occurred_at,reference_no,created_by)
  values (p_from,'out','transfer',p_amount,tid,nullif(p_note,''), d::timestamptz + (now()::time)::interval, nullif(p_reference,''), auth.uid()),
         (p_to,  'in', 'transfer',p_amount,tid,nullif(p_note,''), d::timestamptz + (now()::time)::interval, nullif(p_reference,''), auth.uid());
  return tid;
end $$;

-- ---------- Payments of a transaction (safe for staff) ----------------
drop function if exists transaction_payments(uuid);
create or replace function transaction_payments(p_txn uuid)
returns table(id uuid, amount numeric, method pay_method, occurred_at timestamptz, description text, voided boolean,
              reference_no text, paid_by text, has_receipt boolean, recorded_by text)
language sql stable security definer set search_path = public as $$
  select l.id, l.amount, l.method, l.occurred_at, l.description, (l.voided_at is not null),
         l.reference_no, l.paid_by, (l.receipt_path is not null), p.full_name
  from ledger_entries l left join profiles p on p.id = l.created_by
  where l.transaction_id = p_txn and l.kind = 'client_payment' and is_member()
  order by l.occurred_at, l.created_at
$$;

-- Path of a payment receipt (members may open client-payment receipts; treasury viewers may open any)
create or replace function payment_receipt_path(p_entry uuid) returns text
language sql stable security definer set search_path = public as $$
  select l.receipt_path from ledger_entries l
  where l.id = p_entry and l.receipt_path is not null
    and ((l.kind = 'client_payment' and is_member()) or has_perm('treasury.view'))
$$;

-- ---------- Transaction history (who did what, when) ------------------
create or replace function transaction_history(p_txn uuid)
returns table(id bigint, at timestamptz, user_name text, entity text, action text, old_data jsonb, new_data jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.at, p.full_name, a.entity, a.action, a.old_data, a.new_data
  from audit_log a left join profiles p on p.id = a.user_id
  where is_member() and (
        (a.entity = 'transactions' and a.entity_id = p_txn::text)
     or (a.entity = 'documents' and coalesce(a.new_data, a.old_data) ->> 'transaction_id' = p_txn::text)
     or (a.entity = 'ledger_entries' and coalesce(a.new_data, a.old_data) ->> 'transaction_id' = p_txn::text
         and (coalesce(a.new_data, a.old_data) ->> 'kind' = 'client_payment' or has_perm('treasury.view')))
  )
  order by a.at desc, a.id desc
  limit 60
$$;

-- ---------- Who registered a transaction (list view; new column appended) ----
create or replace view transactions_list as
select t.id, t.ref_no, t.client_id, c.name as client_name, c.phone as client_phone,
       t.assignee_id, p.full_name as assignee_name, t.title, t.status,
       t.govt_fees, t.office_fee, t.discount, t.total, t.due_date,
       t.created_at, t.completed_at,
       s.paid, s.remaining, s.payment_status,
       cb.full_name as created_by_name
from transactions t
join clients c on c.id = t.client_id
left join profiles p on p.id = t.assignee_id
left join profiles cb on cb.id = t.created_by
join transaction_payment_summary s on s.transaction_id = t.id
where t.deleted_at is null and is_member();

-- ---------- Extra document types for invoices and receipts ------------
insert into document_types(name, tracks_expiry, sort_order) values
  ('فاتورة', false, 11), ('إيصال دفع', false, 12), ('حوالة بنكية', false, 13), ('شيك', false, 14)
on conflict (name) do nothing;

grant execute on function transaction_history(uuid), payment_receipt_path(uuid), transaction_payments(uuid) to authenticated;
revoke execute on function transaction_history(uuid), payment_receipt_path(uuid) from anon;
