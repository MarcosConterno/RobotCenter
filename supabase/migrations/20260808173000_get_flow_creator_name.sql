create or replace function private.get_flow_creator_name(target_flow_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.login
  from public.flows as f
  join public.profiles as p on p.id = f.created_by
  where f.id = target_flow_id
    and p.deleted_at is null
    and (select auth.uid()) is not null
    and (select private.has_permission('flows.read'))
    and (select private.can_access_cliente(f.client_id));
$$;

revoke all on function private.get_flow_creator_name(uuid) from public, anon;
grant execute on function private.get_flow_creator_name(uuid) to authenticated;

create or replace function public.get_flow_creator_name(target_flow_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_flow_creator_name(target_flow_id);
$$;

revoke all on function public.get_flow_creator_name(uuid) from public, anon;
grant execute on function public.get_flow_creator_name(uuid) to authenticated;
