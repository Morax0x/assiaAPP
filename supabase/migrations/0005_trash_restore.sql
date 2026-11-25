-- =====================================================================
-- 0005: restore deleted records (soft delete is already in 0002)
-- =====================================================================
create or replace function restore_record(p_table text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_table = 'clients' then
    if not has_perm('clients.delete') then raise exception 'forbidden'; end if;
    update clients set deleted_at = null where id = p_id;
  elsif p_table = 'transactions' then
    if not has_perm('txn.delete') then raise exception 'forbidden'; end if;
    -- a transaction can only come back if its client is active
    if exists (select 1 from transactions t join clients c on c.id = t.client_id where t.id = p_id and c.deleted_at is not null) then
      raise exception 'استرجع العميل أولاً';
    end if;
    update transactions set deleted_at = null where id = p_id;
  elsif p_table = 'documents' then
    if not has_perm('docs.delete') then raise exception 'forbidden'; end if;
    if exists (select 1 from documents d join clients c on c.id = d.client_id where d.id = p_id and c.deleted_at is not null) then
      raise exception 'استرجع العميل أولاً';
    end if;
    update documents set deleted_at = null where id = p_id;
  else raise exception 'unsupported table';
  end if;
  insert into audit_log(user_id, action, entity, entity_id) values (auth.uid(), 'restore', p_table, p_id::text);
end $$;
grant execute on function restore_record(text, uuid) to authenticated;
revoke execute on function restore_record(text, uuid) from anon;
