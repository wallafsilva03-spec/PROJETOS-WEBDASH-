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
