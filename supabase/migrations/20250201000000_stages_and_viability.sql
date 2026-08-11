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
