-- =====================================================================
-- Fase 1 · Migration 06 — Row Level Security
-- Perfis: administrador > gerente > lider > colaborador
-- =====================================================================

alter table public.departments      enable row level security;
alter table public.clients          enable row level security;
alter table public.profiles         enable row level security;
alter table public.tags             enable row level security;
alter table public.projects         enable row level security;
alter table public.project_members  enable row level security;
alter table public.project_tags     enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.checklist_items  enable row level security;
alter table public.milestones       enable row level security;
alter table public.risks            enable row level security;
alter table public.comments         enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.attachments      enable row level security;
alter table public.time_entries     enable row level security;
alter table public.notifications    enable row level security;
alter table public.activity_log     enable row level security;
alter table public.audit_log        enable row level security;
alter table public.user_presence    enable row level security;

-- ---------------------------------------------------------------------
-- PROFILES — todos leem (para menções, responsáveis e avatares)
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_app_role());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- CADASTROS AUXILIARES — leitura geral, escrita para gestão
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['departments', 'clients', 'tags'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)', t || '_select', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_manager()) with check (public.is_manager())', t || '_write', t
    );
  end loop;
end $$;

-- Qualquer usuário pode criar tags novas ao classificar um projeto.
drop policy if exists tags_insert_any on public.tags;
create policy tags_insert_any on public.tags
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------
-- PROJECTS
-- ---------------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (public.is_manager() or public.is_project_member(id));

-- Como em `is_manager()`, a comparação é textual para esta migration
-- continuar carregando depois que a 11 renomeia `gerente` para `analista`.
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.current_app_role()::text in ('administrador', 'gerente', 'analista', 'lider'));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.can_manage_project(id))
  with check (public.can_manage_project(id));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- PROJECT MEMBERS / TAGS
-- ---------------------------------------------------------------------
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select to authenticated
  using (public.can_read_project(project_id) or user_id = auth.uid());

drop policy if exists project_members_write on public.project_members;
create policy project_members_write on public.project_members
  for all to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

drop policy if exists project_tags_select on public.project_tags;
create policy project_tags_select on public.project_tags
  for select to authenticated using (public.can_read_project(project_id));

drop policy if exists project_tags_write on public.project_tags;
create policy project_tags_write on public.project_tags
  for all to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

-- ---------------------------------------------------------------------
-- TASKS — colaborador edita as tarefas que lhe pertencem
-- ---------------------------------------------------------------------
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (public.can_read_project(project_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated with check (public.can_read_project(project_id));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.can_manage_project(project_id)
    or assignee_id = auth.uid()
    or created_by = auth.uid()
  )
  with check (public.can_read_project(project_id));

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.can_manage_project(project_id) or created_by = auth.uid());

drop policy if exists task_dependencies_select on public.task_dependencies;
create policy task_dependencies_select on public.task_dependencies
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = successor_id and public.can_read_project(t.project_id)));

drop policy if exists task_dependencies_write on public.task_dependencies;
create policy task_dependencies_write on public.task_dependencies
  for all to authenticated
  using (exists (select 1 from public.tasks t where t.id = successor_id and public.can_manage_project(t.project_id)))
  with check (exists (select 1 from public.tasks t where t.id = successor_id and public.can_manage_project(t.project_id)));

-- ---------------------------------------------------------------------
-- CHECKLIST / MARCOS / RISCOS
-- ---------------------------------------------------------------------
drop policy if exists checklist_select on public.checklist_items;
create policy checklist_select on public.checklist_items
  for select to authenticated using (public.can_read_project(project_id));

drop policy if exists checklist_write on public.checklist_items;
create policy checklist_write on public.checklist_items
  for all to authenticated
  using (public.can_read_project(project_id))
  with check (public.can_read_project(project_id));

drop policy if exists milestones_select on public.milestones;
create policy milestones_select on public.milestones
  for select to authenticated using (public.can_read_project(project_id));

drop policy if exists milestones_write on public.milestones;
create policy milestones_write on public.milestones
  for all to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

drop policy if exists risks_select on public.risks;
create policy risks_select on public.risks
  for select to authenticated using (public.can_read_project(project_id));

drop policy if exists risks_write on public.risks;
create policy risks_write on public.risks
  for all to authenticated
  using (public.can_manage_project(project_id) or created_by = auth.uid())
  with check (public.can_read_project(project_id));

-- ---------------------------------------------------------------------
-- COMENTÁRIOS / MENÇÕES
-- ---------------------------------------------------------------------
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using (public.can_read_project(project_id));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_read_project(project_id));

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated
  using (author_id = auth.uid() or public.can_manage_project(project_id));

drop policy if exists comment_mentions_select on public.comment_mentions;
create policy comment_mentions_select on public.comment_mentions
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.comments c where c.id = comment_id and public.can_read_project(c.project_id))
  );

drop policy if exists comment_mentions_insert on public.comment_mentions;
create policy comment_mentions_insert on public.comment_mentions
  for insert to authenticated
  with check (exists (select 1 from public.comments c where c.id = comment_id and c.author_id = auth.uid()));

-- ---------------------------------------------------------------------
-- ANEXOS
-- ---------------------------------------------------------------------
drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
  for select to authenticated using (public.can_read_project(project_id));

drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (uploader_id = auth.uid() and public.can_read_project(project_id));

drop policy if exists attachments_delete on public.attachments;
create policy attachments_delete on public.attachments
  for delete to authenticated
  using (uploader_id = auth.uid() or public.can_manage_project(project_id));

-- ---------------------------------------------------------------------
-- APONTAMENTO DE HORAS
-- ---------------------------------------------------------------------
drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries
  for select to authenticated
  using (user_id = auth.uid() or public.can_read_project(project_id));

drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_read_project(project_id));

drop policy if exists time_entries_modify on public.time_entries;
create policy time_entries_modify on public.time_entries
  for update to authenticated
  using (user_id = auth.uid() or public.can_manage_project(project_id))
  with check (user_id = auth.uid() or public.can_manage_project(project_id));

drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (user_id = auth.uid() or public.can_manage_project(project_id));

-- ---------------------------------------------------------------------
-- NOTIFICAÇÕES — estritamente pessoais
-- ---------------------------------------------------------------------
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- ATIVIDADES E AUDITORIA
-- ---------------------------------------------------------------------
drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log
  for select to authenticated
  using (project_id is null or public.can_read_project(project_id));

drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------
-- PRESENÇA
-- ---------------------------------------------------------------------
drop policy if exists presence_select on public.user_presence;
create policy presence_select on public.user_presence
  for select to authenticated using (true);

drop policy if exists presence_upsert on public.user_presence;
create policy presence_upsert on public.user_presence
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- audit_log é somente leitura para o cliente: a escrita ocorre via trigger SECURITY DEFINER.
revoke insert, update, delete on public.audit_log from authenticated;
revoke insert, update, delete on public.activity_log from authenticated;
