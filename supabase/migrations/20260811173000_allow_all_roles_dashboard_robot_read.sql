-- Garante que todos os papéis ativos possam consultar a Dashboard e os produtos
-- de Robôs, preservando o isolamento de usuários Cliente pelo cliente vinculado.

begin;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
join public.permissions as permission
  on permission.codigo in (
    'dashboard.read',
    'robots.read',
    'clients.read',
    'robots.product.integrador.read',
    'robots.product.consulta_processual.read',
    'robots.product.peticionamento.read',
    'robots.product.movimento.read'
  )
where role.ativo
  and permission.ativo
on conflict (role_id, permission_id) do nothing;

create or replace function private.can_access_cliente(target_cliente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      private.has_role('master')
      or private.has_role('admin')
      or private.has_role('head_setor')
      or private.has_role('operador')
      or private.has_role('dev')
      or private.has_role('suporte')
      or (
        private.has_role('cliente')
        and target_cliente_id is not null
        and exists (
          select 1
          from public.profiles as profile
          where profile.id = (select auth.uid())
            and profile.cliente_id = target_cliente_id
            and profile.ativo
            and profile.deleted_at is null
        )
      )
    );
$$;

revoke all on function private.can_access_cliente(uuid) from public, anon;
grant execute on function private.can_access_cliente(uuid) to authenticated;

drop policy if exists clientes_select on public.clientes;
create policy clientes_select
on public.clientes for select
to authenticated
using (
  deleted_at is null
  and (select private.has_permission('clients.read'))
  and (
    (select private.has_role('master'))
    or (select private.has_role('admin'))
    or (select private.has_role('head_setor'))
    or (select private.has_role('operador'))
    or (select private.has_role('dev'))
    or (select private.has_role('suporte'))
    or (
      (select private.has_role('cliente'))
      and id = (
        select profile.cliente_id
        from public.profiles as profile
        where profile.id = (select auth.uid())
          and profile.ativo
          and profile.deleted_at is null
      )
    )
  )
);

comment on function private.can_access_cliente(uuid) is
  'Autoriza papéis internos a consultar qualquer Cliente e restringe Cliente ao profiles.cliente_id ativo.';

commit;
