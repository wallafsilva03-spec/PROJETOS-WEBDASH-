-- =====================================================================
-- Fase 5 · Migration 18 — Subtarefa fecha a tarefa mãe
-- =====================================================================
--
-- Com a lista de tarefas no formato do Monday, a subtarefa passou a ser onde
-- o trabalho realmente acontece: é ela que tem prazo e é ela que a pessoa
-- marca como feita. A tarefa mãe virava um resumo que ninguém lembrava de
-- atualizar — ficava "em desenvolvimento" com todas as subtarefas fechadas.
--
-- A regra fica no banco, e não na tela: a mesma tarefa é marcada pela lista,
-- pelo card do Kanban, pelo diálogo e pelo `move_task`. Espalhar isso em
-- quatro lugares do front garantiria que um deles ficasse para trás.
--
-- O que passa a valer:
--   * todas as subtarefas concluídas  -> a mãe é concluída junto;
--   * reabriu uma subtarefa           -> a mãe volta para "em desenvolvimento";
--   * nos demais casos                -> o progresso da mãe é a média das filhas.
--
-- Tarefa sem subtarefa nenhuma não é tocada: continua sendo preenchida à mão.
-- =====================================================================

create or replace function public.rollup_subtasks(p_parent_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent   record;
  v_total    integer;
  v_done     integer;
  v_progress numeric(5, 2);
begin
  if p_parent_id is null then
    return;
  end if;

  select * into v_parent from public.tasks where id = p_parent_id;
  if not found then
    return;
  end if;

  select count(*),
         count(*) filter (where status = 'concluido'),
         coalesce(round(avg(progress), 2), 0)
    into v_total, v_done, v_progress
    from public.tasks
   where parent_task_id = p_parent_id;

  -- Sem filhas não há o que resumir; a mãe volta a ser uma tarefa comum.
  if v_total = 0 then
    return;
  end if;

  if v_done = v_total then
    if v_parent.status is distinct from 'concluido' then
      update public.tasks set status = 'concluido' where id = p_parent_id;
    end if;
    return;
  end if;

  -- Ainda falta subtarefa: a mãe não pode continuar fechada.
  if v_parent.status = 'concluido' then
    update public.tasks
       set status = 'em_desenvolvimento',
           progress = v_progress
     where id = p_parent_id;
    return;
  end if;

  if v_parent.progress is distinct from v_progress then
    update public.tasks set progress = v_progress where id = p_parent_id;
  end if;
end;
$$;

comment on function public.rollup_subtasks(uuid) is
  'Refaz status e progresso de uma tarefa a partir das suas subtarefas. '
  'Tarefa sem subtarefas não é alterada.';

-- ---------------------------------------------------------------------
-- Gatilho
--
-- Só dispara para linha que É subtarefa, e reavalia também a mãe antiga
-- quando a subtarefa muda de mãe — do contrário a antiga ficaria com um
-- resumo de algo que não é mais dela.
--
-- A recursão termina sozinha: a mãe atualizada aqui só reavalia a avó, e a
-- avó só é tocada se a mãe for ela mesma uma subtarefa.
-- ---------------------------------------------------------------------
create or replace function public.tg_subtask_rollup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Cinto de segurança contra hierarquia circular criada à mão no banco.
  if pg_trigger_depth() > 10 then
    return coalesce(new, old);
  end if;

  -- A mãe antiga só é reavaliada quando deixou de ser mãe desta subtarefa.
  if tg_op <> 'INSERT' and old.parent_task_id is not null
     and (tg_op = 'DELETE' or new.parent_task_id is distinct from old.parent_task_id) then
    perform public.rollup_subtasks(old.parent_task_id);
  end if;

  if tg_op <> 'DELETE' and new.parent_task_id is not null then
    perform public.rollup_subtasks(new.parent_task_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists task_subtask_rollup on public.tasks;
create trigger task_subtask_rollup
  after insert or update or delete on public.tasks
  for each row execute function public.tg_subtask_rollup();

-- ---------------------------------------------------------------------
-- Alinha o que já está gravado: mães cujas filhas já estão todas fechadas.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select distinct parent_task_id from public.tasks where parent_task_id is not null loop
    perform public.rollup_subtasks(r.parent_task_id);
  end loop;
end $$;
