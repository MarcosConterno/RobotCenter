create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.ativo
        and p.deleted_at is null
    );
$$;

create or replace function private.has_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id
      join public.roles as r on r.id = ur.role_id
      where p.id = (select auth.uid())
        and p.ativo
        and p.deleted_at is null
        and r.codigo = role_code
        and r.ativo
    );
$$;

create or replace function private.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id
      join public.roles as r on r.id = ur.role_id
      join public.role_permissions as rp on rp.role_id = r.id
      join public.permissions as permission on permission.id = rp.permission_id
      where p.id = (select auth.uid())
        and p.ativo
        and p.deleted_at is null
        and r.ativo
        and permission.codigo = permission_code
        and permission.ativo
    );
$$;

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

revoke all on function private.is_active_user() from public, anon;
revoke all on function private.has_role(text) from public, anon;
revoke all on function private.has_permission(text) from public, anon;
revoke all on function private.can_access_cliente(uuid) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.has_role(text) to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.can_access_cliente(uuid) to authenticated;

revoke all on table public.clientes from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.roles from anon, authenticated;
revoke all on table public.permissions from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.role_permissions from anon, authenticated;
revoke all on table public.robos from anon, authenticated;
revoke all on table public.regras_robo from anon, authenticated;
revoke all on table public.publicacoes from anon, authenticated;

grant select, insert, update on table public.clientes to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.roles to authenticated;
grant select, insert, update on table public.permissions to authenticated;
grant select, insert, delete on table public.user_roles to authenticated;
grant select, insert, delete on table public.role_permissions to authenticated;
grant select, insert, update on table public.robos to authenticated;
grant select, insert, update on table public.regras_robo to authenticated;
grant select, insert on table public.publicacoes to authenticated;

alter table public.clientes enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.robos enable row level security;
alter table public.regras_robo enable row level security;
alter table public.publicacoes enable row level security;

create policy clientes_select
on public.clientes for select
to authenticated
using (
  deleted_at is null
  and (select private.has_permission('clients.read'))
  and (
    (select private.has_role('admin'))
    or (select private.has_role('operador'))
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

create policy clientes_insert_admin
on public.clientes for insert
to authenticated
with check (
  (select private.has_permission('clients.manage'))
  and deleted_at is null
);

create policy clientes_update_admin
on public.clientes for update
to authenticated
using (
  (select private.has_permission('clients.manage'))
  and deleted_at is null
)
with check ((select private.has_permission('clients.manage')));

create policy profiles_select
on public.profiles for select
to authenticated
using (
  deleted_at is null
  and (
    id = (select auth.uid())
    or (select private.has_permission('users.read'))
  )
);

create policy profiles_insert_admin
on public.profiles for insert
to authenticated
with check ((select private.has_permission('users.manage')));

create policy profiles_update_admin
on public.profiles for update
to authenticated
using (
  (select private.has_permission('users.manage'))
  and deleted_at is null
)
with check ((select private.has_permission('users.manage')));

create policy roles_select_active
on public.roles for select
to authenticated
using ((select private.is_active_user()) and ativo);

create policy roles_insert_admin
on public.roles for insert
to authenticated
with check ((select private.has_permission('users.manage')));

create policy roles_update_admin
on public.roles for update
to authenticated
using ((select private.has_permission('users.manage')))
with check ((select private.has_permission('users.manage')));

create policy permissions_select_active
on public.permissions for select
to authenticated
using ((select private.is_active_user()) and ativo);

create policy permissions_insert_admin
on public.permissions for insert
to authenticated
with check ((select private.has_permission('users.manage')));

create policy permissions_update_admin
on public.permissions for update
to authenticated
using ((select private.has_permission('users.manage')))
with check ((select private.has_permission('users.manage')));

create policy user_roles_select
on public.user_roles for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_permission('users.read'))
);

create policy user_roles_insert_admin
on public.user_roles for insert
to authenticated
with check ((select private.has_permission('users.manage')));

create policy user_roles_delete_admin
on public.user_roles for delete
to authenticated
using ((select private.has_permission('users.manage')));

create policy role_permissions_select
on public.role_permissions for select
to authenticated
using ((select private.is_active_user()));

create policy role_permissions_insert_admin
on public.role_permissions for insert
to authenticated
with check ((select private.has_permission('users.manage')));

create policy role_permissions_delete_admin
on public.role_permissions for delete
to authenticated
using ((select private.has_permission('users.manage')));

create policy robos_select
on public.robos for select
to authenticated
using (
  deleted_at is null
  and (select private.has_permission('robots.read'))
  and (select private.can_access_cliente(cliente_id))
);

create policy robos_insert_staff
on public.robos for insert
to authenticated
with check (
  deleted_at is null
  and (select private.has_permission('robots.create'))
);

create policy robos_update_staff
on public.robos for update
to authenticated
using (
  deleted_at is null
  and (select private.has_permission('robots.update'))
)
with check ((select private.has_permission('robots.update')));

create policy regras_robo_select
on public.regras_robo for select
to authenticated
using (
  deleted_at is null
  and (select private.has_permission('robots.read'))
  and exists (
    select 1
    from public.robos as r
    where r.id = regras_robo.robo_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy regras_robo_insert_staff
on public.regras_robo for insert
to authenticated
with check (
  deleted_at is null
  and (select private.has_permission('robots.update'))
  and exists (
    select 1
    from public.robos as r
    where r.id = regras_robo.robo_id
      and r.deleted_at is null
  )
);

create policy regras_robo_update_staff
on public.regras_robo for update
to authenticated
using (
  deleted_at is null
  and (select private.has_permission('robots.update'))
)
with check ((select private.has_permission('robots.update')));

create policy publicacoes_select
on public.publicacoes for select
to authenticated
using (
  (select private.has_permission('publications.read'))
  and
  exists (
    select 1
    from public.robos as r
    where r.id = publicacoes.robo_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy publicacoes_insert_staff
on public.publicacoes for insert
to authenticated
with check (
  (select private.has_permission('publications.create'))
  and exists (
    select 1
    from public.robos as r
    where r.id = publicacoes.robo_id
      and r.deleted_at is null
  )
);
