-- =====================================================================
-- Fase 1 · Migration 04 — Triggers
-- =====================================================================

-- ---------------------------------------------------------------------
-- Provisionamento de perfil no cadastro (Supabase Auth)
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'departments', 'clients', 'profiles', 'milestones', 'risks', 'time_entries'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.tg_set_updated_at()', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Inteligência do projeto (health, datas reais, progresso travado)
-- ---------------------------------------------------------------------
drop trigger if exists project_intelligence on public.projects;
create trigger project_intelligence
  before insert or update on public.projects
  for each row execute function public.tg_project_intelligence();

drop trigger if exists project_activity on public.projects;
create trigger project_activity
  after insert or update on public.projects
  for each row execute function public.tg_log_project_activity();

-- ---------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------
drop trigger if exists task_intelligence on public.tasks;
create trigger task_intelligence
  before insert or update on public.tasks
  for each row execute function public.tg_task_intelligence();

drop trigger if exists task_recalc_project on public.tasks;
create trigger task_recalc_project
  after insert or update or delete on public.tasks
  for each row execute function public.tg_task_after_change();

drop trigger if exists task_reschedule on public.tasks;
create trigger task_reschedule
  after update on public.tasks
  for each row execute function public.tg_task_reschedule();

drop trigger if exists task_notify on public.tasks;
create trigger task_notify
  after insert or update on public.tasks
  for each row execute function public.tg_notify_task();

-- ---------------------------------------------------------------------
-- Checklist
-- ---------------------------------------------------------------------
drop trigger if exists checklist_done on public.checklist_items;
create trigger checklist_done
  before update on public.checklist_items
  for each row execute function public.tg_checklist_done();

-- ---------------------------------------------------------------------
-- Comentários e menções
-- ---------------------------------------------------------------------
drop trigger if exists comment_notify on public.comments;
create trigger comment_notify
  after insert on public.comments
  for each row execute function public.tg_notify_comment();

drop trigger if exists mention_notify on public.comment_mentions;
create trigger mention_notify
  after insert on public.comment_mentions
  for each row execute function public.tg_notify_mention();

-- ---------------------------------------------------------------------
-- Auditoria — valor antigo x valor novo em todas as entidades sensíveis
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'tasks', 'project_members', 'checklist_items',
    'milestones', 'risks', 'time_entries', 'attachments', 'profiles'
  ] loop
    execute format('drop trigger if exists audit_changes on public.%I', t);
    execute format(
      'create trigger audit_changes
         after insert or update or delete on public.%I
         for each row execute function public.tg_audit()', t
    );
  end loop;
end $$;
