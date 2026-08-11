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
