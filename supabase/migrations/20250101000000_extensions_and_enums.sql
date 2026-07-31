-- =====================================================================
-- WEBDASH · Gestão de Projetos Corporativos — Grupo Moreno
-- Fase 1 · Migration 01 — Extensões e tipos enumerados
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------
-- Perfis de acesso da plataforma
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('administrador', 'gerente', 'lider', 'colaborador');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Colunas do Kanban / status de projeto e tarefa
-- ---------------------------------------------------------------------
do $$ begin
  create type public.project_status as enum (
    'backlog', 'planejamento', 'em_desenvolvimento', 'homologacao', 'concluido', 'cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum (
    'backlog', 'planejamento', 'em_desenvolvimento', 'homologacao', 'concluido'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.priority_level as enum ('baixa', 'media', 'alta', 'critica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.complexity_level as enum ('baixa', 'media', 'alta', 'muito_alta');
exception when duplicate_object then null; end $$;

-- Saúde calculada automaticamente pela inteligência do projeto
do $$ begin
  create type public.health_status as enum ('adiantado', 'no_prazo', 'em_risco', 'atrasado', 'critico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dependency_type as enum ('FS', 'SS', 'FF', 'SF');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.risk_status as enum ('identificado', 'em_mitigacao', 'mitigado', 'aceito', 'materializado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.milestone_status as enum ('pendente', 'em_andamento', 'concluido', 'atrasado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'comentario', 'mencao', 'tarefa_atribuida', 'tarefa_status', 'prazo_hoje',
    'prazo_amanha', 'projeto_atrasado', 'projeto_risco', 'checklist', 'arquivo', 'sistema'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_action as enum ('INSERT', 'UPDATE', 'DELETE');
exception when duplicate_object then null; end $$;
