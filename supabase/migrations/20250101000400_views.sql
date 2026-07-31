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
