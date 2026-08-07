-- Suporte acessa somente as dashboards na aplicação. As permissões de leitura
-- abaixo são necessárias para compor os dados exibidos nelas.
insert into public.roles (id, codigo, nome, descricao)
values (
  '10000000-0000-4000-8000-000000000004',
  'suporte',
  'Suporte',
  'Consulta dashboards e indicadores operacionais.'
)
on conflict (codigo) do nothing;

insert into public.permissions (id, codigo, recurso, acao, descricao)
values (
  '20000000-0000-4000-8000-000000000013',
  'robots.capacity.update',
  'robots',
  'capacity.update',
  'Alterar somente os campos Ideal e Max dos robôs.'
)
on conflict (codigo) do nothing;

-- Operador deixa de administrar o cadastro completo e mantém apenas a edição
-- operacional dos campos de capacidade na dashboard.
delete from public.role_permissions as rp
using public.roles as r, public.permissions as p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.codigo = 'operador'
  and p.codigo in (
    'robots.create',
    'robots.update',
    'robots.archive',
    'publications.create',
    'settings.read'
  );

-- Cliente não acessa mais a área de configurações.
delete from public.role_permissions as rp
using public.roles as r, public.permissions as p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.codigo = 'cliente'
  and p.codigo = 'settings.read';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where r.codigo in ('admin', 'operador')
  and p.codigo = 'robots.capacity.update'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where r.codigo = 'suporte'
  and p.codigo in (
    'dashboard.read',
    'robots.read',
    'publications.read',
    'clients.read'
  )
on conflict do nothing;

-- Inclui Suporte no escopo de leitura necessário à dashboard. A navegação e o
-- proxy continuam impedindo acesso às páginas de Robôs e Configurações.
create or replace function private.can_access_cliente(target_cliente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.user_roles as ur
        join public.roles as r on r.id = ur.role_id
        where ur.user_id = auth.uid()
          and r.codigo in ('admin', 'operador', 'suporte')
      )
      or exists (
        select 1
        from public.user_roles as ur
        join public.roles as r on r.id = ur.role_id
        join public.profiles as pr on pr.id = ur.user_id
        where ur.user_id = auth.uid()
          and r.codigo = 'cliente'
          and pr.cliente_id = target_cliente_id
          and pr.deleted_at is null
      )
    );
$$;

revoke all on function private.can_access_cliente(uuid) from public;
grant execute on function private.can_access_cliente(uuid) to authenticated;

-- SECURITY DEFINER é usado somente para permitir uma atualização de coluna
-- restrita. A função valida sessão, permissão específica e os valores recebidos.
create or replace function public.update_robot_capacity(
  target_robot_id uuid,
  target_ideal integer,
  target_max integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  if not private.has_permission('robots.capacity.update') then
    raise exception 'Sem permissão para alterar Ideal e Max.' using errcode = '42501';
  end if;

  if target_ideal is null or target_max is null or target_ideal < 0 or target_max < 0 then
    raise exception 'Ideal e Max devem ser inteiros maiores ou iguais a zero.' using errcode = '22023';
  end if;

  if target_max < target_ideal then
    raise exception 'Max deve ser maior ou igual a Ideal.' using errcode = '22023';
  end if;

  update public.robos
  set ideal = target_ideal,
      max = target_max
  where id = target_robot_id
    and deleted_at is null;

  if not found then
    raise exception 'Robô não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_robot_capacity(uuid, integer, integer) from public, anon;
grant execute on function public.update_robot_capacity(uuid, integer, integer) to authenticated;
