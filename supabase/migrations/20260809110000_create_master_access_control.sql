insert into public.roles (id, codigo, nome, descricao, ativo)
values (
  '10000000-0000-4000-8000-000000000005',
  'master',
  'Master',
  'Acesso máximo e exclusivo às configurações críticas da plataforma.',
  true
)
on conflict (codigo) do update
set nome = excluded.nome,
    descricao = excluded.descricao,
    ativo = true;

insert into public.permissions (id, codigo, recurso, acao, descricao, ativo)
values (
  '20000000-0000-4000-8000-000000000014',
  'access_control.read',
  'access_control',
  'read',
  'Visualizar o painel completo de papéis e permissões.',
  true
)
on conflict (codigo) do update
set recurso = excluded.recurso,
    acao = excluded.acao,
    descricao = excluded.descricao,
    ativo = true;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
cross join public.permissions permission
where role.codigo = 'master'
  and permission.ativo
on conflict (role_id, permission_id) do nothing;

insert into public.user_roles (user_id, role_id)
select auth_user.id, role.id
from auth.users auth_user
cross join public.roles role
where lower(auth_user.email) = 'marcos.vinicius@loylegal.com'
  and role.codigo = 'master'
on conflict (user_id, role_id) do nothing;

drop policy if exists roles_update_admin on public.roles;
create policy roles_update_admin
on public.roles for update to authenticated
using (
  (select private.has_permission('users.manage'))
  and (codigo <> 'master' or (select private.has_role('master')))
)
with check (
  (select private.has_permission('users.manage'))
  and (codigo <> 'master' or (select private.has_role('master')))
);

drop policy if exists permissions_update_admin on public.permissions;
create policy permissions_update_admin
on public.permissions for update to authenticated
using (
  (select private.has_permission('users.manage'))
  and (recurso <> 'access_control' or (select private.has_role('master')))
)
with check (
  (select private.has_permission('users.manage'))
  and (recurso <> 'access_control' or (select private.has_role('master')))
);

drop policy if exists user_roles_insert_admin on public.user_roles;
create policy user_roles_insert_admin
on public.user_roles for insert to authenticated
with check (
  (select private.has_permission('users.manage'))
  and (
    not exists (select 1 from public.roles role where role.id = user_roles.role_id and role.codigo = 'master')
    or (select private.has_role('master'))
  )
);

drop policy if exists user_roles_delete_admin on public.user_roles;
create policy user_roles_delete_admin
on public.user_roles for delete to authenticated
using (
  (select private.has_permission('users.manage'))
  and (
    not exists (select 1 from public.roles role where role.id = user_roles.role_id and role.codigo = 'master')
    or (select private.has_role('master'))
  )
);

drop policy if exists role_permissions_insert_admin on public.role_permissions;
create policy role_permissions_insert_admin
on public.role_permissions for insert to authenticated
with check (
  (select private.has_permission('users.manage'))
  and (
    not exists (select 1 from public.roles role where role.id = role_permissions.role_id and role.codigo = 'master')
    or (select private.has_role('master'))
  )
  and (
    not exists (select 1 from public.permissions permission where permission.id = role_permissions.permission_id and permission.recurso = 'access_control')
    or (select private.has_role('master'))
  )
);

drop policy if exists role_permissions_delete_admin on public.role_permissions;
create policy role_permissions_delete_admin
on public.role_permissions for delete to authenticated
using (
  (select private.has_permission('users.manage'))
  and (
    not exists (select 1 from public.roles role where role.id = role_permissions.role_id and role.codigo = 'master')
    or (select private.has_role('master'))
  )
  and (
    not exists (select 1 from public.permissions permission where permission.id = role_permissions.permission_id and permission.recurso = 'access_control')
    or (select private.has_role('master'))
  )
);

drop policy if exists robot_center_documentations_update_admin
  on public.robot_center_documentations;
create policy robot_center_documentations_update_admin
on public.robot_center_documentations for update to authenticated
using (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
)
with check (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and (deleted_at is null or (select private.has_role('master')))
  and exists (
    select 1
    from public.robos robot
    where robot.id = robot_center_documentations.robo_id
      and robot.deleted_at is null
      and (select private.can_access_cliente(robot.cliente_id))
  )
);
