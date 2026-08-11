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
