insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, documentation_permission.id
from public.role_permissions as rp
join public.permissions as robot_permission
  on robot_permission.id = rp.permission_id
join public.permissions as documentation_permission
  on documentation_permission.codigo = 'robot_center_documentation.read'
where robot_permission.codigo = 'robots.read'
on conflict do nothing;

drop policy if exists robot_center_documentations_select
  on public.robot_center_documentations;

create policy robot_center_documentations_select
on public.robot_center_documentations for select to authenticated
using (
  deleted_at is null
  and (select private.has_permission('robot_center_documentation.read'))
  and (
    status = 'published'
    or (
      (select private.has_role('admin'))
      and (select private.has_permission('robot_center_documentation.manage'))
    )
  )
  and exists (
    select 1
    from public.robos as r
    where r.id = robot_center_documentations.robo_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

drop policy if exists robot_center_documentation_versions_select
  on public.robot_center_documentation_versions;

create policy robot_center_documentation_versions_select
on public.robot_center_documentation_versions for select to authenticated
using (
  (select private.has_permission('robot_center_documentation.read'))
  and exists (
    select 1
    from public.robot_center_documentations as d
    join public.robos as r on r.id = d.robo_id
    where d.id = robot_center_documentation_versions.documentation_id
      and d.deleted_at is null
      and r.deleted_at is null
      and (
        d.status = 'published'
        or (
          (select private.has_role('admin'))
          and (select private.has_permission('robot_center_documentation.manage'))
        )
      )
      and (select private.can_access_cliente(r.cliente_id))
  )
);
