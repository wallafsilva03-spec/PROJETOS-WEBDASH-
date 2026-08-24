-- =====================================================================
-- Fase 5 · Migration 17 — Governança da Diretoria
-- =====================================================================
--
-- O portfólio deixou de ser só operacional: a Diretoria acompanha o mesmo
-- cadastro e precisa responder, em uma tela, o que já foi aprovado, o que já
-- foi formalizado no Redmine, quando a aderência será medida e o que vai
-- virar Melhoria Contínua. Cada uma dessas perguntas vira uma coluna do
-- projeto — nada aqui altera regra de negócio existente.
--
-- A área (Agrícola, ADM, Industrial) é diferente do departamento: o
-- departamento é o setor que executa; a área é o macro-bloco do negócio a
-- que o projeto pertence, e é por ela que a visão gerencial compara a
-- evolução do portfólio. Por isso é coluna nova, e não um departamento.
-- =====================================================================

do $$ begin
  create type public.project_area as enum ('agricola', 'adm', 'industrial');
exception when duplicate_object then null; end $$;

-- Sim / Não / Em aprovação — o "em aprovação" é o estado de quem já foi
-- submetido à Diretoria e ainda não teve resposta.
do $$ begin
  create type public.approval_status as enum ('sim', 'nao', 'em_aprovacao');
exception when duplicate_object then null; end $$;

-- Sim / Não / Em avaliação — mesma ideia, para a Melhoria Contínua.
do $$ begin
  create type public.improvement_status as enum ('sim', 'nao', 'em_avaliacao');
exception when duplicate_object then null; end $$;

alter table public.projects
  add column if not exists area public.project_area,
  add column if not exists aprovado_diretoria public.approval_status not null default 'em_aprovacao',
  add column if not exists lancado_redmine boolean not null default false,
  add column if not exists data_medicao_aderencia date,
  add column if not exists melhoria_continua public.improvement_status not null default 'em_avaliacao';

comment on column public.projects.area is
  'Macro-área do negócio a que o projeto pertence: agricola, adm ou industrial. '
  'Nulo = ainda não classificado. Não substitui o departamento executor.';
comment on column public.projects.aprovado_diretoria is
  'Situação da aprovação pela Diretoria: sim, nao ou em_aprovacao.';
comment on column public.projects.lancado_redmine is
  'Verdadeiro quando o projeto/ação já foi formalmente lançado no Redmine.';
comment on column public.projects.data_medicao_aderencia is
  'Data prevista para a medição de aderência após a implantação da ação. '
  'Nulo = medição ainda não programada.';
comment on column public.projects.melhoria_continua is
  'Se o projeto será incorporado à Melhoria Contínua: sim, nao ou em_avaliacao.';

-- Ordenar por prazo de medição e listar o que está próximo do vencimento é a
-- leitura mais frequente da coluna nova — daí o índice parcial.
create index if not exists idx_projects_medicao_aderencia
  on public.projects (data_medicao_aderencia)
  where data_medicao_aderencia is not null;

create index if not exists idx_projects_area on public.projects (area);

-- ---------------------------------------------------------------------
-- As colunas chegam à tela pela `v_project_360`, nunca pela
-- `v_project_overview` — a migration 05 refaz a overview a cada execução do
-- setup.sql com `create or replace`, que recusa perder coluna, e qualquer
-- coluna nova ali faria a segunda execução parar em "cannot drop columns
-- from view". Mesma razão explicada na migration 16.
--
-- `dias_para_medicao` é derivado aqui, no banco, para a tela poder ordenar e
-- destacar medições próximas do vencimento sem recalcular data em cada
-- componente. Nulo quando não há medição programada.
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
  p.aprovado_diretoria,
  p.lancado_redmine,
  p.data_medicao_aderencia,
  p.melhoria_continua,
  case
    when p.data_medicao_aderencia is null then null
    else (p.data_medicao_aderencia - current_date)
  end                                                               as dias_para_medicao
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
-- Visão gerencial por área × status — a mesma contagem que a tela mostra,
-- disponível também para quem consultar o banco direto.
--
-- O status gerencial agrupa os oito status operacionais nos cinco que a
-- Diretoria acompanha; a tela usa exatamente a mesma regra.
-- ---------------------------------------------------------------------
create or replace function public.status_gerencial(p_status public.project_status)
returns text
language sql
immutable
as $$
  select case p_status
    when 'concluido'          then 'concluido'
    when 'cancelado'          then 'cancelado'
    when 'pausado'            then 'paralisado'
    when 'nao_iniciado'       then 'nao_iniciado'
    when 'backlog'            then 'nao_iniciado'
    else 'em_andamento'
  end;
$$;

create or replace view public.v_portfolio_areas
with (security_invoker = on) as
select
  coalesce(v.area::text, 'nao_definida')          as area,
  count(*)                                        as total,
  count(*) filter (where public.status_gerencial(v.status) = 'concluido')    as concluidos,
  count(*) filter (where public.status_gerencial(v.status) = 'em_andamento') as em_andamento,
  count(*) filter (where public.status_gerencial(v.status) = 'paralisado')   as paralisados,
  count(*) filter (where public.status_gerencial(v.status) = 'nao_iniciado') as nao_iniciados,
  count(*) filter (where public.status_gerencial(v.status) = 'cancelado')    as cancelados,
  count(*) filter (where v.aprovado_diretoria = 'sim')                       as aprovados_diretoria,
  count(*) filter (where v.lancado_redmine)                                  as lancados_redmine,
  count(*) filter (where v.melhoria_continua = 'sim')                        as melhoria_continua
from public.v_project_360 v
where v.is_archived = false
group by 1;

grant select on public.v_portfolio_areas to authenticated;
