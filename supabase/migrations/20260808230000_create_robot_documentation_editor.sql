alter table public.regras_robo
  add column parent_id uuid references public.regras_robo(id) on delete restrict;

drop index if exists public.regras_robo_robo_tipo_ordem_active_key;

create unique index regras_robo_root_order_active_key
  on public.regras_robo (robo_id, tipo, ordem)
  where deleted_at is null and parent_id is null;

create unique index regras_robo_child_order_active_key
  on public.regras_robo (parent_id, ordem)
  where deleted_at is null and parent_id is not null;

create index regras_robo_parent_active_idx
  on public.regras_robo (parent_id, ordem)
  where deleted_at is null;

create or replace function private.validate_robot_requirement_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_rule public.regras_robo%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Uma regra não pode ser pai de si mesma.' using errcode = '23514';
  end if;

  select * into parent_rule
  from public.regras_robo
  where id = new.parent_id
    and deleted_at is null;

  if not found then
    raise exception 'Regra pai não encontrada.' using errcode = '23503';
  end if;

  if parent_rule.robo_id <> new.robo_id or parent_rule.tipo <> new.tipo then
    raise exception 'A regra pai deve pertencer ao mesmo robô e à mesma categoria.' using errcode = '23514';
  end if;

  if parent_rule.parent_id is not null then
    raise exception 'A hierarquia de regras aceita somente um nível de sub-regra.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_robot_requirement_hierarchy()
  from public, anon, authenticated;

create trigger regras_robo_validate_hierarchy
before insert or update of parent_id, robo_id, tipo on public.regras_robo
for each row execute function private.validate_robot_requirement_hierarchy();

create table public.robot_center_documentation_sections (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.robot_center_documentation_drafts(id) on delete restrict,
  section_key text not null,
  content text not null default '',
  ordem integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint robot_center_documentation_sections_key_check check (
    section_key in ('objective', 'reference_materials', 'overview', 'limitations', 'scope', 'execution_errors')
  ),
  constraint robot_center_documentation_sections_order_nonnegative check (ordem >= 0),
  constraint robot_center_documentation_sections_draft_key_unique unique (draft_id, section_key),
  constraint robot_center_documentation_sections_draft_order_unique unique (draft_id, ordem)
);

create table public.robot_center_documentation_blocks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.robot_center_documentation_drafts(id) on delete restrict,
  requirement_id uuid not null references public.regras_robo(id) on delete restrict,
  type text not null,
  ordem integer not null,
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  constraint robot_center_documentation_blocks_type_check check (
    type in ('text', 'image', 'caption', 'note', 'page_break')
  ),
  constraint robot_center_documentation_blocks_order_nonnegative check (ordem >= 0),
  constraint robot_center_documentation_blocks_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint robot_center_documentation_blocks_deleted_consistency check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  )
);

create unique index robot_center_documentation_blocks_order_active_key
  on public.robot_center_documentation_blocks (draft_id, requirement_id, ordem)
  where deleted_at is null;
create index robot_center_documentation_blocks_requirement_active_idx
  on public.robot_center_documentation_blocks (requirement_id, ordem)
  where deleted_at is null;
create index robot_center_documentation_sections_draft_idx
  on public.robot_center_documentation_sections (draft_id, ordem);

create trigger robot_center_documentation_sections_set_audit_fields
before insert or update on public.robot_center_documentation_sections
for each row execute function private.set_robot_center_documentation_audit_fields();

create trigger robot_center_documentation_blocks_set_audit_fields
before insert or update on public.robot_center_documentation_blocks
for each row execute function private.set_robot_center_documentation_audit_fields();

create or replace function private.validate_robot_documentation_block()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.robot_center_documentation_drafts dr
    join public.robot_center_documentations d on d.id = dr.documentation_id
    join public.regras_robo rr on rr.robo_id = d.robo_id
    where dr.id = new.draft_id
      and rr.id = new.requirement_id
      and rr.deleted_at is null
      and d.deleted_at is null
  ) then
    raise exception 'O bloco e a regra devem pertencer ao mesmo robô.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_robot_documentation_block()
  from public, anon, authenticated;

create trigger robot_center_documentation_blocks_validate_relationship
before insert or update of draft_id, requirement_id on public.robot_center_documentation_blocks
for each row execute function private.validate_robot_documentation_block();

revoke all on table public.robot_center_documentation_sections from anon, authenticated;
revoke all on table public.robot_center_documentation_blocks from anon, authenticated;
grant select, insert, update on table public.robot_center_documentation_sections to authenticated;
grant select, insert, update on table public.robot_center_documentation_blocks to authenticated;

alter table public.robot_center_documentation_sections enable row level security;
alter table public.robot_center_documentation_blocks enable row level security;

create policy robot_center_documentation_sections_admin
on public.robot_center_documentation_sections for all to authenticated
using (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robot_center_documentation_drafts dr
    join public.robot_center_documentations d on d.id = dr.documentation_id
    join public.robos r on r.id = d.robo_id
    where dr.id = robot_center_documentation_sections.draft_id
      and d.deleted_at is null and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
)
with check (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robot_center_documentation_drafts dr
    join public.robot_center_documentations d on d.id = dr.documentation_id
    join public.robos r on r.id = d.robo_id
    where dr.id = robot_center_documentation_sections.draft_id
      and d.deleted_at is null and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_center_documentation_blocks_admin
on public.robot_center_documentation_blocks for all to authenticated
using (
  deleted_at is null
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robot_center_documentation_drafts dr
    join public.robot_center_documentations d on d.id = dr.documentation_id
    join public.robos r on r.id = d.robo_id
    where dr.id = robot_center_documentation_blocks.draft_id
      and d.deleted_at is null and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
)
with check (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robot_center_documentation_drafts dr
    join public.robot_center_documentations d on d.id = dr.documentation_id
    join public.robos r on r.id = d.robo_id
    where dr.id = robot_center_documentation_blocks.draft_id
      and d.deleted_at is null and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create or replace function public.initialize_robot_center_documentation(target_robot_id uuid)
returns table (documentation_id uuid, draft_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_documentation_id uuid;
  current_draft_id uuid;
begin
  if not (select private.has_role('admin'))
    or not (select private.has_permission('robot_center_documentation.manage')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.robos r
    where r.id = target_robot_id and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  ) then
    raise exception 'Robô não encontrado ou não autorizado.' using errcode = '42501';
  end if;

  insert into public.robot_center_documentations (robo_id, status)
  values (target_robot_id, 'draft')
  on conflict (robo_id) do nothing;

  select d.id into current_documentation_id
  from public.robot_center_documentations d
  where d.robo_id = target_robot_id and d.deleted_at is null;

  insert into public.robot_center_documentation_drafts (documentation_id)
  values (current_documentation_id)
  on conflict (documentation_id) do nothing;

  select dr.id into current_draft_id
  from public.robot_center_documentation_drafts dr
  where dr.documentation_id = current_documentation_id;

  insert into public.robot_center_documentation_sections (draft_id, section_key, ordem)
  values
    (current_draft_id, 'objective', 0),
    (current_draft_id, 'reference_materials', 1),
    (current_draft_id, 'overview', 2),
    (current_draft_id, 'limitations', 3),
    (current_draft_id, 'scope', 4),
    (current_draft_id, 'execution_errors', 5)
  on conflict (draft_id, section_key) do nothing;

  return query select current_documentation_id, current_draft_id;
end;
$$;

revoke all on function public.initialize_robot_center_documentation(uuid) from public, anon;
grant execute on function public.initialize_robot_center_documentation(uuid) to authenticated;

create or replace function public.reorder_robot_requirements(
  target_robot_id uuid,
  target_type text,
  target_parent_id uuid,
  ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_ids uuid[];
  item_id uuid;
  item_order integer := 0;
begin
  if not (select private.has_role('admin')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  perform 1 from public.robos r
  where r.id = target_robot_id and r.deleted_at is null
    and (select private.can_access_cliente(r.cliente_id));
  if not found then
    raise exception 'Robô não encontrado ou não autorizado.' using errcode = '42501';
  end if;

  perform 1
  from public.regras_robo rr
  where rr.robo_id = target_robot_id
    and rr.tipo = target_type
    and rr.deleted_at is null
    and rr.parent_id is not distinct from target_parent_id
  order by rr.id
  for update;

  select coalesce(array_agg(rr.id order by rr.id), '{}'::uuid[]) into current_ids
  from public.regras_robo rr
  where rr.robo_id = target_robot_id
    and rr.tipo = target_type
    and rr.deleted_at is null
    and rr.parent_id is not distinct from target_parent_id;

  if current_ids <> coalesce((select array_agg(value order by value) from unnest(ordered_ids) value), '{}'::uuid[]) then
    raise exception 'A lista de regras não corresponde ao conjunto atual.' using errcode = '22023';
  end if;

  update public.regras_robo rr
  set ordem = rr.ordem + 1000000
  where rr.robo_id = target_robot_id
    and rr.tipo = target_type
    and rr.deleted_at is null
    and rr.parent_id is not distinct from target_parent_id;

  foreach item_id in array ordered_ids loop
    update public.regras_robo set ordem = item_order where id = item_id;
    item_order := item_order + 1;
  end loop;
end;
$$;

revoke all on function public.reorder_robot_requirements(uuid, text, uuid, uuid[]) from public, anon;
grant execute on function public.reorder_robot_requirements(uuid, text, uuid, uuid[]) to authenticated;

create or replace function public.archive_robot_requirement(
  target_robot_id uuid,
  target_requirement_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_rule public.regras_robo%rowtype;
begin
  if not (select private.has_role('admin')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  select * into target_rule
  from public.regras_robo rr
  where rr.id = target_requirement_id
    and rr.robo_id = target_robot_id
    and rr.deleted_at is null
  for update;

  if not found then
    raise exception 'Regra não encontrada ou não autorizada.' using errcode = '42501';
  end if;

  update public.regras_robo
  set deleted_at = now(), deleted_by = auth.uid()
  where robo_id = target_robot_id
    and deleted_at is null
    and (id = target_requirement_id or parent_id = target_requirement_id);

  update public.regras_robo rr
  set ordem = rr.ordem + 1000000
  where rr.robo_id = target_robot_id
    and rr.tipo = target_rule.tipo
    and rr.deleted_at is null
    and rr.parent_id is not distinct from target_rule.parent_id;

  with ordered as (
    select rr.id, row_number() over (order by rr.ordem, rr.id) - 1 as next_order
    from public.regras_robo rr
    where rr.robo_id = target_robot_id
      and rr.tipo = target_rule.tipo
      and rr.deleted_at is null
      and rr.parent_id is not distinct from target_rule.parent_id
  )
  update public.regras_robo rr
  set ordem = ordered.next_order
  from ordered
  where rr.id = ordered.id;
end;
$$;

revoke all on function public.archive_robot_requirement(uuid, uuid) from public, anon;
grant execute on function public.archive_robot_requirement(uuid, uuid) to authenticated;

comment on column public.regras_robo.parent_id is 'Regra funcional pai; permite um nível de sub-regra com numeração derivada.';
comment on table public.robot_center_documentation_sections is 'Conteúdo editável das seções fixas do rascunho Robot Center.';
comment on table public.robot_center_documentation_blocks is 'Blocos documentais vinculados por UUID às regras reais do robô.';
