-- Sub-folders created by hand inside a client's folder (so an empty folder can exist before any file is put in it).
-- Folders that come from a document's `folder` path are still derived from the documents themselves.
create table document_folders (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  path       text not null check (length(trim(path)) > 0),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (client_id, path)
);
alter table document_folders enable row level security;
create policy document_folders_read   on document_folders for select to authenticated using (true);
create policy document_folders_insert on document_folders for insert to authenticated with check (true);
create policy document_folders_delete on document_folders for delete to authenticated using (true);
