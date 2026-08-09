alter table public.robot_center_documentation_blocks
  alter column requirement_id drop not null,
  add column section_id uuid references public.robot_center_documentation_sections(id) on delete restrict,
  add column related_block_id uuid references public.robot_center_documentation_blocks(id) on delete restrict;

alter table public.robot_center_documentation_blocks
  add constraint robot_center_documentation_blocks_owner_check
  check (num_nonnulls(requirement_id, section_id) = 1) not valid;

alter table public.robot_center_documentation_blocks
  validate constraint robot_center_documentation_blocks_owner_check;

drop index if exists public.robot_center_documentation_blocks_order_active_key;

create unique index robot_center_documentation_blocks_requirement_order_active_key
  on public.robot_center_documentation_blocks (draft_id, requirement_id, ordem)
  where deleted_at is null and requirement_id is not null;

create unique index robot_center_documentation_blocks_section_order_active_key
  on public.robot_center_documentation_blocks (draft_id, section_id, ordem)
  where deleted_at is null and section_id is not null;

create index robot_center_documentation_blocks_section_active_idx
  on public.robot_center_documentation_blocks (section_id, ordem)
  where deleted_at is null and section_id is not null;

create index robot_center_documentation_blocks_related_idx
  on public.robot_center_documentation_blocks (related_block_id)
  where deleted_at is null and related_block_id is not null;

create unique index robot_center_documentation_caption_image_active_key
  on public.robot_center_documentation_blocks (related_block_id)
  where deleted_at is null and type = 'caption' and related_block_id is not null;

create or replace function private.validate_robot_documentation_block()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  related_type text;
  related_draft_id uuid;
begin
  if new.requirement_id is not null then
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
  elsif new.section_id is not null then
    if not exists (
      select 1
      from public.robot_center_documentation_sections section
      where section.id = new.section_id
        and section.draft_id = new.draft_id
    ) then
      raise exception 'O bloco e a seção devem pertencer ao mesmo rascunho.' using errcode = '23514';
    end if;
  else
    raise exception 'O bloco deve pertencer a uma regra ou seção.' using errcode = '23514';
  end if;

  if new.related_block_id is not null then
    select related.type, related.draft_id
      into related_type, related_draft_id
    from public.robot_center_documentation_blocks related
    where related.id = new.related_block_id
      and related.deleted_at is null;

    if not found or related_draft_id <> new.draft_id then
      raise exception 'O bloco relacionado deve pertencer ao mesmo rascunho.' using errcode = '23514';
    end if;
    if new.type = 'caption' and related_type <> 'image' then
      raise exception 'Uma legenda somente pode ser vinculada a uma imagem.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'robot-documentation',
  'robot-documentation',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy robot_documentation_images_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'robot-documentation'
  and (storage.foldername(name))[2] = 'draft'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robos robot
    where robot.id::text = (storage.foldername(name))[1]
      and robot.deleted_at is null
      and (select private.can_access_cliente(robot.cliente_id))
  )
);

create policy robot_documentation_images_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'robot-documentation'
  and (storage.foldername(name))[2] = 'draft'
  and (storage.foldername(name))[3] = 'images'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robos robot
    where robot.id::text = (storage.foldername(name))[1]
      and robot.deleted_at is null
      and (select private.can_access_cliente(robot.cliente_id))
  )
);

create policy robot_documentation_images_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'robot-documentation'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1 from public.robos robot
    where robot.id::text = (storage.foldername(name))[1]
      and robot.deleted_at is null
      and (select private.can_access_cliente(robot.cliente_id))
  )
)
with check (
  bucket_id = 'robot-documentation'
  and (storage.foldername(name))[2] = 'draft'
  and (storage.foldername(name))[3] = 'images'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
);

create policy robot_documentation_images_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'robot-documentation'
  and (storage.foldername(name))[2] = 'draft'
  and (storage.foldername(name))[3] = 'images'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1 from public.robos robot
    where robot.id::text = (storage.foldername(name))[1]
      and robot.deleted_at is null
      and (select private.can_access_cliente(robot.cliente_id))
  )
);

create or replace function public.append_robot_documentation_image_block(
  target_robot_id uuid,
  target_draft_id uuid,
  target_requirement_id uuid,
  target_block_id uuid,
  target_metadata jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_order integer;
  created_block public.robot_center_documentation_blocks%rowtype;
begin
  if not (select private.has_role('admin'))
    or not (select private.has_permission('robot_center_documentation.manage')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  perform 1
  from public.regras_robo requirement
  join public.robot_center_documentation_drafts draft on draft.id = target_draft_id
  join public.robot_center_documentations documentation on documentation.id = draft.documentation_id
  join public.robos robot on robot.id = documentation.robo_id
  where requirement.id = target_requirement_id
    and requirement.robo_id = target_robot_id
    and documentation.robo_id = target_robot_id
    and requirement.deleted_at is null
    and documentation.deleted_at is null
    and robot.deleted_at is null
    and (select private.can_access_cliente(robot.cliente_id))
  for update of requirement;

  if not found then
    raise exception 'Regra ou rascunho não encontrado.' using errcode = '42501';
  end if;

  select coalesce(max(block.ordem), -1) + 1
    into next_order
  from public.robot_center_documentation_blocks block
  where block.draft_id = target_draft_id
    and block.requirement_id = target_requirement_id
    and block.deleted_at is null;

  insert into public.robot_center_documentation_blocks (
    id, draft_id, requirement_id, type, ordem, metadata
  ) values (
    target_block_id, target_draft_id, target_requirement_id, 'image', next_order, target_metadata
  )
  returning * into created_block;

  return to_jsonb(created_block);
end;
$$;

revoke all on function public.append_robot_documentation_image_block(uuid, uuid, uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.append_robot_documentation_image_block(uuid, uuid, uuid, uuid, jsonb)
  to authenticated;

create or replace function public.reorder_robot_documentation_blocks(
  target_robot_id uuid,
  target_requirement_id uuid,
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
  if not (select private.has_role('admin'))
    or not (select private.has_permission('robot_center_documentation.manage')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.regras_robo requirement
    join public.robos robot on robot.id = requirement.robo_id
    where requirement.id = target_requirement_id
      and requirement.robo_id = target_robot_id
      and requirement.deleted_at is null
      and robot.deleted_at is null
      and (select private.can_access_cliente(robot.cliente_id))
  ) then
    raise exception 'Regra não encontrada ou não autorizada.' using errcode = '42501';
  end if;

  perform 1
  from public.robot_center_documentation_blocks block
  join public.robot_center_documentation_drafts draft on draft.id = block.draft_id
  join public.robot_center_documentations documentation on documentation.id = draft.documentation_id
  where block.requirement_id = target_requirement_id
    and block.deleted_at is null
    and documentation.robo_id = target_robot_id
  order by block.id
  for update of block;

  select coalesce(array_agg(block.id order by block.id), '{}'::uuid[])
    into current_ids
  from public.robot_center_documentation_blocks block
  join public.robot_center_documentation_drafts draft on draft.id = block.draft_id
  join public.robot_center_documentations documentation on documentation.id = draft.documentation_id
  where block.requirement_id = target_requirement_id
    and block.deleted_at is null
    and documentation.robo_id = target_robot_id;

  if current_ids <> coalesce(
    (select array_agg(value order by value) from unnest(ordered_ids) value),
    '{}'::uuid[]
  ) then
    raise exception 'A lista de blocos não corresponde ao conjunto atual.' using errcode = '22023';
  end if;

  update public.robot_center_documentation_blocks block
  set ordem = block.ordem + 1000000
  where block.requirement_id = target_requirement_id
    and block.deleted_at is null;

  foreach item_id in array ordered_ids loop
    update public.robot_center_documentation_blocks
    set ordem = item_order
    where id = item_id and requirement_id = target_requirement_id;
    item_order := item_order + 1;
  end loop;
end;
$$;

revoke all on function public.reorder_robot_documentation_blocks(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.reorder_robot_documentation_blocks(uuid, uuid, uuid[])
  to authenticated;

comment on column public.robot_center_documentation_blocks.section_id is
  'Seção proprietária quando o bloco não estiver vinculado a uma regra.';
comment on column public.robot_center_documentation_blocks.related_block_id is
  'Relação lógica entre blocos, utilizada inicialmente por legenda e imagem.';
