create table public.subgroup_demands (
  position integer primary key check (position > 0),
  committee text not null,
  demand text not null,
  status text not null,
  observation text not null default '',
  unique (committee, demand)
);

alter table public.subgroup_demands enable row level security;

revoke all on table public.subgroup_demands from public, anon, authenticated;
grant select on table public.subgroup_demands to authenticated;

create policy subgroup_demands_select on public.subgroup_demands
  for select to authenticated
  using ((select public.is_manager()));
