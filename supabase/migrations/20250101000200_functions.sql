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

-- Administrador e Gerente enxergam o portfólio inteiro.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('administrador', 'gerente') from public.profiles p where p.id = auth.uid()),
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
