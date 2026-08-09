drop policy if exists role_permissions_insert_admin on public.role_permissions;
create policy role_permissions_insert_admin
on public.role_permissions for insert to authenticated
with check (
  (select private.has_role('master'))
  or (
    (select private.has_permission('users.manage'))
    and not exists (
      select 1 from public.roles as role
      where role.id = role_permissions.role_id
        and role.codigo in ('master', 'admin')
    )
    and not exists (
      select 1 from public.permissions as permission
      where permission.id = role_permissions.permission_id
        and permission.recurso = 'access_control'
    )
  )
);

drop policy if exists role_permissions_delete_admin on public.role_permissions;
create policy role_permissions_delete_admin
on public.role_permissions for delete to authenticated
using (
  (select private.has_role('master'))
  or (
    (select private.has_permission('users.manage'))
    and not exists (
      select 1 from public.roles as role
      where role.id = role_permissions.role_id
        and role.codigo in ('master', 'admin')
    )
    and not exists (
      select 1 from public.permissions as permission
      where permission.id = role_permissions.permission_id
        and permission.recurso = 'access_control'
    )
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
  current_is_master boolean := private.has_role('master');
  current_is_admin boolean := private.has_role('admin');
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  if not current_is_master and not current_is_admin then
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

    select role.codigo
      into target_role_code
      from public.roles as role
     where role.id = target_role_id
       and role.ativo;

    select permission.recurso
      into target_permission_resource
      from public.permissions as permission
     where permission.id = target_permission_id
       and permission.ativo;

    if target_role_code is null or target_permission_resource is null then
      raise exception 'Papel ou permissão inválida/inativa.' using errcode = '22023';
    end if;

    if not current_is_master
      and (target_role_code in ('master', 'admin') or target_permission_resource = 'access_control') then
      raise exception 'Esta liberação é exclusiva do usuário Master.' using errcode = '42501';
    end if;

    if target_enabled then
      insert into public.role_permissions (role_id, permission_id)
      values (target_role_id, target_permission_id)
      on conflict (role_id, permission_id) do nothing;
    else
      delete from public.role_permissions
       where role_id = target_role_id
         and permission_id = target_permission_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.update_role_permission_matrix(jsonb)
  from public, anon;
grant execute on function public.update_role_permission_matrix(jsonb)
  to authenticated;
