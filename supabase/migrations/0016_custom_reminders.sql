-- Free-form reminders: not tied to any document. The user writes the text and picks the date.
create table reminders (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  note        text,
  remind_date date not null,
  client_id   uuid references clients(id),
  done        boolean not null default false,
  done_at     timestamptz,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index reminders_date_idx on reminders (done, remind_date);
alter table reminders enable row level security;
create policy reminders_read   on reminders for select to authenticated using (true);
create policy reminders_insert on reminders for insert to authenticated with check (true);
create policy reminders_update on reminders for update to authenticated using (true);
create policy reminders_delete on reminders for delete to authenticated using (true);
