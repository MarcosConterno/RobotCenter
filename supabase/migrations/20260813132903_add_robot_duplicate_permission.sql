insert into public.permissions (codigo, recurso, acao, descricao, ativo)
values ('robots.duplicate', 'robots', 'duplicate', 'Criar uma cópia de um robô.', true)
on conflict (codigo) do update
set recurso = excluded.recurso,
    acao = excluded.acao,
    descricao = excluded.descricao,
    ativo = true;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
cross join public.permissions as permission
where role.codigo in ('admin', 'master')
  and role.ativo
  and permission.codigo = 'robots.duplicate'
  and permission.ativo
on conflict (role_id, permission_id) do nothing;

create or replace function private.protect_robot_duplicate_permission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null and exists (
    select 1
    from public.permissions as permission
    where permission.id = case when tg_op = 'DELETE' then old.permission_id else new.permission_id end
      and permission.codigo = 'robots.duplicate'
  ) then
    raise exception 'A permissão de duplicar robôs é exclusiva e protegida para Admin e Master.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_robot_duplicate_permission() from public, anon, authenticated;

drop trigger if exists role_permissions_protect_robot_duplicate on public.role_permissions;
create trigger role_permissions_protect_robot_duplicate
before insert or delete on public.role_permissions
for each row execute function private.protect_robot_duplicate_permission();
