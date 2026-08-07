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

alter table public.responsibles enable row level security;

drop policy if exists responsibles_select on public.responsibles;
create policy responsibles_select on public.responsibles
  for select to authenticated using (true);

-- Qualquer pessoa cadastra uma opção nova ao preencher um projeto.
drop policy if exists responsibles_insert on public.responsibles;
create policy responsibles_insert on public.responsibles
  for insert to authenticated with check (true);

-- Apagar é de quem criou — ou da gestão, para limpar o catálogo.
drop policy if exists responsibles_delete on public.responsibles;
create policy responsibles_delete on public.responsibles
  for delete to authenticated using (public.is_manager() or created_by = auth.uid());

drop policy if exists responsibles_update on public.responsibles;
create policy responsibles_update on public.responsibles
  for update to authenticated
  using (public.is_manager() or created_by = auth.uid())
  with check (true);

grant select, insert, update, delete on public.responsibles to authenticated;

-- ---------------------------------------------------------------------
-- DEPARTAMENTOS — também podem nascer do formulário
--
-- A policy antiga (`departments_write`) continua valendo para a gestão. As
-- duas abaixo se somam a ela: no Postgres, políticas permissivas são unidas
-- por OU.
-- ---------------------------------------------------------------------
alter table public.departments
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

drop policy if exists departments_insert_any on public.departments;
create policy departments_insert_any on public.departments
  for insert to authenticated with check (true);

drop policy if exists departments_delete_own on public.departments;
create policy departments_delete_own on public.departments
  for delete to authenticated using (public.is_manager() or created_by = auth.uid());

-- Um projeto que usava o departamento apagado fica sem departamento
-- (a foreign key já era `on delete set null`), sem perder nada além disso.
