create table public.robot_center_documentations (
  id uuid primary key default gen_random_uuid(),
  robo_id uuid not null references public.robos(id) on delete restrict,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  constraint robot_center_documentations_robo_unique unique (robo_id),
  constraint robot_center_documentations_status_check check (status in ('draft', 'published', 'archived')),
  constraint robot_center_documentations_deleted_consistency check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  )
);

create table public.robot_center_documentation_drafts (
  id uuid primary key default gen_random_uuid(),
  documentation_id uuid not null references public.robot_center_documentations(id) on delete restrict,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint robot_center_documentation_drafts_documentation_unique unique (documentation_id),
  constraint robot_center_documentation_drafts_revision_nonnegative check (revision >= 0)
);

create table public.robot_center_documentation_versions (
  id uuid primary key default gen_random_uuid(),
  documentation_id uuid not null references public.robot_center_documentations(id) on delete restrict,
  version integer not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  constraint robot_center_documentation_versions_version_positive check (version > 0),
  constraint robot_center_documentation_versions_documentation_version_unique unique (documentation_id, version)
);

create index robot_center_documentations_robo_active_idx
  on public.robot_center_documentations (robo_id)
  where deleted_at is null;
create index robot_center_documentation_versions_documentation_created_idx
  on public.robot_center_documentation_versions (documentation_id, created_at desc);

create or replace function private.set_robot_center_documentation_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := coalesce(current_user_id, new.created_by);
    new.updated_by := coalesce(current_user_id, new.updated_by, new.created_by);
    return new;
  end if;

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(current_user_id, old.updated_by, old.created_by);
  return new;
end;
$$;

revoke all on function private.set_robot_center_documentation_audit_fields()
  from public, anon, authenticated;

create trigger robot_center_documentations_set_audit_fields
before insert or update on public.robot_center_documentations
for each row execute function private.set_robot_center_documentation_audit_fields();

create trigger robot_center_documentation_drafts_set_audit_fields
before insert or update on public.robot_center_documentation_drafts
for each row execute function private.set_robot_center_documentation_audit_fields();

create or replace function private.prevent_robot_center_documentation_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Versões publicadas da documentação Robot Center são imutáveis.' using errcode = '55000';
end;
$$;

revoke all on function private.prevent_robot_center_documentation_version_mutation()
  from public, anon, authenticated;

create trigger robot_center_documentation_versions_immutable
before update or delete on public.robot_center_documentation_versions
for each row execute function private.prevent_robot_center_documentation_version_mutation();

insert into public.permissions (codigo, recurso, acao, descricao)
values
  ('robot_center_documentation.read', 'robot_center_documentation', 'read', 'Visualizar documentação Robot Center publicada.'),
  ('robot_center_documentation.manage', 'robot_center_documentation', 'manage', 'Criar e editar documentação Robot Center.')
on conflict (codigo) do update
set recurso = excluded.recurso,
    acao = excluded.acao,
    descricao = excluded.descricao,
    updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where r.codigo = 'admin'
  and p.codigo in ('robot_center_documentation.read', 'robot_center_documentation.manage')
on conflict do nothing;

revoke all on table public.robot_center_documentations from anon, authenticated;
revoke all on table public.robot_center_documentation_drafts from anon, authenticated;
revoke all on table public.robot_center_documentation_versions from anon, authenticated;

grant select, insert, update on table public.robot_center_documentations to authenticated;
grant select, insert, update on table public.robot_center_documentation_drafts to authenticated;
grant select, insert on table public.robot_center_documentation_versions to authenticated;

alter table public.robot_center_documentations enable row level security;
alter table public.robot_center_documentation_drafts enable row level security;
alter table public.robot_center_documentation_versions enable row level security;

create policy robot_center_documentations_select
on public.robot_center_documentations for select to authenticated
using (
  deleted_at is null
  and (select private.has_permission('robot_center_documentation.read'))
  and exists (
    select 1
    from public.robos as r
    where r.id = robot_center_documentations.robo_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_center_documentations_insert_admin
on public.robot_center_documentations for insert to authenticated
with check (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robos as r
    where r.id = robot_center_documentations.robo_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_center_documentations_update_admin
on public.robot_center_documentations for update to authenticated
using (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
)
with check (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robos as r
    where r.id = robot_center_documentations.robo_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_center_documentation_drafts_select_admin
on public.robot_center_documentation_drafts for select to authenticated
using (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robot_center_documentations as d
    join public.robos as r on r.id = d.robo_id
    where d.id = robot_center_documentation_drafts.documentation_id
      and d.deleted_at is null
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_center_documentation_drafts_insert_admin
on public.robot_center_documentation_drafts for insert to authenticated
with check (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robot_center_documentations as d
    join public.robos as r on r.id = d.robo_id
    where d.id = robot_center_documentation_drafts.documentation_id
      and d.deleted_at is null
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_center_documentation_drafts_update_admin
on public.robot_center_documentation_drafts for update to authenticated
using (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
)
with check (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robot_center_documentations as d
    join public.robos as r on r.id = d.robo_id
    where d.id = robot_center_documentation_drafts.documentation_id
      and d.deleted_at is null
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

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
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_center_documentation_versions_insert_admin
on public.robot_center_documentation_versions for insert to authenticated
with check (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.robot_center_documentations as d
    join public.robos as r on r.id = d.robo_id
    where d.id = robot_center_documentation_versions.documentation_id
      and d.deleted_at is null
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);
