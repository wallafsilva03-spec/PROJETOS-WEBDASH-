-- =====================================================================
-- Fase 5 · Migration 17 — Campos de governança e área do projeto
-- =====================================================================
--
-- O que a Diretoria pergunta numa reunião e o sistema ainda não respondia:
-- se a ação foi aprovada, se entrou no Redmine, quando a aderência será
-- medida, se vai para a Melhoria Contínua — e a que área ela pertence.
--
-- Cinco colunas novas em `projects`. Nada existente é alterado ou removido, e
-- todas nascem com um padrão que não muda o significado do que já está
-- gravado: aprovação e melhoria contínua entram como "em avaliação", Redmine
-- como "não lançado" e a área como nula, à espera do cadastro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos. Enum, e não texto livre, porque estes campos viram gráfico: um
-- "Sim" e um "sim" na mesma coluna dariam duas fatias diferentes.
-- ---------------------------------------------------------------------
do $$ begin
  create type public.approval_status as enum ('sim', 'nao', 'em_aprovacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.improvement_status as enum ('sim', 'nao', 'em_avaliacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_area as enum ('agricola', 'administrativo', 'industrial');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Colunas
-- ---------------------------------------------------------------------
alter table public.projects
  add column if not exists area public.project_area,
  add column if not exists diretoria_aprovacao public.approval_status not null default 'em_aprovacao',
  add column if not exists redmine_lancado boolean not null default false,
  add column if not exists aderencia_prazo date,
  add column if not exists melhoria_continua public.improvement_status not null default 'em_avaliacao';

comment on column public.projects.area is
  'Área da Diretoria: agrícola, administrativo ou industrial. Nula enquanto não classificada.';
comment on column public.projects.diretoria_aprovacao is
  'Aprovação da Diretoria: sim, não ou em aprovação.';
comment on column public.projects.redmine_lancado is
  'Se o projeto/ação já foi lançado no Redmine.';
comment on column public.projects.aderencia_prazo is
  'Data prevista para medir a aderência depois da implantação. Nula enquanto não definida.';
comment on column public.projects.melhoria_continua is
  'Se o projeto/ação entra na Melhoria Contínua: sim, não ou em avaliação.';

-- A leitura gerencial é sempre "por área e por situação".
create index if not exists idx_projects_area on public.projects (area, status);

-- ---------------------------------------------------------------------
-- As colunas precisam chegar às telas pela `v_project_360`, e nunca pela
-- `v_project_overview`: a migration 05 refaz a overview a cada execução do
-- setup.sql com `create or replace`, que recusa perder coluna, e qualquer
-- coluna nova ali faria a segunda execução parar em "cannot drop columns
-- from view". A 360 é derrubada e recriada, então aceita coluna nova.
-- ---------------------------------------------------------------------
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
  p.prazo_a_definir,
  p.area,
  p.diretoria_aprovacao,
  p.redmine_lancado,
  p.aderencia_prazo,
  p.melhoria_continua
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
