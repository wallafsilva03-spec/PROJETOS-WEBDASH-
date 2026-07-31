-- =====================================================================
-- Fase 1 · Migration 02 — Tabelas normalizadas, FKs, constraints, índices
-- =====================================================================

-- ---------------------------------------------------------------------
-- Departamentos
-- ---------------------------------------------------------------------
create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null,
  color       text not null default '#1B3F94',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint departments_code_key unique (code),
  constraint departments_name_len check (char_length(name) between 2 and 120)
);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  code          text,
  contact_name  text,
  contact_email text,
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint clients_code_key unique (code),
  constraint clients_email_fmt check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- ---------------------------------------------------------------------
-- Perfis (espelho de auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text not null,
  full_name             text not null default '',
  avatar_url            text,
  job_title             text,
  phone                 text,
  role                  public.app_role not null default 'colaborador',
  department_id         uuid references public.departments (id) on delete set null,
  weekly_capacity_hours numeric(5, 2) not null default 40,
  is_active             boolean not null default true,
  last_seen_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profiles_capacity_range check (weekly_capacity_hours between 0 and 80)
);

create index if not exists idx_profiles_department on public.profiles (department_id);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_name_trgm on public.profiles using gin (full_name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#8CC63F',
  created_at timestamptz not null default now(),
  constraint tags_name_key unique (name)
);

-- ---------------------------------------------------------------------
-- Projetos
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  name             text not null,
  description      text,
  department_id    uuid references public.departments (id) on delete set null,
  client_id        uuid references public.clients (id) on delete set null,
  owner_id         uuid references public.profiles (id) on delete set null,
  status           public.project_status not null default 'backlog',
  priority         public.priority_level not null default 'media',
  complexity       public.complexity_level not null default 'media',
  category         text,
  health           public.health_status not null default 'no_prazo',
  start_date       date not null default current_date,
  due_date         date not null,
  actual_start_date date,
  actual_end_date  date,
  budget           numeric(14, 2) not null default 0,
  cost             numeric(14, 2) not null default 0,
  planned_hours    numeric(10, 2) not null default 0,
  progress         numeric(5, 2) not null default 0,
  position         integer not null default 0,
  is_archived      boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint projects_code_key unique (code),
  constraint projects_dates_chk check (due_date >= start_date),
  constraint projects_progress_chk check (progress between 0 and 100),
  constraint projects_budget_chk check (budget >= 0 and cost >= 0)
);

create index if not exists idx_projects_status on public.projects (status) where is_archived = false;
create index if not exists idx_projects_owner on public.projects (owner_id);
create index if not exists idx_projects_department on public.projects (department_id);
create index if not exists idx_projects_client on public.projects (client_id);
create index if not exists idx_projects_due_date on public.projects (due_date);
create index if not exists idx_projects_health on public.projects (health);
create index if not exists idx_projects_name_trgm on public.projects using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Equipe do projeto
-- ---------------------------------------------------------------------
create table if not exists public.project_members (
  project_id        uuid not null references public.projects (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  role_in_project   text not null default 'membro',
  allocation_percent numeric(5, 2) not null default 100,
  added_at          timestamptz not null default now(),
  primary key (project_id, user_id),
  constraint project_members_alloc_chk check (allocation_percent between 0 and 100)
);

create index if not exists idx_project_members_user on public.project_members (user_id);

-- ---------------------------------------------------------------------
-- Tags do projeto
-- ---------------------------------------------------------------------
create table if not exists public.project_tags (
  project_id uuid not null references public.projects (id) on delete cascade,
  tag_id     uuid not null references public.tags (id) on delete cascade,
  primary key (project_id, tag_id)
);

create index if not exists idx_project_tags_tag on public.project_tags (tag_id);

-- ---------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  parent_task_id  uuid references public.tasks (id) on delete cascade,
  code            text,
  title           text not null,
  description     text,
  status          public.task_status not null default 'backlog',
  priority        public.priority_level not null default 'media',
  assignee_id     uuid references public.profiles (id) on delete set null,
  start_date      date,
  due_date        date,
  completed_at    timestamptz,
  estimated_hours numeric(8, 2) not null default 0,
  progress        numeric(5, 2) not null default 0,
  position        integer not null default 0,
  is_milestone    boolean not null default false,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint tasks_progress_chk check (progress between 0 and 100),
  constraint tasks_dates_chk check (start_date is null or due_date is null or due_date >= start_date),
  constraint tasks_hours_chk check (estimated_hours >= 0),
  constraint tasks_not_self_parent check (parent_task_id is null or parent_task_id <> id)
);

create index if not exists idx_tasks_project on public.tasks (project_id);
create index if not exists idx_tasks_assignee on public.tasks (assignee_id);
create index if not exists idx_tasks_status on public.tasks (project_id, status, position);
create index if not exists idx_tasks_due_date on public.tasks (due_date);
create index if not exists idx_tasks_parent on public.tasks (parent_task_id);
create index if not exists idx_tasks_title_trgm on public.tasks using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Dependências entre tarefas (Gantt / caminho crítico)
-- ---------------------------------------------------------------------
create table if not exists public.task_dependencies (
  id             uuid primary key default gen_random_uuid(),
  predecessor_id uuid not null references public.tasks (id) on delete cascade,
  successor_id   uuid not null references public.tasks (id) on delete cascade,
  type           public.dependency_type not null default 'FS',
  lag_days       integer not null default 0,
  created_at     timestamptz not null default now(),
  constraint task_dependencies_unique unique (predecessor_id, successor_id),
  constraint task_dependencies_no_self check (predecessor_id <> successor_id)
);

create index if not exists idx_task_dep_successor on public.task_dependencies (successor_id);

-- ---------------------------------------------------------------------
-- Checklists (podem pertencer ao projeto ou a uma tarefa)
-- ---------------------------------------------------------------------
create table if not exists public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  task_id     uuid references public.tasks (id) on delete cascade,
  title       text not null,
  is_done     boolean not null default false,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date    date,
  position    integer not null default 0,
  done_at     timestamptz,
  done_by     uuid references public.profiles (id) on delete set null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_checklist_project on public.checklist_items (project_id);
create index if not exists idx_checklist_task on public.checklist_items (task_id);

-- ---------------------------------------------------------------------
-- Marcos
-- ---------------------------------------------------------------------
create table if not exists public.milestones (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  name         text not null,
  description  text,
  due_date     date not null,
  status       public.milestone_status not null default 'pendente',
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_milestones_project on public.milestones (project_id, due_date);

-- ---------------------------------------------------------------------
-- Riscos (heatmap)
-- ---------------------------------------------------------------------
create table if not exists public.risks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null,
  description text,
  probability smallint not null default 3,
  impact      smallint not null default 3,
  severity    smallint generated always as (probability * impact) stored,
  status      public.risk_status not null default 'identificado',
  mitigation  text,
  owner_id    uuid references public.profiles (id) on delete set null,
  due_date    date,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint risks_probability_chk check (probability between 1 and 5),
  constraint risks_impact_chk check (impact between 1 and 5)
);

create index if not exists idx_risks_project on public.risks (project_id);
create index if not exists idx_risks_severity on public.risks (severity desc);

-- ---------------------------------------------------------------------
-- Comentários (chat por projeto/tarefa)
-- ---------------------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id    uuid references public.tasks (id) on delete cascade,
  parent_id  uuid references public.comments (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  edited_at  timestamptz,
  created_at timestamptz not null default now(),
  constraint comments_body_not_empty check (char_length(btrim(body)) > 0)
);

create index if not exists idx_comments_project on public.comments (project_id, created_at desc);
create index if not exists idx_comments_task on public.comments (task_id, created_at desc);
create index if not exists idx_comments_body_trgm on public.comments using gin (body gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Menções (@usuario)
-- ---------------------------------------------------------------------
create table if not exists public.comment_mentions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  primary key (comment_id, user_id)
);

create index if not exists idx_comment_mentions_user on public.comment_mentions (user_id);

-- ---------------------------------------------------------------------
-- Anexos (Supabase Storage)
-- ---------------------------------------------------------------------
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  task_id      uuid references public.tasks (id) on delete cascade,
  comment_id   uuid references public.comments (id) on delete cascade,
  uploader_id  uuid references public.profiles (id) on delete set null,
  bucket_id    text not null default 'project-files',
  storage_path text not null,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint not null default 0,
  created_at   timestamptz not null default now(),
  constraint attachments_path_key unique (bucket_id, storage_path),
  constraint attachments_size_chk check (size_bytes >= 0)
);

create index if not exists idx_attachments_project on public.attachments (project_id);
create index if not exists idx_attachments_task on public.attachments (task_id);

-- ---------------------------------------------------------------------
-- Apontamento de horas
-- ---------------------------------------------------------------------
create table if not exists public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  task_id     uuid references public.tasks (id) on delete set null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  work_date   date not null default current_date,
  hours       numeric(6, 2) not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint time_entries_hours_chk check (hours > 0 and hours <= 24)
);

create index if not exists idx_time_entries_project on public.time_entries (project_id);
create index if not exists idx_time_entries_user_date on public.time_entries (user_id, work_date);

-- ---------------------------------------------------------------------
-- Notificações em tempo real
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.notification_type not null default 'sistema',
  title       text not null,
  body        text,
  project_id  uuid references public.projects (id) on delete cascade,
  entity_type text,
  entity_id   uuid,
  actor_id    uuid references public.profiles (id) on delete set null,
  is_read     boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, is_read, created_at desc);

-- ---------------------------------------------------------------------
-- Centro de atividades
-- ---------------------------------------------------------------------
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  summary     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_activity_project on public.activity_log (project_id, created_at desc);
create index if not exists idx_activity_created on public.activity_log (created_at desc);

-- ---------------------------------------------------------------------
-- Auditoria (quem alterou, quando, valor antigo x novo)
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id             bigint generated always as identity primary key,
  table_name     text not null,
  record_id      uuid,
  action         public.audit_action not null,
  actor_id       uuid references public.profiles (id) on delete set null,
  old_data       jsonb,
  new_data       jsonb,
  changed_fields text[],
  created_at     timestamptz not null default now()
);

create index if not exists idx_audit_record on public.audit_log (table_name, record_id, created_at desc);
create index if not exists idx_audit_actor on public.audit_log (actor_id, created_at desc);

-- ---------------------------------------------------------------------
-- Presença (usuários online)
-- ---------------------------------------------------------------------
create table if not exists public.user_presence (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  status     text not null default 'online',
  last_ping  timestamptz not null default now()
);
