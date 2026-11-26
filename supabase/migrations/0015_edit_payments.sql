-- Edit a recorded payment (amount, method, account, date, reference, payer, note). The audit log keeps the old values.
create or replace function update_client_payment(
  p_id uuid, p_account uuid, p_amount numeric, p_method pay_method, p_note text default null,
  p_occurred_at date default null, p_reference text default null, p_paid_by text default null
) returns void language plpgsql security definer set search_path = public as $$
declare e ledger_entries; rem numeric; d date;
begin
  if not (has_perm('txn.write') or has_perm('treasury.write')) then raise exception 'forbidden'; end if;
  select * into e from ledger_entries where id = p_id and kind = 'client_payment' and voided_at is null for update;
  if not found then raise exception 'الدفعة غير موجودة أو ملغاة'; end if;
  if p_amount <= 0 then raise exception 'المبلغ يجب أن يكون أكبر من صفر'; end if;
  d := coalesce(p_occurred_at, e.occurred_at::date);
  if d > current_date + 1 then raise exception 'تاريخ الدفعة لا يمكن أن يكون في المستقبل'; end if;
  select s.remaining into rem from transaction_payment_summary s where s.transaction_id = e.transaction_id;
  if p_amount > coalesce(rem, 0) + e.amount + 0.005 then
    raise exception 'المبلغ أكبر من المتبقي على المعاملة (%)', to_char(coalesce(rem, 0) + e.amount, 'FM999999990.00');
  end if;
  update ledger_entries set
    account_id = p_account, amount = p_amount, method = p_method, description = nullif(p_note, ''),
    occurred_at = case when d = e.occurred_at::date then e.occurred_at else d::timestamptz + (now()::time)::interval end,
    reference_no = nullif(p_reference, ''), paid_by = nullif(p_paid_by, '')
  where id = p_id;
end $$;

-- payments list now also tells which account each payment went into
drop function if exists transaction_payments(uuid);
create or replace function transaction_payments(p_txn uuid)
returns table(id uuid, amount numeric, method pay_method, occurred_at timestamptz, description text, voided boolean,
              reference_no text, paid_by text, has_receipt boolean, recorded_by text, account_id uuid)
language sql stable security definer set search_path = public as $$
  select l.id, l.amount, l.method, l.occurred_at, l.description, (l.voided_at is not null),
         l.reference_no, l.paid_by, (l.receipt_path is not null), p.full_name, l.account_id
  from ledger_entries l left join profiles p on p.id = l.created_by
  where l.transaction_id = p_txn and l.kind = 'client_payment' and is_member()
  order by l.occurred_at, l.created_at
$$;

grant execute on function update_client_payment(uuid, uuid, numeric, pay_method, text, date, text, text), transaction_payments(uuid) to authenticated;
revoke execute on function update_client_payment(uuid, uuid, numeric, pay_method, text, date, text, text), transaction_payments(uuid) from anon;
