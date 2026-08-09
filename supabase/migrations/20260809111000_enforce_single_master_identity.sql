drop policy if exists user_roles_insert_admin on public.user_roles;
create policy user_roles_insert_admin
on public.user_roles for insert to authenticated
with check (
  (select private.has_role('admin'))
  and not exists (
    select 1
    from public.roles as role
    where role.id = user_roles.role_id
      and role.codigo = 'master'
  )
);

drop policy if exists user_roles_delete_admin on public.user_roles;
create policy user_roles_delete_admin
on public.user_roles for delete to authenticated
using (
  (select private.has_role('admin'))
  and not exists (
    select 1
    from public.roles as role
    where role.id = user_roles.role_id
      and role.codigo = 'master'
  )
);
