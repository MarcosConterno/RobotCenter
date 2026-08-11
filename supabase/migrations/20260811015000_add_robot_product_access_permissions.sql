insert into public.permissions (codigo, recurso, acao, descricao, ativo)
values
  ('robots.product.integrador.read', 'robots', 'product.integrador.read', 'Visualizar Robôs Integradores.', true),
  ('robots.product.consulta_processual.read', 'robots', 'product.consulta_processual.read', 'Visualizar robôs de Consulta Processual.', true),
  ('robots.product.peticionamento.read', 'robots', 'product.peticionamento.read', 'Visualizar robôs de Peticionamento.', true),
  ('robots.product.movimento.read', 'robots', 'product.movimento.read', 'Visualizar robôs de Movimento.', true)
on conflict (codigo) do update
set recurso = excluded.recurso,
    acao = excluded.acao,
    descricao = excluded.descricao,
    ativo = true;

-- Preserva integralmente o acesso atual: todo perfil que já visualiza Robôs
-- recebe inicialmente os quatro produtos. A segregação passa a ser opt-in.
insert into public.role_permissions (role_id, permission_id)
select distinct existing.role_id, product.id
from public.role_permissions existing
join public.permissions base on base.id = existing.permission_id
cross join public.permissions product
where base.codigo = 'robots.read'
  and product.codigo in (
    'robots.product.integrador.read',
    'robots.product.consulta_processual.read',
    'robots.product.peticionamento.read',
    'robots.product.movimento.read'
  )
on conflict (role_id, permission_id) do nothing;

drop policy if exists robos_select on public.robos;
create policy robos_select
on public.robos for select
to authenticated
using (
  deleted_at is null
  and (select private.has_permission('robots.read'))
  and (select private.can_access_cliente(cliente_id))
  and case product_type
    when 'INTEGRADOR' then (select private.has_permission('robots.product.integrador.read'))
    when 'CONSULTA_PROCESSUAL' then (select private.has_permission('robots.product.consulta_processual.read'))
    when 'PETICIONAMENTO' then (select private.has_permission('robots.product.peticionamento.read'))
    when 'MOVIMENTO' then (select private.has_permission('robots.product.movimento.read'))
    else false
  end
);

