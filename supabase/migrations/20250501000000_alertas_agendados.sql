-- =====================================================================
-- Fase 5 · Migration 12 — Alertas de prazo no automático
-- =====================================================================
--
-- `generate_deadline_alerts()` existe desde a migration 03 e faz o trabalho
-- todo: cria as notificações de prazo hoje, prazo amanhã e projeto atrasado,
-- sem repetir o que já mandou no mesmo dia. Só que nada nunca a chamava — a
-- função ficava parada, e por isso o sino só acendia com comentário, menção e
-- atribuição de tarefa.
--
-- Aqui ela ganha horário. Nenhuma tabela é criada, alterada ou apagada: o que
-- entra é uma linha na agenda do pg_cron.
--
-- 11:00 UTC = 08:00 em Brasília. O banco do Supabase roda em UTC, então o
-- horário é escrito em UTC de propósito — se a conversão fosse feita "na
-- cabeça" o alerta chegaria três horas fora.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A extensão pode não estar liberada no projeto. Não é motivo para o
-- setup.sql inteiro parar: o resto do banco não depende disto.
-- ---------------------------------------------------------------------
do $mig$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice
    'pg_cron indisponível (%). Habilite em Database → Extensions, ou chame '
    'select public.generate_deadline_alerts(); por outro agendador.', sqlerrm;
end $mig$;

do $mig$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'Sem pg_cron: os alertas de prazo seguem dependendo de chamada manual.';
    return;
  end if;

  -- Reexecutar o setup.sql não pode duplicar a agenda.
  if exists (select 1 from cron.job where jobname = 'webdash-alertas-diarios') then
    perform cron.unschedule('webdash-alertas-diarios');
  end if;

  perform cron.schedule(
    'webdash-alertas-diarios',
    '0 11 * * *',
    'select public.generate_deadline_alerts();'
  );

  raise notice 'Alertas de prazo agendados para 11:00 UTC (08:00 de Brasília).';
exception when others then
  raise notice 'Não foi possível agendar os alertas (%).', sqlerrm;
end $mig$;
