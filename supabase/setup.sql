-- =====================================================================
-- WEBDASH · Gestão de Projetos Corporativos — Grupo Moreno
-- ARQUIVO ÚNICO DE INSTALAÇÃO
--
-- Gerado automaticamente por scripts/build-setup-sql.mjs.
-- Não edite este arquivo: altere as migrations em supabase/migrations
-- e rode `npm run db:setup-sql`.
--
-- Como usar:
--   1. Abra o SQL Editor do seu projeto no Supabase
--   2. Cole TODO o conteúdo deste arquivo
--   3. Execute (Run)
--
-- É seguro executar mais de uma vez: tudo usa if not exists / or replace.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250101000000_extensions_and_enums.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- WEBDASH · Gestão de Projetos Corporativos — Grupo Moreno
-- Fase 1 · Migration 01 — Extensões e tipos enumerados
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------
-- Perfis de acesso da plataforma
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('administrador', 'gerente', 'lider', 'colaborador');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Colunas do Kanban / status de projeto e tarefa
-- ---------------------------------------------------------------------
do $$ begin
  create type public.project_status as enum (
    'backlog', 'planejamento', 'em_desenvolvimento', 'homologacao', 'concluido', 'cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum (
    'backlog', 'planejamento', 'em_desenvolvimento', 'homologacao', 'concluido'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.priority_level as enum ('baixa', 'media', 'alta', 'critica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.complexity_level as enum ('baixa', 'media', 'alta', 'muito_alta');
exception when duplicate_object then null; end $$;

-- Saúde calculada automaticamente pela inteligência do projeto
do $$ begin
  create type public.health_status as enum ('adiantado', 'no_prazo', 'em_risco', 'atrasado', 'critico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dependency_type as enum ('FS', 'SS', 'FF', 'SF');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.risk_status as enum ('identificado', 'em_mitigacao', 'mitigado', 'aceito', 'materializado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.milestone_status as enum ('pendente', 'em_andamento', 'concluido', 'atrasado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'comentario', 'mencao', 'tarefa_atribuida', 'tarefa_status', 'prazo_hoje',
    'prazo_amanha', 'projeto_atrasado', 'projeto_risco', 'checklist', 'arquivo', 'sistema'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_action as enum ('INSERT', 'UPDATE', 'DELETE');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250101000100_tables.sql
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250101000200_functions.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 1 · Migration 03 — Database Functions
-- =====================================================================

-- ---------------------------------------------------------------------
-- HELPERS DE AUTORIZAÇÃO
-- SECURITY DEFINER para evitar recursão infinita nas policies de RLS.
-- ---------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role = 'administrador' from public.profiles p where p.id = auth.uid()), false);
$$;

-- Administrador e Analista (o antigo Gerente) enxergam o portfólio inteiro.
--
-- A comparação é feita com `role::text` de propósito: a migration 11 troca o
-- rótulo `gerente` por `analista`, e um literal de enum aqui faria esta
-- migration parar de carregar em banco já migrado — quebrando a promessa de
-- que o setup.sql pode ser executado quantas vezes for preciso. A versão
-- final desta função está na migration 11.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role::text in ('administrador', 'gerente', 'analista')
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = auth.uid()
  ) or exists (
    select 1 from public.projects pr
    where pr.id = p_project_id and (pr.owner_id = auth.uid() or pr.created_by = auth.uid())
  );
$$;

-- Quem pode editar o projeto: admin, gerente, dono ou líder membro da equipe.
create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_manager()
      or exists (select 1 from public.projects pr where pr.id = p_project_id and pr.owner_id = auth.uid())
      or exists (
           select 1
           from public.project_members m
           join public.profiles p on p.id = m.user_id
           where m.project_id = p_project_id and m.user_id = auth.uid() and p.role = 'lider'
         );
$$;

-- Acesso de leitura ao projeto (usado por todas as tabelas filhas).
create or replace function public.can_read_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_manager() or public.is_project_member(p_project_id);
$$;

-- ---------------------------------------------------------------------
-- UTILITÁRIOS DE CALENDÁRIO
-- ---------------------------------------------------------------------
-- Dias úteis (seg–sex) entre duas datas, inclusive nos dois extremos.
create or replace function public.business_days(p_start date, p_end date)
returns integer
language sql
immutable
as $$
  select case
    when p_start is null or p_end is null or p_end < p_start then 0
    else (
      select count(*)::int
      from generate_series(p_start, p_end, interval '1 day') d
      where extract(isodow from d) < 6
    )
  end;
$$;

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Provisionamento de perfil ao criar usuário no Supabase Auth
-- ---------------------------------------------------------------------
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_is_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_is_first;

  begin
    v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'colaborador');
  exception when others then
    v_role := 'colaborador';
  end;

  -- O primeiro usuário cadastrado assume a administração da plataforma.
  if v_is_first then
    v_role := 'administrador';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    v_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- AUDITORIA GENÉRICA — quem alterou, quando, valor antigo e novo
-- ---------------------------------------------------------------------
create or replace function public.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_record_id uuid;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_old := null;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select array_agg(key order by key)
      into v_changed
      from jsonb_each(v_new) e(key, value)
     where v_old -> e.key is distinct from e.value
       and e.key <> 'updated_at';
    if v_changed is null then
      return new; -- nada relevante mudou
    end if;
  else
    v_old := to_jsonb(old);
    v_new := null;
  end if;

  v_record_id := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);

  insert into public.audit_log (table_name, record_id, action, actor_id, old_data, new_data, changed_fields)
  values (tg_table_name, v_record_id, tg_op::public.audit_action, auth.uid(), v_old, v_new, v_changed);

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------
-- INTELIGÊNCIA DO PROJETO — saúde calculada
-- ---------------------------------------------------------------------
-- Progresso esperado na data de hoje, em dias úteis do cronograma.
create or replace function public.expected_progress(p_start date, p_due date)
returns numeric
language sql
immutable
as $$
  select case
    when p_start is null or p_due is null then 0
    when current_date <= p_start then 0
    when current_date >= p_due then 100
    else round(
      (public.business_days(p_start, current_date)::numeric
        / nullif(public.business_days(p_start, p_due), 0)::numeric) * 100,
      2
    )
  end;
$$;

create or replace function public.calc_health(
  p_status public.project_status,
  p_start date,
  p_due date,
  p_progress numeric,
  p_priority public.priority_level
)
returns public.health_status
language plpgsql
immutable
as $$
declare
  v_expected numeric;
  v_delta numeric;
  v_days_late integer;
begin
  if p_status in ('concluido', 'cancelado') then
    return 'no_prazo';
  end if;

  v_expected := public.expected_progress(p_start, p_due);
  v_delta := coalesce(p_progress, 0) - v_expected;

  if current_date > p_due then
    v_days_late := current_date - p_due;
    if v_days_late > 10 or p_priority = 'critica' then
      return 'critico';
    end if;
    return 'atrasado';
  end if;

  if v_delta >= 10 then
    return 'adiantado';
  elsif v_delta >= -10 then
    return 'no_prazo';
  elsif v_delta >= -25 then
    return 'em_risco';
  else
    return 'critico';
  end if;
end;
$$;

-- Mantém health e datas reais sempre coerentes no próprio INSERT/UPDATE.
create or replace function public.tg_project_intelligence()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'concluido' then
    new.progress := 100;
    if new.actual_end_date is null then
      new.actual_end_date := current_date;
    end if;
  elsif new.status <> 'backlog' and new.actual_start_date is null then
    new.actual_start_date := current_date;
  end if;

  new.health := public.calc_health(new.status, new.start_date, new.due_date, new.progress, new.priority);
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Recalcula o percentual executado do projeto a partir das tarefas.
-- Ponderado por horas estimadas; cai para média simples quando não há horas.
-- ---------------------------------------------------------------------
create or replace function public.recalc_project_progress(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress numeric;
begin
  select case
           when count(*) = 0 then null
           when coalesce(sum(t.estimated_hours), 0) > 0
             then round(sum(t.estimated_hours * (case when t.status = 'concluido' then 100 else t.progress end))
                        / sum(t.estimated_hours), 2)
           else round(avg(case when t.status = 'concluido' then 100 else t.progress end), 2)
         end
    into v_progress
    from public.tasks t
   where t.project_id = p_project_id
     and t.parent_task_id is null;

  if v_progress is null then
    return; -- projeto sem tarefas mantém o progresso informado manualmente
  end if;

  update public.projects p
     set progress = v_progress
   where p.id = p_project_id
     and p.status <> 'concluido'
     and p.progress is distinct from v_progress;
end;
$$;

create or replace function public.tg_task_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_project_progress(coalesce(new.project_id, old.project_id));
  return coalesce(new, old);
end;
$$;

-- Normaliza progresso/data de conclusão da tarefa conforme o status.
create or replace function public.tg_task_intelligence()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'concluido' then
    new.progress := 100;
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
    if new.progress = 100 then
      new.progress := 99;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- CRONOGRAMA — recálculo automático das dependências (Finish-to-Start etc.)
-- Ao mover uma tarefa, as sucessoras são empurradas preservando a duração.
-- ---------------------------------------------------------------------
create or replace function public.reschedule_successors(p_task_id uuid, p_depth integer default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_task record;
  v_anchor date;
  v_target_start date;
  v_duration integer;
begin
  if p_depth > 20 then
    return; -- proteção contra ciclos
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    return;
  end if;

  for r in
    select d.type, d.lag_days, s.*
      from public.task_dependencies d
      join public.tasks s on s.id = d.successor_id
     where d.predecessor_id = p_task_id
  loop
    v_anchor := case r.type
                  when 'FS' then v_task.due_date
                  when 'FF' then v_task.due_date
                  when 'SS' then v_task.start_date
                  when 'SF' then v_task.start_date
                end;

    if v_anchor is null or r.start_date is null or r.due_date is null then
      continue;
    end if;

    v_duration := r.due_date - r.start_date;

    v_target_start := case r.type
                        when 'FS' then v_anchor + r.lag_days + 1
                        when 'SS' then v_anchor + r.lag_days
                        when 'FF' then (v_anchor + r.lag_days) - v_duration
                        when 'SF' then (v_anchor + r.lag_days) - v_duration
                      end;

    -- Só empurra para frente: nunca antecipa trabalho já planejado.
    if v_target_start > r.start_date then
      update public.tasks
         set start_date = v_target_start,
             due_date = v_target_start + v_duration
       where id = r.id;

      perform public.reschedule_successors(r.id, p_depth + 1);
    end if;
  end loop;
end;
$$;

create or replace function public.tg_task_reschedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.start_date is distinct from old.start_date or new.due_date is distinct from old.due_date then
    perform public.reschedule_successors(new.id, 0);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- CAMINHO CRÍTICO — maior cadeia de dependências até o fim do projeto
-- ---------------------------------------------------------------------
create or replace function public.critical_path(p_project_id uuid)
returns table (task_id uuid, chain_duration integer, depth integer)
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select t.id,
           t.id as root,
           coalesce(t.due_date - t.start_date, 0) + 1 as duration,
           1 as depth
      from public.tasks t
     where t.project_id = p_project_id
       and not exists (select 1 from public.task_dependencies d where d.successor_id = t.id)
    union all
    select s.id,
           c.root,
           c.duration + coalesce(s.due_date - s.start_date, 0) + 1,
           c.depth + 1
      from chain c
      join public.task_dependencies d on d.predecessor_id = c.id
      join public.tasks s on s.id = d.successor_id
     where c.depth < 30
  )
  select distinct on (c.id) c.id, c.duration, c.depth
    from chain c
   order by c.id, c.duration desc;
$$;

-- ---------------------------------------------------------------------
-- ATIVIDADES E NOTIFICAÇÕES EM TEMPO REAL
-- ---------------------------------------------------------------------
create or replace function public.log_activity(
  p_project_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity_log (project_id, actor_id, action, entity_type, entity_id, summary, metadata)
  values (p_project_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_summary, p_metadata);
$$;

create or replace function public.notify_users(
  p_user_ids uuid[],
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, project_id, entity_type, entity_id, actor_id)
  select u, p_type, p_title, p_body, p_project_id, p_entity_type, p_entity_id, auth.uid()
    from unnest(p_user_ids) u
   where u is distinct from auth.uid();
$$;

create or replace function public.project_audience(p_project_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct uid), '{}')
    from (
      select m.user_id as uid from public.project_members m where m.project_id = p_project_id
      union
      select p.owner_id from public.projects p where p.id = p_project_id and p.owner_id is not null
    ) s;
$$;

-- Novo comentário -> notifica a equipe do projeto
create or replace function public.tg_notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_name text;
begin
  select name into v_project_name from public.projects where id = new.project_id;

  perform public.notify_users(
    public.project_audience(new.project_id),
    'comentario',
    'Novo comentário em ' || coalesce(v_project_name, 'projeto'),
    left(new.body, 160),
    new.project_id,
    case when new.task_id is not null then 'task' else 'project' end,
    coalesce(new.task_id, new.project_id)
  );

  perform public.log_activity(
    new.project_id, 'comentou', 'comment', new.id, 'Novo comentário', jsonb_build_object('task_id', new.task_id)
  );

  return new;
end;
$$;

-- Menção -> notificação direta
create or replace function public.tg_notify_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment record;
  v_project_name text;
begin
  select c.*, p.name as project_name
    into v_comment
    from public.comments c
    join public.projects p on p.id = c.project_id
   where c.id = new.comment_id;

  if not found then
    return new;
  end if;

  perform public.notify_users(
    array[new.user_id],
    'mencao',
    'Você foi mencionado em ' || v_comment.project_name,
    left(v_comment.body, 160),
    v_comment.project_id,
    case when v_comment.task_id is not null then 'task' else 'project' end,
    coalesce(v_comment.task_id, v_comment.project_id)
  );

  return new;
end;
$$;

-- Atribuição e mudança de status de tarefa
create or replace function public.tg_notify_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_name text;
begin
  select name into v_project_name from public.projects where id = new.project_id;

  if tg_op = 'INSERT' then
    if new.assignee_id is not null then
      perform public.notify_users(array[new.assignee_id], 'tarefa_atribuida',
        'Nova tarefa: ' || new.title, v_project_name, new.project_id, 'task', new.id);
    end if;
    perform public.log_activity(new.project_id, 'criou', 'task', new.id, 'Tarefa criada: ' || new.title);
    return new;
  end if;

  if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
    perform public.notify_users(array[new.assignee_id], 'tarefa_atribuida',
      'Tarefa atribuída a você: ' || new.title, v_project_name, new.project_id, 'task', new.id);
  end if;

  if new.status is distinct from old.status then
    perform public.notify_users(
      public.project_audience(new.project_id), 'tarefa_status',
      new.title || ' → ' || replace(new.status::text, '_', ' '),
      v_project_name, new.project_id, 'task', new.id
    );
    perform public.log_activity(
      new.project_id, 'moveu', 'task', new.id,
      new.title || ': ' || old.status::text || ' → ' || new.status::text,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  return new;
end;
$$;

create or replace function public.tg_log_project_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.id, 'criou', 'project', new.id, 'Projeto criado: ' || new.name);
  elsif new.status is distinct from old.status then
    perform public.log_activity(
      new.id, 'atualizou', 'project', new.id,
      new.name || ': ' || old.status::text || ' → ' || new.status::text,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

-- Checklist concluído
create or replace function public.tg_checklist_done()
returns trigger
language plpgsql
as $$
begin
  if new.is_done and not old.is_done then
    new.done_at := now();
    new.done_by := auth.uid();
  elsif not new.is_done then
    new.done_at := null;
    new.done_by := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- ALERTAS DE PRAZO — chamada diária (pg_cron ou Edge Function agendada)
-- ---------------------------------------------------------------------
create or replace function public.generate_deadline_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  -- Tarefas com prazo hoje ou amanhã
  with alvo as (
    select t.id, t.title, t.assignee_id, t.project_id, t.due_date
      from public.tasks t
     where t.status <> 'concluido'
       and t.assignee_id is not null
       and t.due_date in (current_date, current_date + 1)
  ), inseridos as (
    insert into public.notifications (user_id, type, title, body, project_id, entity_type, entity_id)
    select a.assignee_id,
           case when a.due_date = current_date then 'prazo_hoje'::public.notification_type
                else 'prazo_amanha'::public.notification_type end,
           case when a.due_date = current_date then 'Prazo hoje: ' || a.title
                else 'Prazo amanhã: ' || a.title end,
           'Vencimento em ' || to_char(a.due_date, 'DD/MM/YYYY'),
           a.project_id, 'task', a.id
      from alvo a
     where not exists (
       select 1 from public.notifications n
        where n.user_id = a.assignee_id
          and n.entity_id = a.id
          and n.type in ('prazo_hoje', 'prazo_amanha')
          and n.created_at::date = current_date
     )
    returning 1
  )
  select count(*) into v_count from inseridos;

  -- Projetos atrasados
  insert into public.notifications (user_id, type, title, body, project_id, entity_type, entity_id)
  select unnest(public.project_audience(p.id)),
         'projeto_atrasado',
         'Projeto atrasado: ' || p.name,
         'Prazo final era ' || to_char(p.due_date, 'DD/MM/YYYY'),
         p.id, 'project', p.id
    from public.projects p
   where p.status not in ('concluido', 'cancelado')
     and p.due_date < current_date
     and not exists (
       select 1 from public.notifications n
        where n.project_id = p.id and n.type = 'projeto_atrasado' and n.created_at::date = current_date
     );

  -- Reavalia a saúde de todo o portfólio ativo
  update public.projects p
     set health = public.calc_health(p.status, p.start_date, p.due_date, p.progress, p.priority)
   where p.status not in ('concluido', 'cancelado');

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- PESQUISA GLOBAL
-- ---------------------------------------------------------------------
create or replace function public.global_search(p_query text, p_limit integer default 30)
returns table (
  entity_type text,
  id uuid,
  project_id uuid,
  title text,
  subtitle text,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (select btrim(p_query) as term)
  select * from (
    select 'project'::text, p.id, p.id, p.name, coalesce(p.code, '') , similarity(p.name, q.term)
      from public.projects p, q
     where p.name ilike '%' || q.term || '%' or p.code ilike '%' || q.term || '%'

    union all
    select 'task', t.id, t.project_id, t.title, coalesce(t.code, ''), similarity(t.title, q.term)
      from public.tasks t, q
     where t.title ilike '%' || q.term || '%'

    union all
    select 'comment', c.id, c.project_id, left(c.body, 90), 'Comentário', similarity(c.body, q.term)
      from public.comments c, q
     where c.body ilike '%' || q.term || '%'

    union all
    select 'file', a.id, a.project_id, a.file_name, coalesce(a.mime_type, 'arquivo'), similarity(a.file_name, q.term)
      from public.attachments a, q
     where a.file_name ilike '%' || q.term || '%'

    union all
    select 'user', pr.id, null::uuid, pr.full_name, pr.email, similarity(pr.full_name, q.term)
      from public.profiles pr, q
     where pr.full_name ilike '%' || q.term || '%' or pr.email ilike '%' || q.term || '%'

    union all
    select 'client', cl.id, null::uuid, cl.name, coalesce(cl.code, 'Cliente'), similarity(cl.name, q.term)
      from public.clients cl, q
     where cl.name ilike '%' || q.term || '%'

    union all
    select 'tag', tg.id, null::uuid, tg.name, 'Tag', similarity(tg.name, q.term)
      from public.tags tg, q
     where tg.name ilike '%' || q.term || '%'
  ) s (entity_type, id, project_id, title, subtitle, rank)
  order by rank desc nulls last, title
  limit greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------
-- PRESENÇA / NOTIFICAÇÕES — utilitários chamados pelo frontend via RPC
-- ---------------------------------------------------------------------
create or replace function public.heartbeat()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_presence (user_id, status, last_ping)
  values (auth.uid(), 'online', now())
  on conflict (user_id) do update set last_ping = now(), status = 'online';

  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

create or replace function public.online_users_count(p_window_seconds integer default 120)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.user_presence
   where last_ping > now() - make_interval(secs => p_window_seconds);
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language sql
security invoker
set search_path = public
as $$
  with upd as (
    update public.notifications
       set is_read = true, read_at = now()
     where user_id = auth.uid() and is_read = false
    returning 1
  )
  select count(*)::int from upd;
$$;

-- Reordenação transacional do Kanban (drag & drop)
create or replace function public.move_task(p_task_id uuid, p_status public.task_status, p_position integer)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_task public.tasks;
begin
  update public.tasks
     set status = p_status,
         position = p_position
   where id = p_task_id
  returning * into v_task;

  if not found then
    raise exception 'Tarefa % não encontrada ou sem permissão', p_task_id;
  end if;

  -- Reindexa a coluna de destino mantendo a ordem visual estável.
  with ordenado as (
    select id, row_number() over (order by position, updated_at) * 10 as nova_pos
      from public.tasks
     where project_id = v_task.project_id and status = p_status
  )
  update public.tasks t
     set position = o.nova_pos
    from ordenado o
   where t.id = o.id and t.position is distinct from o.nova_pos;

  return v_task;
end;
$$;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250101000300_triggers.sql
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250101000400_views.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 1 · Migration 05 — Views analíticas
-- Todas com security_invoker: a RLS do usuário logado continua valendo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Visão 360º do projeto (usada em cards, lista, portfólio e Gantt)
-- ---------------------------------------------------------------------
create or replace view public.v_project_overview
with (security_invoker = on) as
select
  p.id,
  p.code,
  p.name,
  p.description,
  p.status,
  p.priority,
  p.complexity,
  p.category,
  p.health,
  p.start_date,
  p.due_date,
  p.actual_start_date,
  p.actual_end_date,
  p.budget,
  p.cost,
  p.planned_hours,
  p.progress,
  p.is_archived,
  p.created_at,
  p.updated_at,
  p.department_id,
  d.name  as department_name,
  d.color as department_color,
  p.client_id,
  c.name  as client_name,
  p.owner_id,
  o.full_name  as owner_name,
  o.avatar_url as owner_avatar,
  coalesce(tm.team_count, 0)              as team_count,
  coalesce(tk.total_tasks, 0)             as total_tasks,
  coalesce(tk.done_tasks, 0)              as done_tasks,
  coalesce(tk.late_tasks, 0)              as late_tasks,
  coalesce(tk.estimated_hours, 0)         as tasks_estimated_hours,
  coalesce(te.actual_hours, 0)            as actual_hours,
  coalesce(ck.checklist_total, 0)         as checklist_total,
  coalesce(ck.checklist_done, 0)          as checklist_done,
  coalesce(rk.open_risks, 0)              as open_risks,
  coalesce(rk.max_severity, 0)            as max_risk_severity,
  coalesce(ms.milestones_total, 0)        as milestones_total,
  coalesce(ms.milestones_done, 0)         as milestones_done,
  public.expected_progress(p.start_date, p.due_date)                as expected_progress,
  round(p.progress - public.expected_progress(p.start_date, p.due_date), 2) as progress_delta,
  (p.due_date - current_date)                                       as days_remaining,
  greatest(current_date - p.due_date, 0)                            as days_late,
  public.business_days(current_date, p.due_date)                    as business_days_remaining,
  public.business_days(p.start_date, p.due_date)                    as business_days_total,
  case
    when coalesce(te.actual_hours, 0) = 0 then null
    else round((coalesce(tk.estimated_hours, 0) / nullif(te.actual_hours, 0)) * 100, 2)
  end                                                               as efficiency
from public.projects p
left join public.departments d on d.id = p.department_id
left join public.clients c     on c.id = p.client_id
left join public.profiles o    on o.id = p.owner_id
left join lateral (
  select count(*) as team_count from public.project_members m where m.project_id = p.id
) tm on true
left join lateral (
  select
    count(*)                                                              as total_tasks,
    count(*) filter (where t.status = 'concluido')                        as done_tasks,
    count(*) filter (where t.status <> 'concluido' and t.due_date < current_date) as late_tasks,
    coalesce(sum(t.estimated_hours), 0)                                   as estimated_hours
  from public.tasks t where t.project_id = p.id
) tk on true
left join lateral (
  select coalesce(sum(e.hours), 0) as actual_hours from public.time_entries e where e.project_id = p.id
) te on true
left join lateral (
  select count(*) as checklist_total, count(*) filter (where ci.is_done) as checklist_done
  from public.checklist_items ci where ci.project_id = p.id
) ck on true
left join lateral (
  select count(*) filter (where r.status not in ('mitigado', 'aceito')) as open_risks,
         coalesce(max(r.severity) filter (where r.status not in ('mitigado', 'aceito')), 0) as max_severity
  from public.risks r where r.project_id = p.id
) rk on true
left join lateral (
  select count(*) as milestones_total, count(*) filter (where m.status = 'concluido') as milestones_done
  from public.milestones m where m.project_id = p.id
) ms on true;

-- ---------------------------------------------------------------------
-- KPIs do dashboard inicial (uma linha)
-- ---------------------------------------------------------------------
create or replace view public.v_dashboard_kpis
with (security_invoker = on) as
select
  count(*) filter (where v.status not in ('concluido', 'cancelado'))                  as projetos_ativos,
  count(*) filter (where v.status = 'concluido')                                      as projetos_concluidos,
  count(*) filter (where v.health = 'atrasado' or v.health = 'critico')               as projetos_atrasados,
  count(*) filter (where v.health = 'em_risco')                                       as projetos_em_risco,
  count(*) filter (
    where v.status not in ('concluido', 'cancelado')
      and v.due_date between current_date and current_date + 7
  )                                                                                   as projetos_proximo_vencimento,
  coalesce(sum(v.total_tasks), 0)                                                     as total_tarefas,
  coalesce(sum(v.done_tasks), 0)                                                      as tarefas_concluidas,
  coalesce(sum(v.tasks_estimated_hours), 0)                                           as horas_planejadas,
  coalesce(sum(v.actual_hours), 0)                                                    as horas_realizadas,
  case
    when coalesce(sum(v.actual_hours), 0) = 0 then null
    else round((sum(v.tasks_estimated_hours) / nullif(sum(v.actual_hours), 0)) * 100, 2)
  end                                                                                 as eficiencia_geral,
  round(coalesce(avg(v.progress) filter (where v.status not in ('cancelado')), 0), 2)  as indicador_geral,
  (select count(*) from public.tasks t
    where t.status = 'concluido' and t.completed_at::date = current_date)              as tarefas_concluidas_hoje,
  public.online_users_count(120)                                                       as usuarios_online
from public.v_project_overview v
where v.is_archived = false;

-- ---------------------------------------------------------------------
-- Capacidade da equipe (Workload)
-- ---------------------------------------------------------------------
create or replace view public.v_workload
with (security_invoker = on) as
select
  pr.id                                   as user_id,
  pr.full_name,
  pr.avatar_url,
  pr.job_title,
  pr.role,
  pr.department_id,
  d.name                                  as department_name,
  pr.weekly_capacity_hours                as capacidade_semanal,
  coalesce(t.horas_planejadas, 0)         as horas_planejadas,
  coalesce(h.horas_realizadas, 0)         as horas_realizadas,
  coalesce(t.tarefas_abertas, 0)          as tarefas_abertas,
  coalesce(t.tarefas_atrasadas, 0)        as tarefas_atrasadas,
  coalesce(pm.projetos_ativos, 0)         as projetos_ativos,
  coalesce(pm.projetos_atrasados, 0)      as projetos_atrasados,
  round(
    (coalesce(t.horas_planejadas, 0) / nullif(pr.weekly_capacity_hours, 0)) * 100, 2
  )                                       as ocupacao_percentual,
  greatest(pr.weekly_capacity_hours - coalesce(t.horas_planejadas, 0), 0) as disponibilidade_horas
from public.profiles pr
left join public.departments d on d.id = pr.department_id
left join lateral (
  select
    coalesce(sum(tk.estimated_hours * (1 - tk.progress / 100.0)), 0) as horas_planejadas,
    count(*) filter (where tk.status <> 'concluido')                 as tarefas_abertas,
    count(*) filter (where tk.status <> 'concluido' and tk.due_date < current_date) as tarefas_atrasadas
  from public.tasks tk
  where tk.assignee_id = pr.id and tk.status <> 'concluido'
) t on true
left join lateral (
  select coalesce(sum(e.hours), 0) as horas_realizadas
  from public.time_entries e
  where e.user_id = pr.id and e.work_date >= date_trunc('week', current_date)::date
) h on true
left join lateral (
  select
    count(*) filter (where p.status not in ('concluido', 'cancelado')) as projetos_ativos,
    count(*) filter (where p.health in ('atrasado', 'critico'))        as projetos_atrasados
  from public.project_members m
  join public.projects p on p.id = m.project_id
  where m.user_id = pr.id
) pm on true
where pr.is_active = true;

-- ---------------------------------------------------------------------
-- Dashboard executivo — agrupamentos
-- ---------------------------------------------------------------------
create or replace view public.v_exec_by_status
with (security_invoker = on) as
select v.status::text as chave, count(*) as total, round(avg(v.progress), 1) as progresso_medio
from public.v_project_overview v where v.is_archived = false group by v.status;

create or replace view public.v_exec_by_department
with (security_invoker = on) as
select
  coalesce(v.department_name, 'Sem departamento') as chave,
  coalesce(v.department_color, '#94a3b8')         as cor,
  count(*)                                        as total,
  count(*) filter (where v.health in ('atrasado', 'critico')) as atrasados,
  round(avg(v.progress), 1)                       as progresso_medio,
  coalesce(sum(v.budget), 0)                      as orcamento
from public.v_project_overview v where v.is_archived = false
group by 1, 2;

create or replace view public.v_exec_by_priority
with (security_invoker = on) as
select v.priority::text as chave, count(*) as total,
       count(*) filter (where v.health in ('atrasado', 'critico')) as atrasados
from public.v_project_overview v where v.is_archived = false group by v.priority;

create or replace view public.v_exec_by_manager
with (security_invoker = on) as
select
  coalesce(v.owner_name, 'Sem responsável') as chave,
  v.owner_id,
  count(*)                                  as total,
  count(*) filter (where v.status = 'concluido')              as concluidos,
  count(*) filter (where v.health in ('atrasado', 'critico')) as atrasados,
  round(avg(v.progress), 1)                 as progresso_medio
from public.v_project_overview v where v.is_archived = false
group by 1, 2;

-- Lead Time / Cycle Time / Velocidade (últimas 12 semanas)
create or replace view public.v_exec_flow_metrics
with (security_invoker = on) as
select
  round(avg(extract(epoch from (t.completed_at - t.created_at)) / 86400)::numeric, 1) as lead_time_dias,
  round(avg(
    extract(epoch from (t.completed_at - coalesce(t.start_date::timestamptz, t.created_at))) / 86400
  )::numeric, 1)                                                                       as cycle_time_dias,
  round((count(*)::numeric / 12), 1)                                                   as velocidade_semanal,
  count(*)                                                                             as entregas_12_semanas
from public.tasks t
where t.status = 'concluido'
  and t.completed_at is not null
  and t.completed_at >= now() - interval '12 weeks';

-- Saúde consolidada do portfólio
create or replace view public.v_exec_health
with (security_invoker = on) as
select v.health::text as chave, count(*) as total
from public.v_project_overview v
where v.is_archived = false and v.status not in ('concluido', 'cancelado')
group by v.health;

-- ---------------------------------------------------------------------
-- Gantt / Timeline
-- ---------------------------------------------------------------------
create or replace view public.v_task_gantt
with (security_invoker = on) as
select
  t.id,
  t.project_id,
  p.name                       as project_name,
  p.code                       as project_code,
  t.parent_task_id,
  t.title,
  t.status,
  t.priority,
  t.is_milestone,
  t.start_date,
  t.due_date,
  t.progress,
  t.estimated_hours,
  coalesce(t.due_date - t.start_date, 0) + 1 as duracao_dias,
  public.business_days(t.start_date, t.due_date) as duracao_dias_uteis,
  (t.due_date - current_date)                    as dias_restantes,
  greatest(current_date - t.due_date, 0)         as dias_atraso,
  t.assignee_id,
  a.full_name                  as assignee_name,
  a.avatar_url                 as assignee_avatar,
  coalesce(dep.predecessores, '{}')              as predecessores,
  coalesce(cp.is_critical, false)                as caminho_critico
from public.tasks t
join public.projects p on p.id = t.project_id
left join public.profiles a on a.id = t.assignee_id
left join lateral (
  select array_agg(d.predecessor_id) as predecessores
  from public.task_dependencies d where d.successor_id = t.id
) dep on true
left join lateral (
  select true as is_critical
  from public.critical_path(t.project_id) c
  where c.task_id = t.id
    and c.chain_duration = (select max(c2.chain_duration) from public.critical_path(t.project_id) c2)
) cp on true;

-- ---------------------------------------------------------------------
-- Roadmap executivo (projetos x meses)
-- ---------------------------------------------------------------------
create or replace view public.v_roadmap
with (security_invoker = on) as
select
  v.id            as project_id,
  v.code,
  v.name,
  v.status,
  v.health,
  v.progress,
  v.start_date,
  v.due_date,
  v.department_name,
  v.owner_name,
  m.id            as milestone_id,
  m.name          as milestone_name,
  m.due_date      as milestone_date,
  m.status        as milestone_status
from public.v_project_overview v
left join public.milestones m on m.project_id = v.id
where v.is_archived = false;

-- ---------------------------------------------------------------------
-- Centro de atividades em tempo real
-- ---------------------------------------------------------------------
create or replace view public.v_activity_feed
with (security_invoker = on) as
select
  a.id,
  a.created_at,
  a.action,
  a.entity_type,
  a.entity_id,
  a.summary,
  a.metadata,
  a.project_id,
  p.name       as project_name,
  p.code       as project_code,
  a.actor_id,
  pr.full_name as actor_name,
  pr.avatar_url as actor_avatar
from public.activity_log a
left join public.projects p on p.id = a.project_id
left join public.profiles pr on pr.id = a.actor_id
order by a.created_at desc;

-- ---------------------------------------------------------------------
-- Heatmap de riscos
-- ---------------------------------------------------------------------
create or replace view public.v_risk_heatmap
with (security_invoker = on) as
select
  r.probability,
  r.impact,
  count(*)                     as total,
  array_agg(r.title order by r.severity desc) as titulos,
  max(r.severity)              as severidade_maxima
from public.risks r
where r.status not in ('mitigado', 'aceito')
group by r.probability, r.impact;

-- ---------------------------------------------------------------------
-- Curva S / Burndown / Burnup por projeto
-- ---------------------------------------------------------------------
create or replace function public.project_burn_series(p_project_id uuid)
returns table (
  dia date,
  planejado numeric,
  concluido numeric,
  restante numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with proj as (
    select start_date, due_date from public.projects where id = p_project_id
  ),
  total as (
    select coalesce(sum(estimated_hours), 0) as horas, count(*) as qtd
    from public.tasks where project_id = p_project_id
  ),
  dias as (
    select generate_series(
      (select start_date from proj),
      greatest((select due_date from proj), current_date),
      interval '1 day'
    )::date as dia
  ),
  base as (
    select
      d.dia,
      (select start_date from proj) as ini,
      (select due_date from proj)   as fim,
      (select horas from total)     as horas_totais
    from dias d
  )
  select
    b.dia,
    round(
      (select horas from total) *
      least(
        greatest(public.business_days(b.ini, b.dia)::numeric
          / nullif(public.business_days(b.ini, b.fim), 0), 0),
        1
      ), 2
    ) as planejado,
    round(coalesce((
      select sum(t.estimated_hours)
      from public.tasks t
      where t.project_id = p_project_id
        and t.status = 'concluido'
        and t.completed_at::date <= b.dia
    ), 0), 2) as concluido,
    round(
      b.horas_totais - coalesce((
        select sum(t.estimated_hours)
        from public.tasks t
        where t.project_id = p_project_id
          and t.status = 'concluido'
          and t.completed_at::date <= b.dia
      ), 0), 2
    ) as restante
  from base b
  order by b.dia;
$$;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250101000500_rls_policies.sql
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250101000600_realtime_storage.sql
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250201000000_stages_and_viability.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 2 · Migration 08 — Etapas do projeto, viabilidade econômica
--                          e conclusão por tempo
--
-- Esta migration NÃO altera nenhum objeto criado nas migrations 01 a 07.
-- Tudo é aditivo (novas colunas, nova tabela, novas functions e novas
-- views), para que o arquivo único supabase/setup.sql continue podendo
-- ser executado mais de uma vez sem erro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Situação de uma etapa do projeto
-- ---------------------------------------------------------------------
do $$ begin
  create type public.stage_status as enum (
    'nao_iniciada', 'em_andamento', 'pausada', 'concluida', 'cancelada'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- VIABILIDADE ECONÔMICA — retorno financeiro esperado x realizado
-- ---------------------------------------------------------------------
alter table public.projects
  add column if not exists expected_return      numeric(14, 2) not null default 0,
  add column if not exists actual_return        numeric(14, 2) not null default 0,
  add column if not exists return_period_months integer        not null default 12,
  add column if not exists financial_notes      text;

comment on column public.projects.expected_return is
  'Retorno financeiro esperado do projeto (receita nova, ganho ou economia) no horizonte de return_period_months.';
comment on column public.projects.actual_return is
  'Retorno financeiro já realizado e comprovado.';
comment on column public.projects.return_period_months is
  'Horizonte, em meses, considerado para o retorno esperado. Base do payback.';
comment on column public.projects.financial_notes is
  'Premissas do cálculo de viabilidade: de onde vem o retorno, como será medido.';

do $$ begin
  alter table public.projects
    add constraint projects_return_chk check (expected_return >= 0 and actual_return >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.projects
    add constraint projects_return_period_chk check (return_period_months between 1 and 240);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- ETAPAS DO PROJETO (organograma / fases)
-- Cada etapa tem início e término planejados, datas reais, percentual
-- de avanço e um texto livre de andamento escrito pelo responsável.
-- ---------------------------------------------------------------------
create table if not exists public.project_stages (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  name              text not null,
  description       text,
  progress_notes    text,
  status            public.stage_status not null default 'nao_iniciada',
  owner_id          uuid references public.profiles (id) on delete set null,
  start_date        date not null default current_date,
  end_date          date not null,
  actual_start_date date,
  actual_end_date   date,
  progress          numeric(5, 2) not null default 0,
  weight            numeric(6, 2) not null default 1,
  position          integer not null default 0,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint project_stages_name_len check (char_length(btrim(name)) between 2 and 160),
  constraint project_stages_dates_chk check (end_date >= start_date),
  constraint project_stages_progress_chk check (progress between 0 and 100),
  constraint project_stages_weight_chk check (weight > 0)
);

comment on table public.project_stages is
  'Etapas (fases) do projeto — alimentam o organograma de execução e a linha do tempo por etapa.';
comment on column public.project_stages.progress_notes is
  'Andamento escrito pelo responsável: o que já aconteceu e o que falta nesta etapa.';
comment on column public.project_stages.weight is
  'Peso da etapa no avanço consolidado do projeto.';

create index if not exists idx_project_stages_project on public.project_stages (project_id, position);
create index if not exists idx_project_stages_owner on public.project_stages (owner_id);
create index if not exists idx_project_stages_dates on public.project_stages (start_date, end_date);

-- ---------------------------------------------------------------------
-- FUNCTIONS — viabilidade econômica
-- ---------------------------------------------------------------------
-- Retorno sobre investimento, em %. Null quando não há investimento.
create or replace function public.project_roi(p_investment numeric, p_return numeric)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_investment, 0) <= 0 then null
    else round(((coalesce(p_return, 0) - p_investment) / p_investment) * 100, 2)
  end;
$$;

-- Meses necessários para o retorno pagar o investimento, no ritmo informado.
create or replace function public.payback_months(
  p_investment numeric,
  p_return numeric,
  p_period_months integer
)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_investment, 0) <= 0 then 0
    when coalesce(p_return, 0) <= 0 or coalesce(p_period_months, 0) <= 0 then null
    else round(p_investment / (p_return / p_period_months), 1)
  end;
$$;

-- Classificação da viabilidade a partir do ROI.
create or replace function public.viability_rating(
  p_investment numeric,
  p_return numeric,
  p_roi numeric
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_return, 0) <= 0 and coalesce(p_investment, 0) <= 0 then 'sem_dados'
    when coalesce(p_return, 0) <= 0 then 'sem_retorno'
    when p_roi is null then 'viavel'
    when p_roi < 0 then 'inviavel'
    when p_roi < 15 then 'atencao'
    when p_roi < 50 then 'viavel'
    else 'estrategico'
  end;
$$;

-- ---------------------------------------------------------------------
-- FUNCTIONS — conclusão por tempo
-- ---------------------------------------------------------------------
-- Percentual do prazo (dias corridos) já consumido. Pode passar de 100%
-- quando o projeto atravessa a data de entrega.
create or replace function public.time_elapsed_percent(
  p_start date,
  p_due date,
  p_end date default null
)
returns numeric
language sql
stable
as $$
  select case
    when p_start is null or p_due is null then 0
    else round(
      greatest(
        ((coalesce(p_end, current_date) - p_start)::numeric + 1)
          / nullif((p_due - p_start)::numeric + 1, 0),
        0
      ) * 100,
      2
    )
  end;
$$;

-- Data de conclusão projetada mantendo o ritmo atual de execução.
create or replace function public.forecast_end_date(
  p_start date,
  p_due date,
  p_progress numeric,
  p_actual_end date default null
)
returns date
language plpgsql
stable
as $$
declare
  v_elapsed numeric;
  v_total numeric;
begin
  if p_actual_end is not null then
    return p_actual_end;
  end if;
  if p_start is null or p_due is null then
    return p_due;
  end if;
  if current_date <= p_start then
    return p_due;
  end if;
  if coalesce(p_progress, 0) <= 0 then
    return null; -- sem execução não há ritmo para projetar
  end if;
  if p_progress >= 100 then
    return current_date;
  end if;

  v_elapsed := (current_date - p_start)::numeric + 1;
  v_total := v_elapsed * 100 / p_progress;

  return greatest(p_start + (ceil(v_total)::integer - 1), current_date);
end;
$$;

-- Índice de desempenho de prazo: executado ÷ previsto (1 = no ritmo).
create or replace function public.schedule_index(p_progress numeric, p_expected numeric)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_expected, 0) <= 0 then null
    else round(coalesce(p_progress, 0) / p_expected, 2)
  end;
$$;

-- ---------------------------------------------------------------------
-- TRIGGERS — etapas
-- ---------------------------------------------------------------------
create or replace function public.tg_stage_intelligence()
returns trigger
language plpgsql
as $$
begin
  -- Primeira etapa entra no fim da lista quando a posição não é informada.
  if tg_op = 'INSERT' and coalesce(new.position, 0) = 0 then
    select coalesce(max(s.position), 0) + 1
      into new.position
      from public.project_stages s
     where s.project_id = new.project_id;
  end if;

  -- Progresso informado já coloca a etapa em andamento.
  if new.progress > 0 and new.status = 'nao_iniciada' then
    new.status := 'em_andamento';
  end if;

  if new.progress >= 100 and new.status in ('nao_iniciada', 'em_andamento') then
    new.status := 'concluida';
  end if;

  if new.status = 'concluida' then
    new.progress := 100;
    new.actual_end_date := coalesce(new.actual_end_date, current_date);
  else
    new.actual_end_date := null;
  end if;

  if new.status in ('em_andamento', 'pausada', 'concluida') then
    new.actual_start_date := coalesce(new.actual_start_date, current_date);
  end if;

  if new.status = 'nao_iniciada' then
    new.progress := 0;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stage_intelligence on public.project_stages;
create trigger stage_intelligence
  before insert or update on public.project_stages
  for each row execute function public.tg_stage_intelligence();

drop trigger if exists audit_changes on public.project_stages;
create trigger audit_changes
  after insert or update or delete on public.project_stages
  for each row execute function public.tg_audit();

-- ---------------------------------------------------------------------
-- VIEWS
-- ---------------------------------------------------------------------
-- Etapas com métricas de prazo e avanço prontas para o organograma.
create or replace view public.v_project_stages
with (security_invoker = on) as
select
  s.id,
  s.project_id,
  p.code                                       as project_code,
  p.name                                       as project_name,
  s.name,
  s.description,
  s.progress_notes,
  s.status,
  s.position,
  s.start_date,
  s.end_date,
  s.actual_start_date,
  s.actual_end_date,
  s.progress,
  s.weight,
  s.owner_id,
  o.full_name                                  as owner_name,
  o.avatar_url                                 as owner_avatar,
  (s.end_date - s.start_date) + 1               as duracao_dias,
  public.business_days(s.start_date, s.end_date) as duracao_dias_uteis,
  public.expected_progress(s.start_date, s.end_date) as expected_progress,
  round(s.progress - public.expected_progress(s.start_date, s.end_date), 2) as progress_delta,
  public.time_elapsed_percent(s.start_date, s.end_date, s.actual_end_date) as time_elapsed_percent,
  (s.end_date - current_date)                  as dias_restantes,
  -- Etapa concluída tem o atraso medido pela data real de término.
  greatest(coalesce(s.actual_end_date, current_date) - s.end_date, 0) as dias_atraso,
  (
    s.status not in ('concluida', 'cancelada')
    and s.end_date < current_date
  )                                            as atrasada,
  s.created_at,
  s.updated_at,
  -- Quem cadastrou a etapa; a tela usa para liberar o botão de excluir.
  -- Precisa estar aqui também (e não só na migration 11) porque um
  -- `create or replace view` não pode perder coluna: sem isto, a segunda
  -- execução do setup.sql pararia neste ponto.
  s.created_by
from public.project_stages s
join public.projects p on p.id = s.project_id
left join public.profiles o on o.id = s.owner_id;

-- Visão 360º ampliada: mantém tudo de v_project_overview e acrescenta
-- viabilidade econômica, conclusão por tempo e resumo das etapas.
--
-- Derrubar antes de criar não é capricho: como esta view expande `v.*`, uma
-- migration posterior que acrescente coluna ao portfólio deixaria a lista de
-- colunas daqui maior que a definição abaixo, e o `create or replace` recusa
-- perder coluna ("cannot drop columns from view") na segunda execução do
-- setup.sql. O cascade leva junto a v_exec_financials, recriada logo adiante.
drop view if exists public.v_project_360 cascade;

create view public.v_project_360
with (security_invoker = on) as
select
  v.*,
  p.expected_return,
  p.actual_return,
  p.return_period_months,
  p.financial_notes,
  (p.expected_return - p.budget)                                   as net_benefit,
  (p.actual_return - p.cost)                                       as net_benefit_real,
  public.project_roi(p.budget, p.expected_return)                  as roi_percent,
  public.project_roi(p.cost, p.actual_return)                      as roi_real_percent,
  public.payback_months(p.budget, p.expected_return, p.return_period_months) as payback_months,
  public.viability_rating(
    p.budget,
    p.expected_return,
    public.project_roi(p.budget, p.expected_return)
  )                                                                as viability,
  public.time_elapsed_percent(p.start_date, p.due_date, p.actual_end_date) as time_elapsed_percent,
  public.schedule_index(p.progress, v.expected_progress)            as schedule_index,
  public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) as forecast_end_date,
  case
    when public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) is null then null
    else public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) - p.due_date
  end                                                               as forecast_delay_days,
  coalesce(st.stages_total, 0)                                      as stages_total,
  coalesce(st.stages_done, 0)                                       as stages_done,
  coalesce(st.stages_running, 0)                                    as stages_running,
  coalesce(st.stages_late, 0)                                       as stages_late,
  st.stages_progress                                                as stages_progress
from public.v_project_overview v
join public.projects p on p.id = v.id
left join lateral (
  select
    count(*)                                                as stages_total,
    count(*) filter (where s.status = 'concluida')          as stages_done,
    count(*) filter (where s.status = 'em_andamento')       as stages_running,
    count(*) filter (
      where s.status not in ('concluida', 'cancelada') and s.end_date < current_date
    )                                                       as stages_late,
    round(
      sum(s.weight * s.progress) filter (where s.status <> 'cancelada')
        / nullif(sum(s.weight) filter (where s.status <> 'cancelada'), 0),
      2
    )                                                       as stages_progress
  from public.project_stages s
  where s.project_id = p.id
) st on true;

-- Retorno financeiro consolidado por departamento (dashboard executivo).
create or replace view public.v_exec_financials
with (security_invoker = on) as
select
  coalesce(v.department_name, 'Sem departamento') as chave,
  coalesce(v.department_color, '#94a3b8')         as cor,
  count(*)                                        as total,
  coalesce(sum(v.budget), 0)                      as orcamento,
  coalesce(sum(v.cost), 0)                        as custo,
  coalesce(sum(v.expected_return), 0)             as retorno_esperado,
  coalesce(sum(v.actual_return), 0)               as retorno_realizado,
  coalesce(sum(v.expected_return - v.budget), 0)  as beneficio_liquido,
  public.project_roi(sum(v.budget), sum(v.expected_return)) as roi_percent
from public.v_project_360 v
where v.is_archived = false
group by 1, 2;

-- ---------------------------------------------------------------------
-- RLS — etapas
-- ---------------------------------------------------------------------
alter table public.project_stages enable row level security;

drop policy if exists project_stages_select on public.project_stages;
create policy project_stages_select on public.project_stages
  for select to authenticated using (public.can_read_project(project_id));

drop policy if exists project_stages_insert on public.project_stages;
create policy project_stages_insert on public.project_stages
  for insert to authenticated with check (public.can_manage_project(project_id));

-- O responsável pela etapa registra o andamento sem precisar gerenciar o projeto.
drop policy if exists project_stages_update on public.project_stages;
create policy project_stages_update on public.project_stages
  for update to authenticated
  using (public.can_manage_project(project_id) or owner_id = auth.uid())
  with check (public.can_read_project(project_id));

drop policy if exists project_stages_delete on public.project_stages;
create policy project_stages_delete on public.project_stages
  for delete to authenticated using (public.can_manage_project(project_id));

grant select, insert, update, delete on public.project_stages to authenticated;
grant select on public.v_project_stages to authenticated;
grant select on public.v_project_360 to authenticated;
grant select on public.v_exec_financials to authenticated;
grant execute on function public.project_roi(numeric, numeric) to authenticated;
grant execute on function public.payback_months(numeric, numeric, integer) to authenticated;
grant execute on function public.viability_rating(numeric, numeric, numeric) to authenticated;
grant execute on function public.time_elapsed_percent(date, date, date) to authenticated;
grant execute on function public.forecast_end_date(date, date, numeric, date) to authenticated;
grant execute on function public.schedule_index(numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------------------
do $$
begin
  alter table public.project_stages replica identity full;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_stages'
  ) then
    alter publication supabase_realtime add table public.project_stages;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250301000000_status_responsaveis_tags.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 3 · Migration 09 — Novos status, responsáveis múltiplos e tags
--
-- Tudo aditivo, como nas migrations anteriores: o supabase/setup.sql
-- continua podendo ser executado mais de uma vez sem erro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STATUS — projeto pausado e projeto ainda não iniciado
--
-- `add value` entra na posição pedida para o enum continuar ordenado do
-- começo ao fim do ciclo de vida. Atenção ao usar os valores novos: no
-- Postgres eles só podem ser comparados como literal de enum depois que a
-- transação que os criou terminar. Por isso as comparações abaixo são
-- feitas com `status::text`.
-- ---------------------------------------------------------------------
alter type public.project_status add value if not exists 'nao_iniciado' before 'backlog';
alter type public.project_status add value if not exists 'pausado' after 'homologacao';

-- Projeto não iniciado não carimba a data real de início — igual ao backlog.
create or replace function public.tg_project_intelligence()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'concluido' then
    new.progress := 100;
    if new.actual_end_date is null then
      new.actual_end_date := current_date;
    end if;
  elsif new.status::text not in ('backlog', 'nao_iniciado') and new.actual_start_date is null then
    new.actual_start_date := current_date;
  end if;

  new.health := public.calc_health(new.status, new.start_date, new.due_date, new.progress, new.priority);
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- RESPONSÁVEIS — mais de um por projeto, entre áreas e pessoas
--
-- `owner_id` continua sendo o dono no sistema: é dele que a RLS tira quem
-- pode gerenciar o projeto. Esta lista é a resposta à pergunta "quem
-- responde por isso?", que raramente cabe em um único usuário cadastrado —
-- entram áreas (COA, Projetos, Actius, MAC) e nomes escritos à mão.
-- ---------------------------------------------------------------------
alter table public.projects
  add column if not exists responsibles text[] not null default '{}';

comment on column public.projects.responsibles is
  'Responsáveis pelo projeto — áreas e/ou pessoas, em texto livre. O owner_id continua definindo a permissão.';

do $$ begin
  alter table public.projects
    add constraint projects_responsibles_chk check (
      coalesce(array_length(responsibles, 1), 0) <= 12
      and array_position(responsibles, ''::text) is null
      and array_position(responsibles, null::text) is null
    );
exception when duplicate_object then null; end $$;

create index if not exists idx_projects_responsibles on public.projects using gin (responsibles);

-- ---------------------------------------------------------------------
-- VIEWS — expor os responsáveis no portfólio
--
-- A coluna entra só na v_project_360, e não na v_project_overview: a
-- migration 05 recria a overview com a lista original de colunas, e um
-- `create or replace view` que perde coluna é recusado pelo Postgres
-- ("cannot drop columns from view"). Mexer lá quebraria a segunda execução
-- do setup.sql.
--
-- v_project_360 expandiu `v.*` quando foi criada, então ela precisa ser
-- derrubada e recriada — junto com a v_exec_financials, que depende dela.
-- ---------------------------------------------------------------------
drop view if exists public.v_exec_financials;
drop view if exists public.v_project_360;

create view public.v_project_360
with (security_invoker = on) as
select
  v.*,
  p.responsibles,
  p.expected_return,
  p.actual_return,
  p.return_period_months,
  p.financial_notes,
  (p.expected_return - p.budget)                                   as net_benefit,
  (p.actual_return - p.cost)                                       as net_benefit_real,
  public.project_roi(p.budget, p.expected_return)                  as roi_percent,
  public.project_roi(p.cost, p.actual_return)                      as roi_real_percent,
  public.payback_months(p.budget, p.expected_return, p.return_period_months) as payback_months,
  public.viability_rating(
    p.budget,
    p.expected_return,
    public.project_roi(p.budget, p.expected_return)
  )                                                                as viability,
  public.time_elapsed_percent(p.start_date, p.due_date, p.actual_end_date) as time_elapsed_percent,
  public.schedule_index(p.progress, v.expected_progress)            as schedule_index,
  public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) as forecast_end_date,
  case
    when public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) is null then null
    else public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) - p.due_date
  end                                                               as forecast_delay_days,
  coalesce(st.stages_total, 0)                                      as stages_total,
  coalesce(st.stages_done, 0)                                       as stages_done,
  coalesce(st.stages_running, 0)                                    as stages_running,
  coalesce(st.stages_late, 0)                                       as stages_late,
  st.stages_progress                                                as stages_progress
from public.v_project_overview v
join public.projects p on p.id = v.id
left join lateral (
  select
    count(*)                                                as stages_total,
    count(*) filter (where s.status = 'concluida')          as stages_done,
    count(*) filter (where s.status = 'em_andamento')       as stages_running,
    count(*) filter (
      where s.status not in ('concluida', 'cancelada') and s.end_date < current_date
    )                                                       as stages_late,
    round(
      sum(s.weight * s.progress) filter (where s.status <> 'cancelada')
        / nullif(sum(s.weight) filter (where s.status <> 'cancelada'), 0),
      2
    )                                                       as stages_progress
  from public.project_stages s
  where s.project_id = p.id
) st on true;

create view public.v_exec_financials
with (security_invoker = on) as
select
  coalesce(v.department_name, 'Sem departamento') as chave,
  coalesce(v.department_color, '#94a3b8')         as cor,
  count(*)                                        as total,
  coalesce(sum(v.budget), 0)                      as orcamento,
  coalesce(sum(v.cost), 0)                        as custo,
  coalesce(sum(v.expected_return), 0)             as retorno_esperado,
  coalesce(sum(v.actual_return), 0)               as retorno_realizado,
  coalesce(sum(v.expected_return - v.budget), 0)  as beneficio_liquido,
  public.project_roi(sum(v.budget), sum(v.expected_return)) as roi_percent
from public.v_project_360 v
where v.is_archived = false
group by 1, 2;

grant select on public.v_project_360 to authenticated;
grant select on public.v_exec_financials to authenticated;

-- ---------------------------------------------------------------------
-- TAGS — catálogo pedido pela área de projetos
-- ---------------------------------------------------------------------
insert into public.tags (name, color) values
  ('Projetos Moreno',      '#0E8F46'),
  ('Projetos consultoria', '#1B3F94'),
  ('Demandas spot',        '#F59E0B'),
  ('Ficha de projetos',    '#0EA5E9'),
  ('Acompanhamento',       '#64748B'),
  ('Inovação',             '#8CC63F')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250302000000_catalogos_abertos.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 3 · Migration 10 — Catálogos abertos: departamento e responsável
--
-- Antes, departamento só existia se a gestão cadastrasse antes, e o nome de
-- um responsável digitado no formulário morria dentro daquele projeto. Aqui
-- os dois viram catálogo de verdade: quem escreve um nome novo grava a opção
-- para todo mundo escolher depois, e quem criou pode apagar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- RESPONSÁVEIS — catálogo de áreas e pessoas
--
-- É texto, não referência a `profiles`, de propósito: quem responde por um
-- projeto muitas vezes é uma área (COA, Projetos, Actius, MAC) ou alguém que
-- não tem login na plataforma.
-- ---------------------------------------------------------------------
create table if not exists public.responsibles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint responsibles_name_key unique (name),
  constraint responsibles_name_len check (char_length(btrim(name)) between 2 and 80)
);

comment on table public.responsibles is
  'Opções de responsável oferecidas no formulário de projeto. A escolha em si fica em projects.responsibles.';

insert into public.responsibles (name) values
  ('COA'), ('Projetos'), ('Actius'), ('MAC')
on conflict (name) do nothing;

-- As policies copiam as dos outros catálogos (`tags`, `clients`,
-- `departments`), inclusive a exceção que já existia para tags: qualquer
-- pessoa acrescenta uma opção ao preencher um projeto, mas mexer no catálogo
-- é da gestão. Nenhuma regra de acesso nova entra aqui.
alter table public.responsibles enable row level security;

drop policy if exists responsibles_select on public.responsibles;
create policy responsibles_select on public.responsibles
  for select to authenticated using (true);

drop policy if exists responsibles_insert on public.responsibles;
create policy responsibles_insert on public.responsibles
  for insert to authenticated with check (true);

drop policy if exists responsibles_write on public.responsibles;
create policy responsibles_write on public.responsibles
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Versão anterior desta migration; removidas para não sobrar regra solta.
drop policy if exists responsibles_delete on public.responsibles;
drop policy if exists responsibles_update on public.responsibles;

grant select, insert, update, delete on public.responsibles to authenticated;

-- ---------------------------------------------------------------------
-- DEPARTAMENTOS — desfazendo a primeira versão desta migration
--
-- Ela acrescentava `created_by` em `departments` e afrouxava a escrita. Duas
-- coisas deram errado:
--
-- 1. `created_by` criou uma SEGUNDA ligação entre `departments` e `profiles`
--    (a primeira é `profiles.department_id`). Com duas, o PostgREST não sabe
--    por qual caminho embutir e recusa `profiles?select=*,departments(...)`
--    com PGRST201. Essa é justamente a consulta que carrega o perfil de quem
--    está logado — sem ela o site não enxerga papel nenhum e todo mundo vira
--    usuário comum, inclusive o administrador.
-- 2. Afrouxar a escrita mudava a configuração de acesso, que não era o
--    objetivo: o pedido era só sobre as telas de cadastro de projeto.
--
-- Então volta tudo ao que era: escrita de departamento continua com
-- administrador e gerente, pela policy `departments_write` da migration 06.
-- ---------------------------------------------------------------------
drop policy if exists departments_insert_any on public.departments;
drop policy if exists departments_delete_own on public.departments;

alter table public.departments drop column if exists created_by;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250401000000_perfil_analista.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 4 · Migration 11 — Perfil Analista e exclusão da etapa pelo autor
--
-- Duas mudanças, as duas fora da tabela `projects`:
--
--   1. O papel `gerente` some do catálogo de perfis e vira `analista`.
--      Quem já estava como gerente passa a analista com exatamente as
--      mesmas permissões — o rótulo muda, o acesso não. Contas novas
--      passam a nascer como analista em vez de colaborador.
--
--   2. Quem cadastrou uma etapa pode apagá-la, mesmo sem gerenciar o
--      projeto inteiro. Antes só gestão e dono do projeto excluíam, e
--      quem criava a etapa ficava sem saída.
--
-- NENHUMA linha de `projects` é lida, alterada ou apagada aqui. O que a
-- migration toca é: o tipo `app_role`, a coluna `profiles.role`, as
-- funções e policies de acesso, a view `v_workload` e a policy de
-- exclusão de `project_stages`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O TIPO app_role — 'gerente' vira 'analista'
--
-- O Postgres não remove valor de enum. Por isso o tipo é recriado do
-- zero e a coluna migra com `case`: gerente → analista, o resto igual.
-- Recriar (em vez de `add value`) tem outra vantagem: um valor novo
-- adicionado a um enum existente só pode ser usado depois que a
-- transação termina, e o setup.sql roda tudo de uma vez só.
--
-- O bloco inteiro é pulado quando 'gerente' já não existe — rodar o
-- setup.sql de novo não repete a conversão.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role' and e.enumlabel = 'gerente'
  ) then
    -- Dependências declaradas do tipo antigo. Todas voltam logo abaixo,
    -- com o mesmo texto de antes exceto pela troca do rótulo.
    drop view if exists public.v_workload;
    drop policy if exists profiles_update_self on public.profiles;
    drop policy if exists projects_insert on public.projects;
    drop function if exists public.current_app_role();

    alter type public.app_role rename to app_role_ate_migration_10;
    create type public.app_role as enum ('administrador', 'analista', 'lider', 'colaborador');

    alter table public.profiles alter column role drop default;
    alter table public.profiles
      alter column role type public.app_role
      using (case role::text when 'gerente' then 'analista' else role::text end)::public.app_role;
    alter table public.profiles alter column role set default 'analista'::public.app_role;

    -- As demais funções guardam o corpo como texto e são reinterpretadas
    -- a cada execução, então não seguram o tipo antigo.
    drop type public.app_role_ate_migration_10;
  end if;
end $$;

comment on column public.profiles.role is
  'Perfil de acesso: administrador > analista > lider > colaborador. Analista enxerga e gerencia todo o portfólio.';

-- ---------------------------------------------------------------------
-- Funções de autorização — mesmo comportamento, novo rótulo
-- ---------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- Administrador e Analista enxergam o portfólio inteiro.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('administrador', 'analista') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- Conta nova nasce como Analista
--
-- O primeiro usuário continua assumindo a administração da plataforma.
-- Um `role` inválido vindo do metadata (por exemplo o antigo 'gerente')
-- cai no analista pelo bloco de exceção.
-- ---------------------------------------------------------------------
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_is_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_is_first;

  begin
    v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'analista');
  exception when others then
    v_role := 'analista';
  end;

  if v_is_first then
    v_role := 'administrador';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    v_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Policies que citavam o perfil pelo nome
-- ---------------------------------------------------------------------
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_app_role());

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.current_app_role() in ('administrador', 'analista', 'lider'));

-- ---------------------------------------------------------------------
-- v_workload — recriada igual à migration 05 (expõe profiles.role)
-- ---------------------------------------------------------------------
create or replace view public.v_workload
with (security_invoker = on) as
select
  pr.id                                   as user_id,
  pr.full_name,
  pr.avatar_url,
  pr.job_title,
  pr.role,
  pr.department_id,
  d.name                                  as department_name,
  pr.weekly_capacity_hours                as capacidade_semanal,
  coalesce(t.horas_planejadas, 0)         as horas_planejadas,
  coalesce(h.horas_realizadas, 0)         as horas_realizadas,
  coalesce(t.tarefas_abertas, 0)          as tarefas_abertas,
  coalesce(t.tarefas_atrasadas, 0)        as tarefas_atrasadas,
  coalesce(pm.projetos_ativos, 0)         as projetos_ativos,
  coalesce(pm.projetos_atrasados, 0)      as projetos_atrasados,
  round(
    (coalesce(t.horas_planejadas, 0) / nullif(pr.weekly_capacity_hours, 0)) * 100, 2
  )                                       as ocupacao_percentual,
  greatest(pr.weekly_capacity_hours - coalesce(t.horas_planejadas, 0), 0) as disponibilidade_horas
from public.profiles pr
left join public.departments d on d.id = pr.department_id
left join lateral (
  select
    coalesce(sum(tk.estimated_hours * (1 - tk.progress / 100.0)), 0) as horas_planejadas,
    count(*) filter (where tk.status <> 'concluido')                 as tarefas_abertas,
    count(*) filter (where tk.status <> 'concluido' and tk.due_date < current_date) as tarefas_atrasadas
  from public.tasks tk
  where tk.assignee_id = pr.id and tk.status <> 'concluido'
) t on true
left join lateral (
  select coalesce(sum(e.hours), 0) as horas_realizadas
  from public.time_entries e
  where e.user_id = pr.id and e.work_date >= date_trunc('week', current_date)::date
) h on true
left join lateral (
  select
    count(*) filter (where p.status not in ('concluido', 'cancelado')) as projetos_ativos,
    count(*) filter (where p.health in ('atrasado', 'critico'))        as projetos_atrasados
  from public.project_members m
  join public.projects p on p.id = m.project_id
  where m.user_id = pr.id
) pm on true
where pr.is_active = true;

grant select on public.v_workload to authenticated;

-- ---------------------------------------------------------------------
-- 2. ETAPAS — quem cadastrou pode apagar
--
-- A exclusão continua fechada para o resto do time: gestão, dono do
-- projeto e, agora, o autor da etapa. `created_by` já era gravado no
-- insert, só não era considerado aqui.
-- ---------------------------------------------------------------------
drop policy if exists project_stages_delete on public.project_stages;
create policy project_stages_delete on public.project_stages
  for delete to authenticated
  using (public.can_manage_project(project_id) or created_by = auth.uid());

-- A tela precisa saber quem criou a etapa para mostrar (ou não) o botão de
-- excluir. A coluna entra no fim da view — `create or replace view` aceita
-- acrescentar coluna, nunca remover.
create or replace view public.v_project_stages
with (security_invoker = on) as
select
  s.id,
  s.project_id,
  p.code                                       as project_code,
  p.name                                       as project_name,
  s.name,
  s.description,
  s.progress_notes,
  s.status,
  s.position,
  s.start_date,
  s.end_date,
  s.actual_start_date,
  s.actual_end_date,
  s.progress,
  s.weight,
  s.owner_id,
  o.full_name                                  as owner_name,
  o.avatar_url                                 as owner_avatar,
  (s.end_date - s.start_date) + 1               as duracao_dias,
  public.business_days(s.start_date, s.end_date) as duracao_dias_uteis,
  public.expected_progress(s.start_date, s.end_date) as expected_progress,
  round(s.progress - public.expected_progress(s.start_date, s.end_date), 2) as progress_delta,
  public.time_elapsed_percent(s.start_date, s.end_date, s.actual_end_date) as time_elapsed_percent,
  (s.end_date - current_date)                  as dias_restantes,
  -- Etapa concluída tem o atraso medido pela data real de término.
  greatest(coalesce(s.actual_end_date, current_date) - s.end_date, 0) as dias_atraso,
  (
    s.status not in ('concluida', 'cancelada')
    and s.end_date < current_date
  )                                            as atrasada,
  s.created_at,
  s.updated_at,
  s.created_by
from public.project_stages s
join public.projects p on p.id = s.project_id
left join public.profiles o on o.id = s.owner_id;

grant select on public.v_project_stages to authenticated;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250501000000_alertas_agendados.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 5 · Migration 12 — Alertas de prazo no automático
-- =====================================================================
--
-- `generate_deadline_alerts()` existe desde a migration 03 e faz o trabalho
-- todo: cria as notificações de prazo hoje, prazo amanhã e projeto atrasado,
-- sem repetir o que já mandou no mesmo dia. Só que nada nunca a chamava — a
-- função ficava parada, e por isso o sino só acendia com comentário, menção e
-- atribuição de tarefa.
--
-- Aqui ela ganha horário. Nenhuma tabela é criada, alterada ou apagada: o que
-- entra é uma linha na agenda do pg_cron.
--
-- 11:00 UTC = 08:00 em Brasília. O banco do Supabase roda em UTC, então o
-- horário é escrito em UTC de propósito — se a conversão fosse feita "na
-- cabeça" o alerta chegaria três horas fora.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A extensão pode não estar liberada no projeto. Não é motivo para o
-- setup.sql inteiro parar: o resto do banco não depende disto.
-- ---------------------------------------------------------------------
do $mig$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice
    'pg_cron indisponível (%). Habilite em Database → Extensions, ou chame '
    'select public.generate_deadline_alerts(); por outro agendador.', sqlerrm;
end $mig$;

do $mig$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'Sem pg_cron: os alertas de prazo seguem dependendo de chamada manual.';
    return;
  end if;

  -- Reexecutar o setup.sql não pode duplicar a agenda.
  if exists (select 1 from cron.job where jobname = 'webdash-alertas-diarios') then
    perform cron.unschedule('webdash-alertas-diarios');
  end if;

  perform cron.schedule(
    'webdash-alertas-diarios',
    '0 11 * * *',
    'select public.generate_deadline_alerts();'
  );

  raise notice 'Alertas de prazo agendados para 11:00 UTC (08:00 de Brasília).';
exception when others then
  raise notice 'Não foi possível agendar os alertas (%).', sqlerrm;
end $mig$;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250502000000_lembretes.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 5 · Migration 13 — Lembretes programados pela própria pessoa
-- =====================================================================
--
-- Os alertas que já existiam nascem de regra: prazo chegando, projeto
-- atrasado, alguém te mencionou. Este é o contrário — a pessoa marca a hora
-- que quiser, para o projeto que quiser, e o navegador avisa.
--
-- Só cria tabela nova. Nada existente é alterado ou removido.
-- =====================================================================

create table if not exists public.reminders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  project_id     uuid references public.projects (id) on delete cascade,
  title          text not null,
  body           text,

  -- Quando avisar da próxima vez. É esta coluna que a tela consulta.
  next_at        timestamptz not null,

  -- Minutos entre um aviso e o seguinte. Nulo = avisa uma vez e encerra.
  -- O piso de 5 minutos evita que um erro de digitação vire um aviso por
  -- segundo na cara de quem cadastrou.
  repeat_minutes integer,

  is_active      boolean not null default true,
  last_fired_at  timestamptz,
  created_at     timestamptz not null default now(),

  constraint reminders_title_chk check (char_length(btrim(title)) between 2 and 120),
  constraint reminders_repeat_chk check (repeat_minutes is null or repeat_minutes >= 5)
);

-- A consulta da tela é sempre "meus lembretes vencidos, do mais antigo".
create index if not exists idx_reminders_due
  on public.reminders (user_id, is_active, next_at);

alter table public.reminders enable row level security;

-- Lembrete é assunto de quem criou: ninguém mais lê, edita ou apaga.
drop policy if exists reminders_select_own on public.reminders;
create policy reminders_select_own on public.reminders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists reminders_insert_own on public.reminders;
create policy reminders_insert_own on public.reminders
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists reminders_update_own on public.reminders;
create policy reminders_update_own on public.reminders
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reminders_delete_own on public.reminders;
create policy reminders_delete_own on public.reminders
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.reminders to authenticated;

-- ---------------------------------------------------------------------
-- O lembrete disparado também vira linha no sino, para ficar no histórico
-- junto com os outros alertas. Para isso falta uma policy de insert em
-- `notifications`: até aqui só as funções `security definer` escreviam lá.
--
-- A permissão é a mais estreita possível — criar notificação **para si
-- mesmo**. Quem já podia ler, marcar como lida e apagar as próprias agora
-- pode criar as próprias; não abre nada sobre as de mais ninguém.
-- ---------------------------------------------------------------------
drop policy if exists notifications_insert_self on public.notifications;
create policy notifications_insert_self on public.notifications
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Realtime: a tela escuta a própria fila de lembretes.
-- ---------------------------------------------------------------------
do $$
begin
  alter table public.reminders replica identity full;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reminders'
  ) then
    alter publication supabase_realtime add table public.reminders;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250503000000_analistas_responsaveis.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 5 · Migration 14 — Mais de um analista respondendo pelo projeto
-- =====================================================================
--
-- O projeto tinha um "dono no sistema" só: `projects.owner_id`. Agora a tela
-- deixa marcar vários analistas responsáveis, e todos precisam poder editar o
-- projeto — senão o campo vira enfeite.
--
-- O primeiro escolhido continua em `owner_id`, porque é dele que as views
-- tiram `owner_name` e é ele o registro histórico de quem responde primeiro.
-- Os demais entram em `project_members` com `role_in_project = 'gestor'`, que
-- já era o papel gravado para o dono desde o começo.
--
-- Falta a permissão acompanhar: `can_manage_project()` olhava o papel da
-- pessoa no **perfil** (`profiles.role = 'lider'`), e não o papel dela **no
-- projeto**. Quem fosse marcado como gestor de um projeto sem ser líder da
-- casa continuava sem poder editar.
--
-- Nada é removido: a condição nova entra somando às que já existiam.
-- =====================================================================

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_manager()
      -- Primeiro analista responsável (o antigo "dono no sistema").
      or exists (
           select 1 from public.projects pr
            where pr.id = p_project_id and pr.owner_id = auth.uid()
         )
      -- Demais analistas responsáveis, marcados como gestores do projeto.
      or exists (
           select 1 from public.project_members m
            where m.project_id = p_project_id
              and m.user_id = auth.uid()
              and m.role_in_project = 'gestor'
         )
      -- Líder da casa que participa do projeto — regra original, mantida.
      or exists (
           select 1
             from public.project_members m
             join public.profiles p on p.id = m.user_id
            where m.project_id = p_project_id
              and m.user_id = auth.uid()
              and p.role = 'lider'
         );
$$;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250504000000_prazo_projeto_encerrado.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 5 · Migration 15 — Projeto encerrado não fica "em atraso"
-- =====================================================================
--
-- `days_late` era `greatest(current_date - due_date, 0)`, sem olhar o status.
-- Um projeto entregue em julho com prazo em junho continuava somando um dia
-- de atraso por dia, para sempre — o atraso crescia depois de o trabalho ter
-- acabado. O mesmo para `days_remaining`, que ficava cada vez mais negativo.
--
-- A saúde já estava certa: `calc_health()` devolve 'no_prazo' para concluído
-- e cancelado desde o começo. Era só a contagem de dias que continuava
-- correndo.
--
-- Entra também `realizacao_dias`: quanto o projeto levou de fato, do começo
-- real à entrega. É o número que interessa depois de encerrado — o prazo já
-- não tem o que cobrar.
--
-- Só a expressão das colunas muda. Nenhuma tabela é tocada, nenhum dado é
-- reescrito, e o `create or replace` mantém nome, tipo e ordem — por isso a
-- `v_project_360`, que lê `v.*` daqui, continua válida sem ser recriada.
-- =====================================================================

create or replace view public.v_project_overview
with (security_invoker = on) as
select
  p.id,
  p.code,
  p.name,
  p.description,
  p.status,
  p.priority,
  p.complexity,
  p.category,
  p.health,
  p.start_date,
  p.due_date,
  p.actual_start_date,
  p.actual_end_date,
  p.budget,
  p.cost,
  p.planned_hours,
  p.progress,
  p.is_archived,
  p.created_at,
  p.updated_at,
  p.department_id,
  d.name  as department_name,
  d.color as department_color,
  p.client_id,
  c.name  as client_name,
  p.owner_id,
  o.full_name  as owner_name,
  o.avatar_url as owner_avatar,
  coalesce(tm.team_count, 0)              as team_count,
  coalesce(tk.total_tasks, 0)             as total_tasks,
  coalesce(tk.done_tasks, 0)              as done_tasks,
  coalesce(tk.late_tasks, 0)              as late_tasks,
  coalesce(tk.estimated_hours, 0)         as tasks_estimated_hours,
  coalesce(te.actual_hours, 0)            as actual_hours,
  coalesce(ck.checklist_total, 0)         as checklist_total,
  coalesce(ck.checklist_done, 0)          as checklist_done,
  coalesce(rk.open_risks, 0)              as open_risks,
  coalesce(rk.max_severity, 0)            as max_risk_severity,
  coalesce(ms.milestones_total, 0)        as milestones_total,
  coalesce(ms.milestones_done, 0)         as milestones_done,
  public.expected_progress(p.start_date, p.due_date)                as expected_progress,
  round(p.progress - public.expected_progress(p.start_date, p.due_date), 2) as progress_delta,

  -- Encerrado não tem mais prazo correndo: zera em vez de seguir contando.
  case
    when p.status in ('concluido', 'cancelado') then 0
    else (p.due_date - current_date)
  end                                                               as days_remaining,
  case
    when p.status in ('concluido', 'cancelado') then 0
    else greatest(current_date - p.due_date, 0)
  end                                                               as days_late,

  public.business_days(current_date, p.due_date)                    as business_days_remaining,
  public.business_days(p.start_date, p.due_date)                    as business_days_total,
  case
    when coalesce(te.actual_hours, 0) = 0 then null
    else round((coalesce(tk.estimated_hours, 0) / nullif(te.actual_hours, 0)) * 100, 2)
  end                                                               as efficiency
from public.projects p
left join public.departments d on d.id = p.department_id
left join public.clients c     on c.id = p.client_id
left join public.profiles o    on o.id = p.owner_id
left join lateral (
  select count(*) as team_count from public.project_members m where m.project_id = p.id
) tm on true
left join lateral (
  select
    count(*)                                            as total_tasks,
    count(*) filter (where t.status = 'concluido')      as done_tasks,
    count(*) filter (
      where t.status <> 'concluido' and t.due_date < current_date
    )                                                   as late_tasks,
    coalesce(sum(t.estimated_hours), 0)                 as estimated_hours
  from public.tasks t where t.project_id = p.id
) tk on true
left join lateral (
  select coalesce(sum(e.hours), 0) as actual_hours
  from public.time_entries e where e.project_id = p.id
) te on true
left join lateral (
  select
    count(*)                                       as checklist_total,
    count(*) filter (where ci.is_done)             as checklist_done
  from public.checklist_items ci where ci.project_id = p.id
) ck on true
left join lateral (
  select count(*) filter (where r.status not in ('mitigado', 'aceito')) as open_risks,
         coalesce(max(r.severity) filter (where r.status not in ('mitigado', 'aceito')), 0) as max_severity
  from public.risks r where r.project_id = p.id
) rk on true
left join lateral (
  select count(*) as milestones_total, count(*) filter (where m.status = 'concluido') as milestones_done
  from public.milestones m where m.project_id = p.id
) ms on true;

-- `realizacao_dias` entra na `v_project_360`, e não na `v_project_overview`.
--
-- É o que mantém o setup.sql repetível: a migration 05 refaz a overview com
-- `create or replace`, que recusa perder coluna. Se a coluna nova morasse
-- lá, a segunda execução do arquivo pararia em "cannot drop columns from
-- view" — foi exatamente o que aconteceu ao testar. A 360 é derrubada e
-- recriada aqui, então aceita colunas novas à vontade.
drop view if exists public.v_exec_financials;
drop view if exists public.v_project_360;

create view public.v_project_360
with (security_invoker = on) as
select
  v.*,
  p.expected_return,
  p.actual_return,
  p.return_period_months,
  p.financial_notes,
  (p.expected_return - p.budget)                                   as net_benefit,
  (p.actual_return - p.cost)                                       as net_benefit_real,
  public.project_roi(p.budget, p.expected_return)                  as roi_percent,
  public.project_roi(p.cost, p.actual_return)                      as roi_real_percent,
  public.payback_months(p.budget, p.expected_return, p.return_period_months) as payback_months,
  public.viability_rating(
    p.budget,
    p.expected_return,
    public.project_roi(p.budget, p.expected_return)
  )                                                                as viability,
  public.time_elapsed_percent(p.start_date, p.due_date, p.actual_end_date) as time_elapsed_percent,
  public.schedule_index(p.progress, v.expected_progress)            as schedule_index,
  public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) as forecast_end_date,
  case
    when public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) is null then null
    else public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) - p.due_date
  end                                                               as forecast_delay_days,
  coalesce(st.stages_total, 0)                                      as stages_total,
  coalesce(st.stages_done, 0)                                       as stages_done,
  coalesce(st.stages_running, 0)                                    as stages_running,
  coalesce(st.stages_late, 0)                                       as stages_late,
  st.stages_progress                                                as stages_progress,

  -- Quanto o projeto levou de fato. Usa as datas reais quando existem — o
  -- trigger as carimba ao sair do backlog e ao concluir — e cai para as
  -- planejadas quando o projeto é anterior a esse controle. Fica nulo
  -- enquanto o projeto não terminou: não há duração de algo em curso.
  case
    when p.status in ('concluido', 'cancelado')
      then greatest(
             coalesce(p.actual_end_date, current_date)
               - coalesce(p.actual_start_date, p.start_date),
             0
           )
    else null
  end                                                               as realizacao_dias
from public.v_project_overview v
join public.projects p on p.id = v.id
left join lateral (
  select
    count(*)                                                as stages_total,
    count(*) filter (where s.status = 'concluida')          as stages_done,
    count(*) filter (where s.status = 'em_andamento')       as stages_running,
    count(*) filter (
      where s.status not in ('concluida', 'cancelada') and s.end_date < current_date
    )                                                       as stages_late,
    round(
      sum(s.weight * s.progress) filter (where s.status <> 'cancelada')
        / nullif(sum(s.weight) filter (where s.status <> 'cancelada'), 0),
      2
    )                                                       as stages_progress
  from public.project_stages s
  where s.project_id = p.id
) st on true;

grant select on public.v_project_360 to authenticated;

-- Recriada igual à migration 08 — só precisou cair junto por depender da 360.
create view public.v_exec_financials
with (security_invoker = on) as
select
  coalesce(v.department_name, 'Sem departamento') as chave,
  coalesce(v.department_color, '#94a3b8')         as cor,
  count(*)                                        as total,
  coalesce(sum(v.budget), 0)                      as orcamento,
  coalesce(sum(v.cost), 0)                        as custo,
  coalesce(sum(v.expected_return), 0)             as retorno_esperado,
  coalesce(sum(v.actual_return), 0)               as retorno_realizado,
  coalesce(sum(v.expected_return - v.budget), 0)  as beneficio_liquido,
  public.project_roi(sum(v.budget), sum(v.expected_return)) as roi_percent
from public.v_project_360 v
where v.is_archived = false
group by 1, 2;

grant select on public.v_exec_financials to authenticated;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/migrations/20250505000000_prazo_a_definir.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Fase 5 · Migration 16 — Prazo a definir
-- =====================================================================
--
-- Os prazos herdados não valem: muito projeto entrou com data provisória e
-- hoje aparece atrasado sem que ninguém tenha combinado nada. Enquanto o
-- prazo de verdade não é repactuado, esses projetos passam a mostrar "A
-- definir" e saem da conta de atrasados.
--
-- A data antiga NÃO é apagada. Ela continua em `due_date`, intacta, e volta a
-- valer no instante em que a marca sair. O que entra é uma marca ao lado —
-- reversível por um clique no formulário do projeto.
--
-- Manter a data também é o que segura o resto de pé: `expected_progress()`,
-- Gantt, roadmap e calendário contam com uma data sempre presente, e um nulo
-- ali quebraria os quatro.
-- =====================================================================

alter table public.projects
  add column if not exists prazo_a_definir boolean not null default false;

comment on column public.projects.prazo_a_definir is
  'Prazo herdado, ainda não repactuado. A data em due_date continua guardada; '
  'enquanto isto for verdadeiro a tela mostra "A definir" e o projeto não '
  'entra na conta de atrasados.';

-- ---------------------------------------------------------------------
-- Saúde: quem está com prazo a definir não é atrasado — é indefinido.
--
-- A regra fica no gatilho, e não em `calc_health()`: mudar a assinatura da
-- função criaria uma sobrecarga de cinco e outra de seis argumentos, e a
-- ambiguidade entre as duas é o tipo de coisa que aparece meses depois.
-- ---------------------------------------------------------------------
create or replace function public.tg_project_intelligence()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'concluido' then
    new.progress := 100;
    if new.actual_end_date is null then
      new.actual_end_date := current_date;
    end if;
  elsif new.status <> 'backlog' and new.actual_start_date is null then
    new.actual_start_date := current_date;
  end if;

  if new.prazo_a_definir then
    -- Sem prazo combinado não há atraso a declarar.
    new.health := 'no_prazo';
  else
    new.health := public.calc_health(
      new.status, new.start_date, new.due_date, new.progress, new.priority
    );
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Marcação inicial: o que está em atraso hoje e ainda em aberto.
--
-- Concluído e cancelado ficam de fora de propósito — nesses o prazo já não
-- cobra nada, e o cartão passou a mostrar a duração da realização.
--
-- O próprio UPDATE dispara o gatilho acima, então a saúde é recalculada na
-- mesma passada. `where prazo_a_definir is not true` deixa a migration
-- repetível sem reescrever o que já foi ajustado à mão.
-- ---------------------------------------------------------------------
update public.projects
   set prazo_a_definir = true
 where status not in ('concluido', 'cancelado')
   and health in ('atrasado', 'critico')
   and prazo_a_definir is not true;

-- ---------------------------------------------------------------------
-- A coluna precisa chegar às telas, e vai pela `v_project_360` — nunca pela
-- `v_project_overview`. A migration 05 refaz a overview a cada execução do
-- setup.sql com `create or replace`, que recusa perder coluna; qualquer
-- coluna nova ali faria a segunda execução parar em "cannot drop columns
-- from view". Na overview muda só a expressão de `days_late` e
-- `days_remaining`, que a 05 restaura e esta migration corrige de novo.
-- ---------------------------------------------------------------------
create or replace view public.v_project_overview
with (security_invoker = on) as
select
  p.id,
  p.code,
  p.name,
  p.description,
  p.status,
  p.priority,
  p.complexity,
  p.category,
  p.health,
  p.start_date,
  p.due_date,
  p.actual_start_date,
  p.actual_end_date,
  p.budget,
  p.cost,
  p.planned_hours,
  p.progress,
  p.is_archived,
  p.created_at,
  p.updated_at,
  p.department_id,
  d.name  as department_name,
  d.color as department_color,
  p.client_id,
  c.name  as client_name,
  p.owner_id,
  o.full_name  as owner_name,
  o.avatar_url as owner_avatar,
  coalesce(tm.team_count, 0)              as team_count,
  coalesce(tk.total_tasks, 0)             as total_tasks,
  coalesce(tk.done_tasks, 0)              as done_tasks,
  coalesce(tk.late_tasks, 0)              as late_tasks,
  coalesce(tk.estimated_hours, 0)         as tasks_estimated_hours,
  coalesce(te.actual_hours, 0)            as actual_hours,
  coalesce(ck.checklist_total, 0)         as checklist_total,
  coalesce(ck.checklist_done, 0)          as checklist_done,
  coalesce(rk.open_risks, 0)              as open_risks,
  coalesce(rk.max_severity, 0)            as max_risk_severity,
  coalesce(ms.milestones_total, 0)        as milestones_total,
  coalesce(ms.milestones_done, 0)         as milestones_done,
  public.expected_progress(p.start_date, p.due_date)                as expected_progress,
  round(p.progress - public.expected_progress(p.start_date, p.due_date), 2) as progress_delta,

  -- Encerrado não tem prazo correndo; prazo a definir não tem prazo nenhum.
  case
    when p.status in ('concluido', 'cancelado') or p.prazo_a_definir then 0
    else (p.due_date - current_date)
  end                                                               as days_remaining,
  case
    when p.status in ('concluido', 'cancelado') or p.prazo_a_definir then 0
    else greatest(current_date - p.due_date, 0)
  end                                                               as days_late,

  public.business_days(current_date, p.due_date)                    as business_days_remaining,
  public.business_days(p.start_date, p.due_date)                    as business_days_total,
  case
    when coalesce(te.actual_hours, 0) = 0 then null
    else round((coalesce(tk.estimated_hours, 0) / nullif(te.actual_hours, 0)) * 100, 2)
  end                                                               as efficiency
from public.projects p
left join public.departments d on d.id = p.department_id
left join public.clients c     on c.id = p.client_id
left join public.profiles o    on o.id = p.owner_id
left join lateral (
  select count(*) as team_count from public.project_members m where m.project_id = p.id
) tm on true
left join lateral (
  select
    count(*)                                            as total_tasks,
    count(*) filter (where t.status = 'concluido')      as done_tasks,
    count(*) filter (
      where t.status <> 'concluido' and t.due_date < current_date
    )                                                   as late_tasks,
    coalesce(sum(t.estimated_hours), 0)                 as estimated_hours
  from public.tasks t where t.project_id = p.id
) tk on true
left join lateral (
  select coalesce(sum(e.hours), 0) as actual_hours
  from public.time_entries e where e.project_id = p.id
) te on true
left join lateral (
  select
    count(*)                                       as checklist_total,
    count(*) filter (where ci.is_done)             as checklist_done
  from public.checklist_items ci where ci.project_id = p.id
) ck on true
left join lateral (
  select count(*) filter (where r.status not in ('mitigado', 'aceito')) as open_risks,
         coalesce(max(r.severity) filter (where r.status not in ('mitigado', 'aceito')), 0) as max_severity
  from public.risks r where r.project_id = p.id
) rk on true
left join lateral (
  select count(*) as milestones_total, count(*) filter (where m.status = 'concluido') as milestones_done
  from public.milestones m where m.project_id = p.id
) ms on true;

drop view if exists public.v_exec_financials;
drop view if exists public.v_project_360;

create view public.v_project_360
with (security_invoker = on) as
select
  v.*,
  p.expected_return,
  p.actual_return,
  p.return_period_months,
  p.financial_notes,
  (p.expected_return - p.budget)                                   as net_benefit,
  (p.actual_return - p.cost)                                       as net_benefit_real,
  public.project_roi(p.budget, p.expected_return)                  as roi_percent,
  public.project_roi(p.cost, p.actual_return)                      as roi_real_percent,
  public.payback_months(p.budget, p.expected_return, p.return_period_months) as payback_months,
  public.viability_rating(
    p.budget,
    p.expected_return,
    public.project_roi(p.budget, p.expected_return)
  )                                                                as viability,
  public.time_elapsed_percent(p.start_date, p.due_date, p.actual_end_date) as time_elapsed_percent,
  public.schedule_index(p.progress, v.expected_progress)            as schedule_index,
  public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) as forecast_end_date,
  case
    when public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) is null then null
    else public.forecast_end_date(p.start_date, p.due_date, p.progress, p.actual_end_date) - p.due_date
  end                                                               as forecast_delay_days,
  coalesce(st.stages_total, 0)                                      as stages_total,
  coalesce(st.stages_done, 0)                                       as stages_done,
  coalesce(st.stages_running, 0)                                    as stages_running,
  coalesce(st.stages_late, 0)                                       as stages_late,
  st.stages_progress                                                as stages_progress,
  case
    when p.status in ('concluido', 'cancelado')
      then greatest(
             coalesce(p.actual_end_date, current_date)
               - coalesce(p.actual_start_date, p.start_date),
             0
           )
    else null
  end                                                               as realizacao_dias,
  p.prazo_a_definir
from public.v_project_overview v
join public.projects p on p.id = v.id
left join lateral (
  select
    count(*)                                                as stages_total,
    count(*) filter (where s.status = 'concluida')          as stages_done,
    count(*) filter (where s.status = 'em_andamento')       as stages_running,
    count(*) filter (
      where s.status not in ('concluida', 'cancelada') and s.end_date < current_date
    )                                                       as stages_late,
    round(
      sum(s.weight * s.progress) filter (where s.status <> 'cancelada')
        / nullif(sum(s.weight) filter (where s.status <> 'cancelada'), 0),
      2
    )                                                       as stages_progress
  from public.project_stages s
  where s.project_id = p.id
) st on true;

grant select on public.v_project_360 to authenticated;

create view public.v_exec_financials
with (security_invoker = on) as
select
  coalesce(v.department_name, 'Sem departamento') as chave,
  coalesce(v.department_color, '#94a3b8')         as cor,
  count(*)                                        as total,
  coalesce(sum(v.budget), 0)                      as orcamento,
  coalesce(sum(v.cost), 0)                        as custo,
  coalesce(sum(v.expected_return), 0)             as retorno_esperado,
  coalesce(sum(v.actual_return), 0)               as retorno_realizado,
  coalesce(sum(v.expected_return - v.budget), 0)  as beneficio_liquido,
  public.project_roi(sum(v.budget), sum(v.expected_return)) as roi_percent
from public.v_project_360 v
where v.is_archived = false
group by 1, 2;

grant select on public.v_exec_financials to authenticated;

-- ---------------------------------------------------------------------
-- ORIGEM: supabase/seed.sql (departamentos, clientes e tags do Grupo Moreno)
-- ---------------------------------------------------------------------

-- =====================================================================
-- Seed — cadastros básicos do Grupo Moreno
-- Executar após aplicar as migrations: supabase db reset / supabase db push
-- =====================================================================

insert into public.departments (name, code, color) values
  ('Tecnologia da Informação', 'TI',       '#1B3F94'),
  ('Operações',               'OPE',      '#0E8F46'),
  ('Comercial',               'COM',      '#8CC63F'),
  ('Financeiro',              'FIN',      '#0F4C81'),
  ('Recursos Humanos',        'RH',       '#16A34A'),
  ('Marketing',               'MKT',      '#65A30D')
on conflict (code) do nothing;

insert into public.clients (name, code, contact_name, contact_email) values
  ('Interno — Grupo Moreno', 'GM-INT', 'Diretoria',        'diretoria@grupomoreno.com.br'),
  ('Moreno Distribuição',    'GM-DIS', 'Central de Contas', 'contas@grupomoreno.com.br'),
  ('Moreno Logística',       'GM-LOG', 'Coordenação',      'logistica@grupomoreno.com.br')
on conflict (code) do nothing;

insert into public.tags (name, color) values
  ('Estratégico',   '#1B3F94'),
  ('Inovação',      '#8CC63F'),
  ('Compliance',    '#0E8F46'),
  ('Redução de custo', '#F59E0B'),
  ('Cliente',       '#0EA5E9'),
  ('Infraestrutura', '#64748B')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Massa de demonstração — chamar logado como administrador:
--   select public.seed_demo_projects();
-- ---------------------------------------------------------------------
create or replace function public.seed_demo_projects()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_dep_ti uuid;
  v_dep_ope uuid;
  v_client uuid;
  v_proj uuid;
  v_task_a uuid;
  v_task_b uuid;
begin
  if v_user is null then
    return 'Nenhum usuário autenticado.';
  end if;

  select id into v_dep_ti  from public.departments where code = 'TI';
  select id into v_dep_ope from public.departments where code = 'OPE';
  select id into v_client  from public.clients where code = 'GM-INT';

  -- Projeto 1 -------------------------------------------------------
  insert into public.projects (code, name, description, department_id, client_id, owner_id,
                               status, priority, complexity, category, start_date, due_date,
                               budget, planned_hours, created_by,
                               expected_return, return_period_months, financial_notes)
  values ('PRJ-001', 'Portal Corporativo Grupo Moreno',
          'Unificação dos sistemas internos em um portal único com SSO.',
          v_dep_ti, v_client, v_user, 'em_desenvolvimento', 'alta', 'alta', 'Transformação Digital',
          current_date - 30, current_date + 45, 250000, 640, v_user,
          620000, 24, 'Economia de licenças duplicadas e horas de suporte no primeiro biênio.')
  on conflict (code) do nothing
  returning id into v_proj;

  if v_proj is null then
    return 'Massa de demonstração já existente.';
  end if;

  insert into public.project_members (project_id, user_id, role_in_project) values (v_proj, v_user, 'gestor');

  insert into public.tasks (project_id, title, status, priority, assignee_id, start_date, due_date,
                            estimated_hours, progress, position, created_by)
  values (v_proj, 'Levantamento de requisitos', 'concluido', 'alta', v_user,
          current_date - 30, current_date - 20, 40, 100, 10, v_user)
  returning id into v_task_a;

  insert into public.tasks (project_id, title, status, priority, assignee_id, start_date, due_date,
                            estimated_hours, progress, position, created_by)
  values (v_proj, 'Arquitetura e modelagem de dados', 'em_desenvolvimento', 'critica', v_user,
          current_date - 19, current_date + 5, 80, 60, 10, v_user)
  returning id into v_task_b;

  insert into public.task_dependencies (predecessor_id, successor_id, type) values (v_task_a, v_task_b, 'FS');

  insert into public.tasks (project_id, title, status, priority, start_date, due_date,
                            estimated_hours, position, created_by)
  values
    (v_proj, 'Implementação do SSO',        'planejamento', 'alta', current_date + 6,  current_date + 25, 120, 10, v_user),
    (v_proj, 'Homologação com key users',   'backlog',      'media', current_date + 26, current_date + 40, 60,  10, v_user);

  insert into public.milestones (project_id, name, due_date) values
    (v_proj, 'Go-live piloto', current_date + 30),
    (v_proj, 'Rollout completo', current_date + 45);

  insert into public.risks (project_id, title, probability, impact, mitigation, owner_id, created_by) values
    (v_proj, 'Indisponibilidade do time de infraestrutura', 3, 4,
     'Reservar janela dedicada e formalizar SLA interno.', v_user, v_user),
    (v_proj, 'Mudança de escopo pela diretoria', 4, 5,
     'Comitê quinzenal de mudanças com ata formal.', v_user, v_user);

  insert into public.checklist_items (project_id, title, position, created_by) values
    (v_proj, 'Termo de abertura assinado', 10, v_user),
    (v_proj, 'Ambiente de homologação provisionado', 20, v_user);

  insert into public.project_stages (project_id, name, description, progress_notes, status, owner_id,
                                     start_date, end_date, actual_start_date, actual_end_date,
                                     progress, weight, position, created_by)
  values
    (v_proj, 'Diagnóstico', 'Mapeamento dos sistemas legados e das integrações existentes.',
     'Concluída com 12 sistemas mapeados e 4 integrações críticas identificadas.',
     'concluida', v_user, current_date - 30, current_date - 18, current_date - 30, current_date - 19,
     100, 1, 1, v_user),
    (v_proj, 'Arquitetura', 'Definição do modelo de dados e do provedor de identidade.',
     'Modelo de dados aprovado; provedor de SSO em avaliação final com a segurança da informação.',
     'em_andamento', v_user, current_date - 17, current_date + 5, current_date - 17, null,
     60, 2, 2, v_user),
    (v_proj, 'Construção', 'Desenvolvimento do portal e das integrações.',
     null, 'nao_iniciada', v_user, current_date + 6, current_date + 32, null, null, 0, 3, 3, v_user),
    (v_proj, 'Homologação e go-live', 'Testes com key users, treinamento e virada.',
     null, 'nao_iniciada', v_user, current_date + 33, current_date + 45, null, null, 0, 1, 4, v_user);

  -- Projeto 2 -------------------------------------------------------
  insert into public.projects (code, name, description, department_id, client_id, owner_id,
                               status, priority, complexity, category, start_date, due_date,
                               budget, planned_hours, created_by,
                               expected_return, return_period_months, financial_notes)
  values ('PRJ-002', 'Otimização da malha logística',
          'Redesenho das rotas de distribuição com foco em redução de custo.',
          v_dep_ope, v_client, v_user, 'planejamento', 'critica', 'muito_alta', 'Eficiência Operacional',
          current_date - 10, current_date + 90, 480000, 900, v_user,
          1350000, 36, 'Redução de 11% no custo de frete próprio, medida pelo painel de logística.')
  returning id into v_proj;

  insert into public.project_members (project_id, user_id, role_in_project) values (v_proj, v_user, 'gestor');

  insert into public.tasks (project_id, title, status, priority, assignee_id, start_date, due_date,
                            estimated_hours, progress, position, created_by)
  values
    (v_proj, 'Diagnóstico das rotas atuais', 'em_desenvolvimento', 'critica', v_user,
     current_date - 10, current_date + 10, 100, 35, 10, v_user),
    (v_proj, 'Simulação de cenários',        'backlog', 'alta', v_user,
     current_date + 11, current_date + 45, 160, 0, 10, v_user);

  insert into public.project_stages (project_id, name, description, progress_notes, status, owner_id,
                                     start_date, end_date, actual_start_date, actual_end_date,
                                     progress, weight, position, created_by)
  values
    (v_proj, 'Diagnóstico da malha', 'Coleta de dados de rotas, custos e ocupação da frota.',
     'Base de 18 meses consolidada; falta validar o custo por quilômetro com o financeiro.',
     'em_andamento', v_user, current_date - 10, current_date + 10, current_date - 10, null,
     35, 2, 1, v_user),
    (v_proj, 'Modelagem de cenários', 'Simulação das alternativas de roteirização.',
     null, 'nao_iniciada', v_user, current_date + 11, current_date + 45, null, null, 0, 3, 2, v_user),
    (v_proj, 'Piloto regional', 'Aplicação do novo desenho em uma regional.',
     null, 'nao_iniciada', v_user, current_date + 46, current_date + 75, null, null, 0, 2, 3, v_user),
    (v_proj, 'Rollout', 'Extensão do modelo para toda a malha.',
     null, 'nao_iniciada', v_user, current_date + 76, current_date + 90, null, null, 0, 1, 4, v_user);

  return 'Massa de demonstração criada com sucesso.';
end;
$$;

