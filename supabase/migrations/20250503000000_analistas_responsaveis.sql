-- =====================================================================
-- Fase 5 · Migration 14 — Mais de um analista respondendo pelo projeto
-- =====================================================================
--
-- O projeto tinha um "dono no sistema" só: `projects.owner_id`. Agora a tela
-- deixa marcar vários analistas responsáveis, e todos precisam poder editar o
-- projeto — senão o campo vira enfeite.
--
-- O primeiro escolhido continua em `owner_id`, porque é dele que as views
-- tiram `owner_name` e é ele o registro histórico de quem responde primeiro.
-- Os demais entram em `project_members` com `role_in_project = 'gestor'`, que
-- já era o papel gravado para o dono desde o começo.
--
-- Falta a permissão acompanhar: `can_manage_project()` olhava o papel da
-- pessoa no **perfil** (`profiles.role = 'lider'`), e não o papel dela **no
-- projeto**. Quem fosse marcado como gestor de um projeto sem ser líder da
-- casa continuava sem poder editar.
--
-- Nada é removido: a condição nova entra somando às que já existiam.
-- =====================================================================

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_manager()
      -- Primeiro analista responsável (o antigo "dono no sistema").
      or exists (
           select 1 from public.projects pr
            where pr.id = p_project_id and pr.owner_id = auth.uid()
         )
      -- Demais analistas responsáveis, marcados como gestores do projeto.
      or exists (
           select 1 from public.project_members m
            where m.project_id = p_project_id
              and m.user_id = auth.uid()
              and m.role_in_project = 'gestor'
         )
      -- Líder da casa que participa do projeto — regra original, mantida.
      or exists (
           select 1
             from public.project_members m
             join public.profiles p on p.id = m.user_id
            where m.project_id = p_project_id
              and m.user_id = auth.uid()
              and p.role = 'lider'
         );
$$;
