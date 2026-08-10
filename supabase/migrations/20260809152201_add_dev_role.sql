insert into public.roles (codigo, nome, descricao, ativo)
values ('dev', 'Dev', 'Perfil de desenvolvimento com acesso inicial equivalente ao Operador.', true)
on conflict (codigo) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao,
  ativo = true;

insert into public.role_permissions (role_id, permission_id)
select dev.id, operator_permission.permission_id
from public.roles as dev
cross join lateral (
  select role_permission.permission_id
  from public.role_permissions as role_permission
  join public.roles as operator on operator.id = role_permission.role_id
  where operator.codigo = 'operador'
) as operator_permission
where dev.codigo = 'dev'
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
      private.has_role('admin')
      or private.has_role('operador')
      or private.has_role('dev')
      or (
        private.has_role('cliente')
        and exists (
          select 1
          from public.profiles as p
          where p.id = (select auth.uid())
            and p.cliente_id = target_cliente_id
            and p.ativo
            and p.deleted_at is null
        )
      )
    );
$$;

revoke all on function private.can_access_cliente(uuid) from public, anon;

drop policy if exists clientes_select on public.clientes;
create policy clientes_select
on public.clientes for select
to authenticated
using (
  deleted_at is null
  and (select private.has_permission('clients.read'))
  and (
    (select private.has_role('admin'))
    or (select private.has_role('operador'))
    or (select private.has_role('dev'))
    or (
      (select private.has_role('cliente'))
      and id = (
        select p.cliente_id
        from public.profiles as p
        where p.id = (select auth.uid())
          and p.ativo
          and p.deleted_at is null
      )
    )
  )
);
