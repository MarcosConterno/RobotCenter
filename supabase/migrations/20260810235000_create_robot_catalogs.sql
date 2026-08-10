create table public.robot_packages (
  id uuid primary key default gen_random_uuid(), name text not null, color text not null default 'violeta', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz, deleted_by uuid,
  constraint robot_packages_name_not_blank check (btrim(name) <> ''),
  constraint robot_packages_color_check check (color in ('azul','violeta','verde','ambar','rosa','ciano'))
);
create unique index robot_packages_name_key on public.robot_packages (lower(btrim(name)));

create table public.robot_stacks (
  id uuid primary key default gen_random_uuid(), name text not null, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz, deleted_by uuid,
  constraint robot_stacks_name_not_blank check (btrim(name) <> '')
);
create unique index robot_stacks_name_key on public.robot_stacks (lower(btrim(name)));

create table public.robot_queues (
  id uuid primary key default gen_random_uuid(), name text not null, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz, deleted_by uuid,
  constraint robot_queues_name_not_blank check (btrim(name) <> '')
);
create unique index robot_queues_name_key on public.robot_queues (lower(btrim(name)));

create table public.robot_commands (
  id uuid primary key default gen_random_uuid(), name text not null, command text not null, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz, deleted_by uuid,
  constraint robot_commands_name_not_blank check (btrim(name) <> ''), constraint robot_commands_command_not_blank check (btrim(command) <> '')
);
create unique index robot_commands_name_key on public.robot_commands (lower(btrim(name)));
create unique index robot_commands_command_key on public.robot_commands (lower(btrim(command)));

alter table public.robos
  add column package_id uuid references public.robot_packages(id) on delete restrict,
  add column stack_id uuid references public.robot_stacks(id) on delete restrict,
  add column queue_id uuid references public.robot_queues(id) on delete restrict,
  add column command_id uuid references public.robot_commands(id) on delete restrict;
create index robos_package_id_idx on public.robos(package_id);
create index robos_stack_id_idx on public.robos(stack_id);
create index robos_queue_id_idx on public.robos(queue_id);
create index robos_command_id_idx on public.robos(command_id) where command_id is not null;

insert into public.robot_packages(name, color)
select min(btrim(pacote)), min(pacote_cor) from public.robos where deleted_at is null group by lower(btrim(pacote));
insert into public.robot_stacks(name)
select min(btrim(stack)) from public.robos where deleted_at is null group by lower(btrim(stack));
insert into public.robot_queues(name)
select min(btrim(fila)) from public.robos where deleted_at is null group by lower(btrim(fila));
insert into public.robot_commands(name, command)
select min(btrim(command)), min(btrim(command)) from public.robos where deleted_at is null and btrim(command) <> '' group by lower(btrim(command));

update public.robos r set package_id=p.id from public.robot_packages p where lower(btrim(r.pacote))=lower(btrim(p.name));
update public.robos r set stack_id=s.id from public.robot_stacks s where lower(btrim(r.stack))=lower(btrim(s.name));
update public.robos r set queue_id=q.id from public.robot_queues q where lower(btrim(r.fila))=lower(btrim(q.name));
update public.robos r set command_id=c.id from public.robot_commands c where btrim(r.command)<>'' and lower(btrim(r.command))=lower(btrim(c.command));

insert into public.permissions(codigo,recurso,acao,descricao,ativo) values
('robot_catalog.read','robot_catalog','read','Visualizar cadastros técnicos de robôs.',true),
('robot_catalog.manage','robot_catalog','manage','Gerenciar pacotes, stacks, commands e filas.',true)
on conflict(codigo) do update set recurso=excluded.recurso,acao=excluded.acao,descricao=excluded.descricao,ativo=true;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.codigo in ('admin','master') and p.codigo in ('robot_catalog.read','robot_catalog.manage')
on conflict(role_id,permission_id) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.codigo in ('operador','dev','suporte') and p.codigo='robot_catalog.read'
on conflict(role_id,permission_id) do nothing;

do $$ declare table_name text; begin
  foreach table_name in array array['robot_packages','robot_stacks','robot_queues','robot_commands'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on table public.%I from anon, authenticated',table_name);
    execute format('grant select, insert, update on table public.%I to authenticated',table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.has_permission(''robot_catalog.read'')))',table_name||'_select',table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.has_permission(''robot_catalog.manage'')))',table_name||'_insert',table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.has_permission(''robot_catalog.manage''))) with check ((select private.has_permission(''robot_catalog.manage'')))',table_name||'_update',table_name);
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.set_row_audit_fields()',table_name||'_set_audit_fields',table_name);
  end loop;
end $$;
