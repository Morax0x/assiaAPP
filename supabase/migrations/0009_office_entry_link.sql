-- =====================================================================
-- 0009: one office entry link (pin it in the WhatsApp group) + personal PIN
-- =====================================================================
-- The single shared link only lets a device reach the "choose your name" page.
-- Each person then enters their own PIN, so actions are still recorded per person.

create table office_access (
  id         boolean primary key default true check (id),   -- one row only
  token      text,                                          -- the secret in the shared link (server only)
  enabled    boolean not null default false,
  rotated_at timestamptz,
  rotated_by uuid references profiles(id)
);
insert into office_access default values;
alter table office_access enable row level security;        -- no policies: only the server (service role) reads it

create table user_pins (
  user_id      uuid primary key references profiles(id) on delete cascade,
  pin_hash     text not null,
  attempts     int  not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);
alter table user_pins enable row level security;            -- no policies: PINs are never readable from the browser

-- Forgot PIN: the person chooses a new one next time they enter
create or replace function reset_user_pin(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare target user_role;
begin
  if not has_perm('users.manage') then raise exception 'forbidden'; end if;
  select role into target from profiles where id = p_user;
  if target is null then raise exception 'المستخدم غير موجود'; end if;
  if auth_role() <> 'owner' and target <> 'staff' then raise exception 'forbidden'; end if;
  delete from user_pins where user_id = p_user;
end $$;

-- Lost phone: sign the person out of every device
create or replace function revoke_user_sessions(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare target user_role;
begin
  if not has_perm('users.manage') then raise exception 'forbidden'; end if;
  select role into target from profiles where id = p_user;
  if target is null then raise exception 'المستخدم غير موجود'; end if;
  if auth_role() <> 'owner' and target <> 'staff' then raise exception 'forbidden'; end if;
  delete from auth.sessions where user_id = p_user;
end $$;

grant execute on function reset_user_pin(uuid), revoke_user_sessions(uuid) to authenticated;
revoke execute on function reset_user_pin(uuid), revoke_user_sessions(uuid) from anon;
