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
-- A coluna precisa chegar às telas. `create or replace view` só aceita
-- coluna nova no fim, e a `v_project_360` expande `v.*` — daí a recriação
-- das duas, junto com a `v_exec_financials`, que depende da 360.
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
  end                                                               as efficiency,
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
  select
    count(*) filter (where r.status <> 'encerrado')            as open_risks,
    coalesce(max(r.probability * r.impact), 0)                 as max_severity
  from public.risks r where r.project_id = p.id
) rk on true
left join lateral (
  select
    count(*)                                  as milestones_total,
    count(*) filter (where ms2.is_done)       as milestones_done
  from public.milestones ms2 where ms2.project_id = p.id
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
