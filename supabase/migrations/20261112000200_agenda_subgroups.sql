alter table public.subgroup_demands
  add column project_id uuid references public.projects(id) on delete set null;

create unique index subgroup_demands_project_demand_idx
  on public.subgroup_demands (project_id,lower(btrim(demand))) where project_id is not null;

create sequence public.subgroup_demands_position_seq as integer;
alter sequence public.subgroup_demands_position_seq owned by public.subgroup_demands.position;
select setval('public.subgroup_demands_position_seq',
  coalesce((select max(position) from public.subgroup_demands),0)+1,false);
alter table public.subgroup_demands alter column position
  set default nextval('public.subgroup_demands_position_seq');

create function public.agenda_web_catalog(
  member_email text,
  parent_project uuid default null,
  subgroup_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  member_profile public.profiles%rowtype;
  manager boolean;
  parent public.projects%rowtype;
  created public.subgroup_demands%rowtype;
begin
  select * into member_profile from public.profiles
  where lower(email)=lower(member_email) and is_active;
  if not found then
    raise exception 'Sua conta precisa estar ativa no Projetos Web para vincular compromissos.' using errcode='42501';
  end if;
  manager := member_profile.role::text in ('administrador','analista');

  if subgroup_name is not null then
    if length(btrim(subgroup_name)) not between 1 and 160 then
      raise exception 'Informe um nome de subgrupo de até 160 caracteres.' using errcode='22023';
    end if;
    select p.* into parent from public.projects p
    where p.id=parent_project and not p.is_archived and (
      manager or p.owner_id=member_profile.id or
      (member_profile.role::text='lider' and exists (
        select 1 from public.project_members pm where pm.project_id=p.id and pm.user_id=member_profile.id
      ))
    ) for key share;
    if not found then
      raise exception 'Você precisa ter permissão para gerenciar esse projeto.' using errcode='42501';
    end if;
    insert into public.subgroup_demands(project_id,committee,demand,status)
      values (parent.id,parent.code||' · '||parent.name,btrim(subgroup_name),'Não iniciado')
      on conflict (project_id,lower(btrim(demand))) where project_id is not null do nothing
      returning * into created;
    if not found then
      select d.* into created from public.subgroup_demands d
        where d.project_id=parent.id and lower(btrim(d.demand))=lower(btrim(subgroup_name));
    end if;
    return jsonb_build_object('id',created.position,'name',created.demand,'projectId',created.project_id);
  end if;

  return (
    with visible_projects as (
      select p.id,p.name,p.code,
        manager or coalesce(p.owner_id=member_profile.id,false)
          or (member_profile.role::text='lider' and pm.user_id is not null) as editable
      from public.projects p left join public.project_members pm
        on pm.project_id=p.id and pm.user_id=member_profile.id
      where not p.is_archived and (manager or p.owner_id=member_profile.id or
        p.created_by=member_profile.id or pm.user_id is not null)
    )
    select jsonb_build_object(
      'projects',coalesce((select jsonb_agg(jsonb_build_object(
        'id',p.id,'name',p.name,'code',p.code,'canCreate',p.editable) order by p.name,p.id)
        from visible_projects p),'[]'::jsonb),
      'subgroups',coalesce((select jsonb_agg(jsonb_build_object(
        'id',d.position,'name',d.demand,'committee',d.committee,'projectId',d.project_id)
        order by d.committee,d.demand,d.position)
        from public.subgroup_demands d left join visible_projects p on p.id=d.project_id
        where p.id is not null or (manager and d.project_id is null)),'[]'::jsonb)
    )
  );
end
$function$;

revoke all on function public.agenda_web_catalog(text,uuid,text) from public,anon,authenticated;
grant execute on function public.agenda_web_catalog(text,uuid,text) to service_role;
