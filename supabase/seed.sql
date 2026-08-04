-- =====================================================================
-- Seed — cadastros básicos do Grupo Moreno
-- Executar após aplicar as migrations: supabase db reset / supabase db push
-- =====================================================================

insert into public.departments (name, code, color) values
  ('Tecnologia da Informação', 'TI',       '#1B3F94'),
  ('Operações',               'OPE',      '#0E8F46'),
  ('Comercial',               'COM',      '#8CC63F'),
  ('Financeiro',              'FIN',      '#0F4C81'),
  ('Recursos Humanos',        'RH',       '#16A34A'),
  ('Marketing',               'MKT',      '#65A30D')
on conflict (code) do nothing;

insert into public.clients (name, code, contact_name, contact_email) values
  ('Interno — Grupo Moreno', 'GM-INT', 'Diretoria',        'diretoria@grupomoreno.com.br'),
  ('Moreno Distribuição',    'GM-DIS', 'Central de Contas', 'contas@grupomoreno.com.br'),
  ('Moreno Logística',       'GM-LOG', 'Coordenação',      'logistica@grupomoreno.com.br')
on conflict (code) do nothing;

insert into public.tags (name, color) values
  ('Estratégico',   '#1B3F94'),
  ('Inovação',      '#8CC63F'),
  ('Compliance',    '#0E8F46'),
  ('Redução de custo', '#F59E0B'),
  ('Cliente',       '#0EA5E9'),
  ('Infraestrutura', '#64748B')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Massa de demonstração — chamar logado como administrador:
--   select public.seed_demo_projects();
-- ---------------------------------------------------------------------
create or replace function public.seed_demo_projects()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_dep_ti uuid;
  v_dep_ope uuid;
  v_client uuid;
  v_proj uuid;
  v_task_a uuid;
  v_task_b uuid;
begin
  if v_user is null then
    return 'Nenhum usuário autenticado.';
  end if;

  select id into v_dep_ti  from public.departments where code = 'TI';
  select id into v_dep_ope from public.departments where code = 'OPE';
  select id into v_client  from public.clients where code = 'GM-INT';

  -- Projeto 1 -------------------------------------------------------
  insert into public.projects (code, name, description, department_id, client_id, owner_id,
                               status, priority, complexity, category, start_date, due_date,
                               budget, planned_hours, created_by,
                               expected_return, return_period_months, financial_notes)
  values ('PRJ-001', 'Portal Corporativo Grupo Moreno',
          'Unificação dos sistemas internos em um portal único com SSO.',
          v_dep_ti, v_client, v_user, 'em_desenvolvimento', 'alta', 'alta', 'Transformação Digital',
          current_date - 30, current_date + 45, 250000, 640, v_user,
          620000, 24, 'Economia de licenças duplicadas e horas de suporte no primeiro biênio.')
  on conflict (code) do nothing
  returning id into v_proj;

  if v_proj is null then
    return 'Massa de demonstração já existente.';
  end if;

  insert into public.project_members (project_id, user_id, role_in_project) values (v_proj, v_user, 'gestor');

  insert into public.tasks (project_id, title, status, priority, assignee_id, start_date, due_date,
                            estimated_hours, progress, position, created_by)
  values (v_proj, 'Levantamento de requisitos', 'concluido', 'alta', v_user,
          current_date - 30, current_date - 20, 40, 100, 10, v_user)
  returning id into v_task_a;

  insert into public.tasks (project_id, title, status, priority, assignee_id, start_date, due_date,
                            estimated_hours, progress, position, created_by)
  values (v_proj, 'Arquitetura e modelagem de dados', 'em_desenvolvimento', 'critica', v_user,
          current_date - 19, current_date + 5, 80, 60, 10, v_user)
  returning id into v_task_b;

  insert into public.task_dependencies (predecessor_id, successor_id, type) values (v_task_a, v_task_b, 'FS');

  insert into public.tasks (project_id, title, status, priority, start_date, due_date,
                            estimated_hours, position, created_by)
  values
    (v_proj, 'Implementação do SSO',        'planejamento', 'alta', current_date + 6,  current_date + 25, 120, 10, v_user),
    (v_proj, 'Homologação com key users',   'backlog',      'media', current_date + 26, current_date + 40, 60,  10, v_user);

  insert into public.milestones (project_id, name, due_date) values
    (v_proj, 'Go-live piloto', current_date + 30),
    (v_proj, 'Rollout completo', current_date + 45);

  insert into public.risks (project_id, title, probability, impact, mitigation, owner_id, created_by) values
    (v_proj, 'Indisponibilidade do time de infraestrutura', 3, 4,
     'Reservar janela dedicada e formalizar SLA interno.', v_user, v_user),
    (v_proj, 'Mudança de escopo pela diretoria', 4, 5,
     'Comitê quinzenal de mudanças com ata formal.', v_user, v_user);

  insert into public.checklist_items (project_id, title, position, created_by) values
    (v_proj, 'Termo de abertura assinado', 10, v_user),
    (v_proj, 'Ambiente de homologação provisionado', 20, v_user);

  insert into public.project_stages (project_id, name, description, progress_notes, status, owner_id,
                                     start_date, end_date, actual_start_date, actual_end_date,
                                     progress, weight, position, created_by)
  values
    (v_proj, 'Diagnóstico', 'Mapeamento dos sistemas legados e das integrações existentes.',
     'Concluída com 12 sistemas mapeados e 4 integrações críticas identificadas.',
     'concluida', v_user, current_date - 30, current_date - 18, current_date - 30, current_date - 19,
     100, 1, 1, v_user),
    (v_proj, 'Arquitetura', 'Definição do modelo de dados e do provedor de identidade.',
     'Modelo de dados aprovado; provedor de SSO em avaliação final com a segurança da informação.',
     'em_andamento', v_user, current_date - 17, current_date + 5, current_date - 17, null,
     60, 2, 2, v_user),
    (v_proj, 'Construção', 'Desenvolvimento do portal e das integrações.',
     null, 'nao_iniciada', v_user, current_date + 6, current_date + 32, null, null, 0, 3, 3, v_user),
    (v_proj, 'Homologação e go-live', 'Testes com key users, treinamento e virada.',
     null, 'nao_iniciada', v_user, current_date + 33, current_date + 45, null, null, 0, 1, 4, v_user);

  -- Projeto 2 -------------------------------------------------------
  insert into public.projects (code, name, description, department_id, client_id, owner_id,
                               status, priority, complexity, category, start_date, due_date,
                               budget, planned_hours, created_by,
                               expected_return, return_period_months, financial_notes)
  values ('PRJ-002', 'Otimização da malha logística',
          'Redesenho das rotas de distribuição com foco em redução de custo.',
          v_dep_ope, v_client, v_user, 'planejamento', 'critica', 'muito_alta', 'Eficiência Operacional',
          current_date - 10, current_date + 90, 480000, 900, v_user,
          1350000, 36, 'Redução de 11% no custo de frete próprio, medida pelo painel de logística.')
  returning id into v_proj;

  insert into public.project_members (project_id, user_id, role_in_project) values (v_proj, v_user, 'gestor');

  insert into public.tasks (project_id, title, status, priority, assignee_id, start_date, due_date,
                            estimated_hours, progress, position, created_by)
  values
    (v_proj, 'Diagnóstico das rotas atuais', 'em_desenvolvimento', 'critica', v_user,
     current_date - 10, current_date + 10, 100, 35, 10, v_user),
    (v_proj, 'Simulação de cenários',        'backlog', 'alta', v_user,
     current_date + 11, current_date + 45, 160, 0, 10, v_user);

  insert into public.project_stages (project_id, name, description, progress_notes, status, owner_id,
                                     start_date, end_date, actual_start_date, actual_end_date,
                                     progress, weight, position, created_by)
  values
    (v_proj, 'Diagnóstico da malha', 'Coleta de dados de rotas, custos e ocupação da frota.',
     'Base de 18 meses consolidada; falta validar o custo por quilômetro com o financeiro.',
     'em_andamento', v_user, current_date - 10, current_date + 10, current_date - 10, null,
     35, 2, 1, v_user),
    (v_proj, 'Modelagem de cenários', 'Simulação das alternativas de roteirização.',
     null, 'nao_iniciada', v_user, current_date + 11, current_date + 45, null, null, 0, 3, 2, v_user),
    (v_proj, 'Piloto regional', 'Aplicação do novo desenho em uma regional.',
     null, 'nao_iniciada', v_user, current_date + 46, current_date + 75, null, null, 0, 2, 3, v_user),
    (v_proj, 'Rollout', 'Extensão do modelo para toda a malha.',
     null, 'nao_iniciada', v_user, current_date + 76, current_date + 90, null, null, 0, 1, 4, v_user);

  return 'Massa de demonstração criada com sucesso.';
end;
$$;
