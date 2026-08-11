alter table public.profiles
  add column if not exists pode_editar_robos_cliente boolean not null default false;

comment on column public.profiles.pode_editar_robos_cliente is
  'Autoriza um usuário com papel Cliente a editar somente robôs do profiles.cliente_id. Não autoriza criação, arquivamento, transferência, catálogos ou documentação.';

create or replace function private.can_update_robot(target_cliente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_active_user())
    and (select private.can_access_cliente(target_cliente_id))
    and (
      (
        (select private.has_permission('robots.update'))
        and (
          not (select private.has_role('cliente'))
          or (select private.has_role('admin'))
          or (select private.has_role('master'))
        )
      )
      or exists (
        select 1
        from public.profiles as profile
        join public.user_roles as user_role on user_role.user_id = profile.id
        join public.roles as role on role.id = user_role.role_id
        where profile.id = (select auth.uid())
          and profile.cliente_id = target_cliente_id
          and profile.pode_editar_robos_cliente
          and profile.ativo
          and profile.deleted_at is null
          and role.codigo = 'cliente'
          and role.ativo
      )
    );
$$;

revoke all on function private.can_update_robot(uuid) from public, anon;
grant execute on function private.can_update_robot(uuid) to authenticated;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
cross join public.permissions as permission
where role.codigo = 'cliente'
  and role.ativo
  and permission.codigo = 'robot_catalog.read'
  and permission.ativo
on conflict (role_id, permission_id) do nothing;

drop policy if exists robos_update_staff on public.robos;
create policy robos_update_staff
on public.robos for update
to authenticated
using (
  deleted_at is null
  and (select private.can_update_robot(cliente_id))
)
with check (
  deleted_at is null
  and (select private.can_update_robot(cliente_id))
);

drop policy if exists publicacoes_insert_staff on public.publicacoes;
create policy publicacoes_insert_staff
on public.publicacoes for insert
to authenticated
with check (
  exists (
    select 1
    from public.robos as robot
    where robot.id = publicacoes.robo_id
      and robot.deleted_at is null
      and (
        (select private.has_permission('publications.create'))
        or (select private.can_update_robot(robot.cliente_id))
      )
  )
);

create or replace function private.protect_client_robot_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select private.has_role('cliente'))
     and not (select private.has_role('admin'))
     and not (select private.has_role('master')) then
    if new.id is distinct from old.id
       or new.cliente_id is distinct from old.cliente_id
       or new.product_type is distinct from old.product_type
       or new.deleted_at is distinct from old.deleted_at
       or new.deleted_by is distinct from old.deleted_by
       or new.created_at is distinct from old.created_at
       or new.created_by is distinct from old.created_by
       or new.manual_path is distinct from old.manual_path
       or new.manual_nome is distinct from old.manual_nome
       or new.version_checked_at is distinct from old.version_checked_at
       or new.cliente_cor is distinct from old.cliente_cor
       or new.pacote_cor is distinct from old.pacote_cor then
      raise exception 'Usuário Cliente não pode transferir, arquivar ou alterar campos administrativos do robô.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_client_robot_update() from public, anon, authenticated;

drop trigger if exists robos_protect_client_update on public.robos;
create trigger robos_protect_client_update
before update on public.robos
for each row execute function private.protect_client_robot_update();
