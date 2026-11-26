-- =====================================================================
-- 0012: custom document types, moving documents, employees inside a company file
-- =====================================================================

-- A person (employee) can sit inside a company's file
alter table clients add column if not exists parent_id uuid references clients(id) on delete set null;
create index if not exists clients_parent_idx on clients (parent_id);

create or replace function clients_check_parent() returns trigger
language plpgsql as $$
declare pk client_kind;
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id then raise exception 'لا يمكن ربط العميل بنفسه'; end if;
  if new.kind = 'company' then raise exception 'الشركة لا تتبع شركة أخرى'; end if;
  select kind into pk from clients where id = new.parent_id;
  if pk is distinct from 'company' then raise exception 'الجهة المختارة ليست شركة'; end if;
  return new;
end $$;
drop trigger if exists trg_clients_parent on clients;
create trigger trg_clients_parent before insert or update of parent_id, kind on clients
  for each row execute function clients_check_parent();

-- Typing a new document type creates it (and reuses it next time)
create or replace function ensure_document_type(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare n text := btrim(coalesce(p_name, '')); v_id uuid;
begin
  if not has_perm('docs.write') then raise exception 'forbidden'; end if;
  if length(n) < 2 then raise exception 'اكتب اسم النوع'; end if;
  select dt.id into v_id from document_types dt where lower(dt.name) = lower(n) limit 1;
  if v_id is null then
    insert into document_types(name, tracks_expiry, sort_order) values (n, true, 100) returning document_types.id into v_id;
  end if;
  return v_id;
end $$;

-- Move documents (with all their older versions) to another client, optionally to one of that client's transactions
create or replace function move_documents(p_ids uuid[], p_client uuid, p_txn uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not has_perm('docs.write') then raise exception 'forbidden'; end if;
  if not exists (select 1 from clients where id = p_client and deleted_at is null) then raise exception 'العميل غير موجود'; end if;
  if p_txn is not null and not exists (select 1 from transactions where id = p_txn and client_id = p_client and deleted_at is null) then
    raise exception 'هذه المعاملة لا تتبع العميل المختار';
  end if;
  update documents set client_id = p_client, transaction_id = p_txn
  where deleted_at is null and group_id in (select group_id from documents where id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function ensure_document_type(text), move_documents(uuid[], uuid, uuid) to authenticated;
revoke execute on function ensure_document_type(text), move_documents(uuid[], uuid, uuid) from anon;

-- Folder (keeps the arrangement of an imported folder tree) and a free classification label
alter table documents add column if not exists folder text;   -- e.g. 'الموظفين/أحمد/الإقامة'
alter table documents add column if not exists tag text;      -- e.g. a place or a batch name
create index if not exists docs_tag_idx on documents (tag) where deleted_at is null;
create index if not exists docs_folder_idx on documents (client_id, folder) where deleted_at is null;
