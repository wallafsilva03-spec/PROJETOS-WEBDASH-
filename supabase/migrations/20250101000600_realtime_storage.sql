-- =====================================================================
-- Fase 1 · Migration 07 — Realtime e Storage
-- =====================================================================

-- ---------------------------------------------------------------------
-- REALTIME — publicação das tabelas que o frontend escuta
-- REPLICA IDENTITY FULL é necessário para receber o registro antigo no
-- payload de UPDATE/DELETE (usado para invalidar o cache correto).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'tasks', 'checklist_items', 'comments', 'attachments',
    'notifications', 'activity_log', 'project_members', 'milestones',
    'risks', 'time_entries', 'task_dependencies', 'user_presence'
  ] loop
    execute format('alter table public.%I replica identity full', t);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- STORAGE — buckets
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('project-files', 'project-files', false, 52428800, null),
  ('avatars', 'avatars', true, 5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Convenção de caminho: project-files/{project_id}/{uuid}-{arquivo}
create or replace function public.storage_project_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return (string_to_array(p_name, '/'))[1]::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- STORAGE — políticas
-- ---------------------------------------------------------------------
drop policy if exists "project files select" on storage.objects;
create policy "project files select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_read_project(public.storage_project_id(name))
  );

drop policy if exists "project files insert" on storage.objects;
create policy "project files insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and public.can_read_project(public.storage_project_id(name))
  );

drop policy if exists "project files delete" on storage.objects;
create policy "project files delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-files'
    and (owner = auth.uid() or public.can_manage_project(public.storage_project_id(name)))
  );

-- Avatares: leitura pública, escrita apenas na própria pasta {user_id}/...
drop policy if exists "avatars select" on storage.objects;
create policy "avatars select" on storage.objects
  for select to public using (bucket_id = 'avatars');

drop policy if exists "avatars write" on storage.objects;
create policy "avatars write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (string_to_array(name, '/'))[1] = auth.uid()::text);

drop policy if exists "avatars update" on storage.objects;
create policy "avatars update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (string_to_array(name, '/'))[1] = auth.uid()::text);

drop policy if exists "avatars delete" on storage.objects;
create policy "avatars delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (string_to_array(name, '/'))[1] = auth.uid()::text);
