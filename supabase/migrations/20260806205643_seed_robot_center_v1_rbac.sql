insert into public.roles (id, codigo, nome, descricao)
values
  ('10000000-0000-4000-8000-000000000001', 'admin', 'Admin', 'Acesso administrativo completo.'),
  ('10000000-0000-4000-8000-000000000002', 'operador', 'Operador', 'Opera robôs e publicações.'),
  ('10000000-0000-4000-8000-000000000003', 'cliente', 'Cliente', 'Consulta dados do próprio cliente.')
on conflict (codigo) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao,
  ativo = true;

insert into public.permissions (id, codigo, recurso, acao, descricao)
values
  ('20000000-0000-4000-8000-000000000001', 'dashboard.read', 'dashboard', 'read', 'Visualizar o Dashboard.'),
  ('20000000-0000-4000-8000-000000000002', 'robots.read', 'robots', 'read', 'Visualizar robôs.'),
  ('20000000-0000-4000-8000-000000000003', 'robots.create', 'robots', 'create', 'Cadastrar robôs.'),
  ('20000000-0000-4000-8000-000000000004', 'robots.update', 'robots', 'update', 'Editar robôs.'),
  ('20000000-0000-4000-8000-000000000005', 'robots.archive', 'robots', 'archive', 'Arquivar robôs.'),
  ('20000000-0000-4000-8000-000000000006', 'publications.read', 'publications', 'read', 'Visualizar publicações.'),
  ('20000000-0000-4000-8000-000000000007', 'publications.create', 'publications', 'create', 'Registrar publicações.'),
  ('20000000-0000-4000-8000-000000000008', 'settings.read', 'settings', 'read', 'Visualizar configurações permitidas.'),
  ('20000000-0000-4000-8000-000000000009', 'users.read', 'users', 'read', 'Visualizar usuários.'),
  ('20000000-0000-4000-8000-000000000010', 'users.manage', 'users', 'manage', 'Gerenciar usuários e papéis.'),
  ('20000000-0000-4000-8000-000000000011', 'clients.read', 'clients', 'read', 'Visualizar clientes.'),
  ('20000000-0000-4000-8000-000000000012', 'clients.manage', 'clients', 'manage', 'Gerenciar clientes.')
on conflict (codigo) do update
set
  recurso = excluded.recurso,
  acao = excluded.acao,
  descricao = excluded.descricao,
  ativo = true;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
cross join public.permissions as permission
where role.codigo = 'admin'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
join public.permissions as permission
  on permission.codigo in (
    'dashboard.read',
    'robots.read',
    'robots.create',
    'robots.update',
    'robots.archive',
    'publications.read',
    'publications.create',
    'settings.read',
    'clients.read'
  )
where role.codigo = 'operador'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
join public.permissions as permission
  on permission.codigo in (
    'dashboard.read',
    'robots.read',
    'publications.read',
    'settings.read',
    'clients.read'
  )
where role.codigo = 'cliente'
on conflict (role_id, permission_id) do nothing;
