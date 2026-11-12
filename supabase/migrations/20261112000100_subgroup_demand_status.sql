alter table public.subgroup_demands
  add constraint subgroup_demands_valid_status
  check (status in (
    'Não iniciado',
    'Em andamento',
    'Em validação/ajuste',
    'Pausado',
    'Concluído',
    'Cancelado'
  ));

grant update (status) on public.subgroup_demands to authenticated;

create policy subgroup_demands_update_status on public.subgroup_demands
  for update to authenticated
  using ((select public.is_manager()))
  with check ((select public.is_manager()));
