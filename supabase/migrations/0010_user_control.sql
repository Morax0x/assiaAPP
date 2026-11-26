-- =====================================================================
-- 0010: full control over users — free job title, notes, archive, per-person permissions
-- =====================================================================
alter table profiles
  add column if not exists job_title text,        -- free text shown instead of fixed role names
  add column if not exists notes text,
  add column if not exists archived_at timestamptz;

-- Permissions chosen per person. They override the role defaults.
create table user_permissions (
  user_id    uuid not null references profiles(id) on delete cascade,
  permission text not null,
  allowed    boolean not null,
  primary key (user_id, permission)
);
alter table user_permissions enable row level security;
create policy uperm_read on user_permissions for select using (user_id = auth.uid() or has_perm('users.manage'));
-- no write policies: changes go through set_user_permissions()

create or replace function has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when pr.role = 'owner' then true
      else coalesce(
        (select up.allowed from user_permissions up where up.user_id = pr.id and up.permission = p),
        (select rp.allowed from role_permissions rp where rp.role = pr.role and rp.permission = p),
        false) end
    from profiles pr where pr.id = auth.uid() and pr.is_active and pr.archived_at is null), false)
$$;

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and is_active and archived_at is null)
$$;

-- Set exactly which permissions a person has (list of allowed keys).
create or replace function set_user_permissions(p_user uuid, p_allowed jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare target user_role; k text; all_keys text[]; allowed_keys text[];
begin
  if not has_perm('users.manage') then raise exception 'forbidden'; end if;
  select role into target from profiles where id = p_user;
  if target is null then raise exception 'المستخدم غير موجود'; end if;
  if target = 'owner' then raise exception 'لا يمكن تغيير صلاحيات المالك'; end if;
  if auth_role() <> 'owner' and p_user = auth.uid() then raise exception 'لا يمكنك تعديل صلاحياتك بنفسك'; end if;
  select array(select distinct permission from role_permissions) into all_keys;
  select array(select jsonb_array_elements_text(p_allowed)) into allowed_keys;
  foreach k in array allowed_keys loop
    if not (k = any(all_keys)) then raise exception 'صلاحية غير معروفة: %', k; end if;
    if auth_role() <> 'owner' and not has_perm(k) then raise exception 'لا يمكنك منح صلاحية لا تملكها'; end if;
  end loop;
  delete from user_permissions where user_id = p_user;
  insert into user_permissions(user_id, permission, allowed) select p_user, x, (x = any(allowed_keys)) from unnest(all_keys) x;
end $$;

-- Anyone with users.manage may manage everyone except the owner
create or replace function reset_user_pin(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare target user_role;
begin
  if not has_perm('users.manage') then raise exception 'forbidden'; end if;
  select role into target from profiles where id = p_user;
  if target is null then raise exception 'المستخدم غير موجود'; end if;
  if auth_role() <> 'owner' and target = 'owner' then raise exception 'forbidden'; end if;
  delete from user_pins where user_id = p_user;
end $$;

create or replace function revoke_user_sessions(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare target user_role;
begin
  if not has_perm('users.manage') then raise exception 'forbidden'; end if;
  select role into target from profiles where id = p_user;
  if target is null then raise exception 'المستخدم غير موجود'; end if;
  if auth_role() <> 'owner' and target = 'owner' then raise exception 'forbidden'; end if;
  delete from auth.sessions where user_id = p_user;
end $$;

grant execute on function set_user_permissions(uuid, jsonb) to authenticated;
revoke execute on function set_user_permissions(uuid, jsonb) from anon;
