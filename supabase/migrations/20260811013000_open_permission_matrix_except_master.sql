drop policy if exists role_permissions_insert_admin on public.role_permissions;
create policy role_permissions_insert_admin
on public.role_permissions for insert to authenticated
with check (
  (private.has_role('master') or private.has_role('admin'))
  and not exists (
    select 1 from public.roles role
    where role.id = role_permissions.role_id and role.codigo = 'master'
  )
  and not (
    exists (
      select 1 from public.roles role
      where role.id = role_permissions.role_id and role.codigo in ('cliente', 'suporte', 'dev')
    )
    and exists (
      select 1 from public.permissions permission
      where permission.id = role_permissions.permission_id and permission.recurso = 'stack_requests'
    )
  )
);

drop policy if exists role_permissions_delete_admin on public.role_permissions;
create policy role_permissions_delete_admin
on public.role_permissions for delete to authenticated
using (
  (private.has_role('master') or private.has_role('admin'))
  and not exists (
    select 1 from public.roles role
    where role.id = role_permissions.role_id and role.codigo = 'master'
  )
);

create or replace function public.update_role_permission_matrix(change_set jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  change_item jsonb;
  target_role_id uuid;
  target_permission_id uuid;
  target_enabled boolean;
  target_role_code text;
  target_permission_resource text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;
  if not private.has_role('master') and not private.has_role('admin') then
    raise exception 'Apenas Admin ou Master pode editar permissões.' using errcode = '42501';
  end if;
  if change_set is null or jsonb_typeof(change_set) <> 'array' then
    raise exception 'Lista de alterações inválida.' using errcode = '22023';
  end if;

  for change_item in select value from jsonb_array_elements(change_set)
  loop
    target_role_id := (change_item ->> 'roleId')::uuid;
    target_permission_id := (change_item ->> 'permissionId')::uuid;
    target_enabled := (change_item ->> 'enabled')::boolean;

    select codigo into target_role_code from public.roles where id = target_role_id and ativo;
    select recurso into target_permission_resource from public.permissions where id = target_permission_id and ativo;
    if target_role_code is null or target_permission_resource is null then
      raise exception 'Papel ou permissão inválida/inativa.' using errcode = '22023';
    end if;
    if target_role_code = 'master' then
      raise exception 'As permissões do perfil Master são protegidas.' using errcode = '42501';
    end if;
    if target_enabled and target_role_code in ('cliente', 'suporte', 'dev') and target_permission_resource = 'stack_requests' then
      raise exception 'Cliente, Suporte e Dev não podem acessar Solicitações de Stack.' using errcode = '42501';
    end if;

    if target_enabled then
      insert into public.role_permissions (role_id, permission_id)
      values (target_role_id, target_permission_id)
      on conflict (role_id, permission_id) do nothing;
    else
      delete from public.role_permissions
      where role_id = target_role_id and permission_id = target_permission_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.update_role_permission_matrix(jsonb) from public, anon;
grant execute on function public.update_role_permission_matrix(jsonb) to authenticated;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role cross join public.permissions permission
where role.codigo = 'master' and role.ativo and permission.ativo
on conflict (role_id, permission_id) do nothing;
