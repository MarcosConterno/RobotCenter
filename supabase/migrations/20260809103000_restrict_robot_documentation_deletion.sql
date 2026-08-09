alter table public.robot_center_documentations
  drop constraint if exists robot_center_documentations_robo_unique;

create unique index if not exists robot_center_documentations_robo_active_key
  on public.robot_center_documentations (robo_id)
  where deleted_at is null;

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
  and (
    deleted_at is null
    or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'marcos.vinicius@loylegal.com'
  )
  and exists (
    select 1
    from public.robos as r
    where r.id = robot_center_documentations.robo_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

comment on index public.robot_center_documentations_robo_active_key is
  'Garante uma única Documentação Robot Center ativa por robô e permite nova criação após exclusão lógica.';
