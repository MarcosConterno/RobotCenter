create table public.flows (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete restrict,
  name text not null,
  description text not null default '',
  version integer not null default 0,
  status text not null default 'rascunho',
  viewport jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint flows_name_not_blank check (btrim(name) <> ''),
  constraint flows_version_nonnegative check (version >= 0),
  constraint flows_status_check check (status in ('rascunho', 'publicado')),
  constraint flows_viewport_object check (jsonb_typeof(viewport) = 'object')
);

create table public.flow_nodes (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.flows(id) on delete cascade,
  type text not null,
  robot_id uuid references public.robos(id) on delete restrict,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint flow_nodes_type_check check (
    type in ('robot', 'trigger', 'system', 'decision', 'note', 'text', 'group')
  ),
  constraint flow_nodes_robot_link_check check (
    (type = 'robot' and robot_id is not null)
    or (type <> 'robot' and robot_id is null)
  ),
  constraint flow_nodes_data_object check (jsonb_typeof(data) = 'object'),
  constraint flow_nodes_id_flow_unique unique (id, flow_id)
);

create table public.flow_edges (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.flows(id) on delete cascade,
  source_node_id uuid not null,
  target_node_id uuid not null,
  type text not null default 'conexao',
  label text not null default '',
  condition text not null default '',
  description text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint flow_edges_type_not_blank check (btrim(type) <> ''),
  constraint flow_edges_distinct_nodes check (source_node_id <> target_node_id),
  constraint flow_edges_source_same_flow_fkey
    foreign key (source_node_id, flow_id)
    references public.flow_nodes(id, flow_id) on delete cascade,
  constraint flow_edges_target_same_flow_fkey
    foreign key (target_node_id, flow_id)
    references public.flow_nodes(id, flow_id) on delete cascade
);

create table public.flow_versions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.flows(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint flow_versions_version_positive check (version > 0),
  constraint flow_versions_snapshot_object check (jsonb_typeof(snapshot) = 'object'),
  constraint flow_versions_flow_version_unique unique (flow_id, version)
);

create index flows_client_updated_idx on public.flows (client_id, updated_at desc);
create index flows_created_by_idx on public.flows (created_by);
create index flows_updated_by_idx on public.flows (updated_by);
create index flow_nodes_flow_idx on public.flow_nodes (flow_id);
create index flow_nodes_robot_idx on public.flow_nodes (robot_id) where robot_id is not null;
create index flow_nodes_created_by_idx on public.flow_nodes (created_by);
create index flow_nodes_updated_by_idx on public.flow_nodes (updated_by);
create index flow_edges_flow_idx on public.flow_edges (flow_id);
create index flow_edges_source_idx on public.flow_edges (source_node_id);
create index flow_edges_target_idx on public.flow_edges (target_node_id);
create index flow_edges_created_by_idx on public.flow_edges (created_by);
create index flow_edges_updated_by_idx on public.flow_edges (updated_by);
create index flow_versions_flow_created_idx on public.flow_versions (flow_id, created_at desc);
create index flow_versions_created_by_idx on public.flow_versions (created_by);

create trigger flows_set_audit_fields
before insert or update on public.flows
for each row execute function private.set_row_audit_fields();

create trigger flow_nodes_set_audit_fields
before insert or update on public.flow_nodes
for each row execute function private.set_row_audit_fields();

create trigger flow_edges_set_audit_fields
before insert or update on public.flow_edges
for each row execute function private.set_row_audit_fields();

create trigger flow_versions_set_audit_fields
before insert on public.flow_versions
for each row execute function private.set_created_audit_fields();

insert into public.permissions (codigo, recurso, acao, descricao)
values
  ('flows.read', 'flows', 'read', 'Visualizar fluxos autorizados.'),
  ('flows.create', 'flows', 'create', 'Criar fluxos.'),
  ('flows.update', 'flows', 'update', 'Editar fluxos autorizados.'),
  ('flows.delete', 'flows', 'delete', 'Excluir fluxos.'),
  ('flows.publish', 'flows', 'publish', 'Publicar novas versões de fluxos.')
on conflict (codigo) do update
set recurso = excluded.recurso,
    acao = excluded.acao,
    descricao = excluded.descricao,
    ativo = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where r.codigo = 'admin'
  and p.codigo like 'flows.%'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where r.codigo in ('operador', 'suporte')
  and p.codigo = 'flows.read'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where r.codigo = 'cliente'
  and p.codigo in ('flows.read', 'flows.update', 'flows.publish')
on conflict do nothing;

revoke all on table public.flows from anon, authenticated;
revoke all on table public.flow_nodes from anon, authenticated;
revoke all on table public.flow_edges from anon, authenticated;
revoke all on table public.flow_versions from anon, authenticated;

grant select, insert, delete on table public.flows to authenticated;
grant update (name, description, viewport) on table public.flows to authenticated;
grant select, insert, update, delete on table public.flow_nodes to authenticated;
grant select, insert, update, delete on table public.flow_edges to authenticated;
grant select on table public.flow_versions to authenticated;

alter table public.flows enable row level security;
alter table public.flow_nodes enable row level security;
alter table public.flow_edges enable row level security;
alter table public.flow_versions enable row level security;

create policy flows_select
on public.flows for select to authenticated
using (
  (select private.has_permission('flows.read'))
  and (select private.can_access_cliente(client_id))
);

create policy flows_insert_admin
on public.flows for insert to authenticated
with check (
  (select private.has_permission('flows.create'))
  and (select private.has_role('admin'))
  and exists (
    select 1 from public.clientes as c
    where c.id = client_id and c.deleted_at is null
  )
);

create policy flows_update_authorized
on public.flows for update to authenticated
using (
  (select private.has_permission('flows.update'))
  and (select private.can_access_cliente(client_id))
)
with check (
  (select private.has_permission('flows.update'))
  and (select private.can_access_cliente(client_id))
);

create policy flows_delete_admin
on public.flows for delete to authenticated
using (
  (select private.has_permission('flows.delete'))
  and (select private.has_role('admin'))
);

create policy flow_nodes_select
on public.flow_nodes for select to authenticated
using (
  (select private.has_permission('flows.read'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_nodes.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
);

create policy flow_nodes_insert
on public.flow_nodes for insert to authenticated
with check (
  (select private.has_permission('flows.update'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_nodes.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
  and (
    robot_id is null
    or exists (
      select 1 from public.robos as r
      join public.flows as f on f.id = flow_nodes.flow_id
      where r.id = flow_nodes.robot_id
        and r.cliente_id = f.client_id
        and r.deleted_at is null
    )
  )
);

create policy flow_nodes_update
on public.flow_nodes for update to authenticated
using (
  (select private.has_permission('flows.update'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_nodes.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
)
with check (
  (select private.has_permission('flows.update'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_nodes.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
);

create policy flow_nodes_delete
on public.flow_nodes for delete to authenticated
using (
  (select private.has_permission('flows.update'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_nodes.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
);

create policy flow_edges_select
on public.flow_edges for select to authenticated
using (
  (select private.has_permission('flows.read'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_edges.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
);

create policy flow_edges_insert
on public.flow_edges for insert to authenticated
with check (
  (select private.has_permission('flows.update'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_edges.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
);

create policy flow_edges_update
on public.flow_edges for update to authenticated
using (
  (select private.has_permission('flows.update'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_edges.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
)
with check (
  (select private.has_permission('flows.update'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_edges.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
);

create policy flow_edges_delete
on public.flow_edges for delete to authenticated
using (
  (select private.has_permission('flows.update'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_edges.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
);

create policy flow_versions_select
on public.flow_versions for select to authenticated
using (
  (select private.has_permission('flows.read'))
  and exists (
    select 1 from public.flows as f
    where f.id = flow_versions.flow_id
      and (select private.can_access_cliente(f.client_id))
  )
);

create or replace function private.publish_flow(target_flow_id uuid, target_snapshot jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version integer;
begin
  if (select auth.uid()) is null
     or not (select private.has_permission('flows.publish')) then
    raise exception 'Sem permissão para publicar este fluxo.' using errcode = '42501';
  end if;

  if target_snapshot is null or jsonb_typeof(target_snapshot) <> 'object' then
    raise exception 'Snapshot inválido.' using errcode = '22023';
  end if;

  update public.flows as f
  set version = version + 1,
      status = 'publicado'
  where f.id = target_flow_id
    and (select private.can_access_cliente(f.client_id))
  returning f.version into next_version;

  if next_version is null then
    raise exception 'Fluxo não encontrado ou não autorizado.' using errcode = '42501';
  end if;

  insert into public.flow_versions (flow_id, version, snapshot, created_by)
  values (target_flow_id, next_version, target_snapshot, (select auth.uid()));

  return next_version;
end;
$$;

revoke all on function private.publish_flow(uuid, jsonb) from public, anon;
grant execute on function private.publish_flow(uuid, jsonb) to authenticated;

create or replace function public.publish_flow(target_flow_id uuid, target_snapshot jsonb)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.publish_flow(target_flow_id, target_snapshot);
$$;

revoke all on function public.publish_flow(uuid, jsonb) from public, anon;
grant execute on function public.publish_flow(uuid, jsonb) to authenticated;
