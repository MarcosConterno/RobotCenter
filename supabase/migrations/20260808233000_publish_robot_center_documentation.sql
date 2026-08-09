create table public.robot_center_documentation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null,
  storage_path text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint robot_center_documentation_templates_name_not_blank check (btrim(name) <> ''),
  constraint robot_center_documentation_templates_path_not_blank check (btrim(storage_path) <> ''),
  constraint robot_center_documentation_templates_version_positive check (version > 0),
  constraint robot_center_documentation_templates_name_version_unique unique (name, version)
);

create unique index robot_center_documentation_templates_one_active_idx
  on public.robot_center_documentation_templates (active)
  where active;

insert into public.robot_center_documentation_templates (name, version, storage_path, active)
values ('Template oficial Robot Center', 1, 'official/robot-center-template-v1.docx', true)
on conflict (name, version) do update
set storage_path = excluded.storage_path,
    active = excluded.active,
    updated_at = now();

alter table public.robot_center_documentation_versions
  add column status text not null default 'generating',
  add column snapshot jsonb not null default '{}'::jsonb,
  add column template_id uuid references public.robot_center_documentation_templates(id) on delete restrict,
  add column template_version integer,
  add column docx_path text,
  add column pdf_path text,
  add column generation_token uuid,
  add column error_message text,
  add column started_at timestamptz not null default now(),
  add column published_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid references public.profiles(id) on delete restrict,
  add constraint robot_center_documentation_versions_status_check
    check (status in ('generating', 'published', 'failed')),
  add constraint robot_center_documentation_versions_snapshot_object_check
    check (jsonb_typeof(snapshot) = 'object'),
  add constraint robot_center_documentation_versions_published_files_check
    check (status <> 'published' or (docx_path is not null and pdf_path is not null and published_at is not null));

update public.robot_center_documentation_versions
set status = 'failed',
    error_message = 'Registro criado antes da implementação dos artefatos; publique novamente para gerar DOCX e PDF.'
where snapshot = '{}'::jsonb and docx_path is null and pdf_path is null;

create unique index robot_center_documentation_versions_generation_token_idx
  on public.robot_center_documentation_versions (generation_token)
  where generation_token is not null;
create unique index robot_center_documentation_versions_one_generating_idx
  on public.robot_center_documentation_versions (documentation_id)
  where status = 'generating';

alter table public.robot_center_documentations
  add column current_version_id uuid references public.robot_center_documentation_versions(id) on delete restrict;

create trigger robot_center_documentation_templates_set_audit_fields
before insert or update on public.robot_center_documentation_templates
for each row execute function private.set_robot_center_documentation_audit_fields();

drop trigger if exists robot_center_documentation_versions_immutable
  on public.robot_center_documentation_versions;

create or replace function private.prevent_robot_center_documentation_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Versões da documentação Robot Center não podem ser excluídas.' using errcode = '55000';
  end if;
  if old.status = 'published' then
    raise exception 'Versões publicadas da documentação Robot Center são imutáveis.' using errcode = '55000';
  end if;
  if new.id <> old.id
    or new.documentation_id <> old.documentation_id
    or new.version <> old.version
    or new.created_at <> old.created_at
    or new.created_by <> old.created_by
    or (old.status <> 'failed' and new.generation_token is distinct from old.generation_token) then
    raise exception 'A identidade da versão não pode ser alterada.' using errcode = '55000';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), old.updated_by, old.created_by);
  return new;
end;
$$;

create trigger robot_center_documentation_versions_immutable
before update or delete on public.robot_center_documentation_versions
for each row execute function private.prevent_robot_center_documentation_version_mutation();

revoke all on table public.robot_center_documentation_templates from anon, authenticated;
grant select on table public.robot_center_documentation_templates to authenticated;
grant update on table public.robot_center_documentation_versions to authenticated;

alter table public.robot_center_documentation_templates enable row level security;

create policy robot_center_documentation_templates_select_admin
on public.robot_center_documentation_templates for select to authenticated
using (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
);

create policy robot_center_documentation_versions_update_admin
on public.robot_center_documentation_versions for update to authenticated
using (
  status in ('generating', 'failed')
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1
    from public.robot_center_documentations d
    join public.robos r on r.id = d.robo_id
    where d.id = robot_center_documentation_versions.documentation_id
      and d.deleted_at is null and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
)
with check (
  (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
);

create or replace function public.begin_robot_center_documentation_publication(
  target_robot_id uuid,
  target_generation_token uuid
)
returns table (
  version_id uuid,
  version_number integer,
  documentation_id uuid,
  draft_id uuid,
  template_id uuid,
  template_version integer,
  template_storage_path text,
  reused boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_documentation public.robot_center_documentations%rowtype;
  current_draft public.robot_center_documentation_drafts%rowtype;
  current_template public.robot_center_documentation_templates%rowtype;
  current_version public.robot_center_documentation_versions%rowtype;
  next_version integer;
begin
  if not (select private.has_role('admin'))
    or not (select private.has_permission('robot_center_documentation.manage')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  select d.* into current_documentation
  from public.robot_center_documentations d
  join public.robos r on r.id = d.robo_id
  where d.robo_id = target_robot_id
    and d.deleted_at is null and r.deleted_at is null
    and (select private.can_access_cliente(r.cliente_id))
  for update of d;
  if not found then raise exception 'Documentação ou robô não encontrado.' using errcode = '42501'; end if;

  select * into current_draft
  from public.robot_center_documentation_drafts dr
  where dr.documentation_id = current_documentation.id;
  if not found then raise exception 'Rascunho não encontrado.' using errcode = '23503'; end if;

  select * into current_template
  from public.robot_center_documentation_templates t
  where t.active
  order by t.version desc
  limit 1;
  if not found then raise exception 'Nenhum template mestre ativo foi configurado.' using errcode = '23503'; end if;

  select * into current_version
  from public.robot_center_documentation_versions v
  where v.generation_token = target_generation_token;
  if found then
    if current_version.documentation_id <> current_documentation.id then
      raise exception 'Token de publicação inválido.' using errcode = '42501';
    end if;
    return query select current_version.id, current_version.version, current_documentation.id,
      current_draft.id, current_version.template_id, current_version.template_version,
      current_template.storage_path, true;
    return;
  end if;

  if exists (
    select 1 from public.robot_center_documentation_versions v
    where v.documentation_id = current_documentation.id and v.status = 'generating'
  ) then
    raise exception 'Já existe uma publicação em andamento.' using errcode = '55000';
  end if;

  select * into current_version
  from public.robot_center_documentation_versions v
  where v.documentation_id = current_documentation.id and v.status = 'failed'
  order by v.version desc
  limit 1
  for update;
  if found then
    update public.robot_center_documentation_versions
    set status = 'generating', snapshot = '{}'::jsonb, template_id = current_template.id,
        template_version = current_template.version, generation_token = target_generation_token,
        docx_path = null, pdf_path = null, error_message = null, started_at = now(), published_at = null
    where id = current_version.id
    returning * into current_version;
    return query select current_version.id, current_version.version, current_documentation.id,
      current_draft.id, current_template.id, current_template.version,
      current_template.storage_path, true;
    return;
  end if;

  select coalesce(max(v.version), 0) + 1 into next_version
  from public.robot_center_documentation_versions v
  where v.documentation_id = current_documentation.id;

  insert into public.robot_center_documentation_versions (
    documentation_id, version, status, snapshot, template_id, template_version,
    generation_token, created_by, updated_by
  ) values (
    current_documentation.id, next_version, 'generating', '{}'::jsonb,
    current_template.id, current_template.version, target_generation_token, auth.uid(), auth.uid()
  ) returning * into current_version;

  return query select current_version.id, current_version.version, current_documentation.id,
    current_draft.id, current_template.id, current_template.version,
    current_template.storage_path, false;
end;
$$;

create or replace function public.complete_robot_center_documentation_publication(
  target_version_id uuid,
  target_generation_token uuid,
  target_snapshot jsonb,
  target_docx_path text,
  target_pdf_path text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_version public.robot_center_documentation_versions%rowtype;
begin
  if not (select private.has_role('admin'))
    or not (select private.has_permission('robot_center_documentation.manage')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if jsonb_typeof(target_snapshot) <> 'object' or target_snapshot = '{}'::jsonb then
    raise exception 'Snapshot inválido.' using errcode = '22023';
  end if;
  select * into target_version from public.robot_center_documentation_versions
  where id = target_version_id and generation_token = target_generation_token and status = 'generating'
  for update;
  if not found then raise exception 'Versão não está disponível para conclusão.' using errcode = '55000'; end if;

  update public.robot_center_documentation_versions
  set snapshot = target_snapshot,
      docx_path = target_docx_path,
      pdf_path = target_pdf_path,
      status = 'published',
      published_at = now(),
      error_message = null
  where id = target_version.id;

  update public.robot_center_documentations
  set current_version_id = target_version.id,
      status = 'published',
      updated_at = now(),
      updated_by = auth.uid()
  where id = target_version.documentation_id;
end;
$$;

create or replace function public.fail_robot_center_documentation_publication(
  target_version_id uuid,
  target_generation_token uuid,
  target_error_message text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.has_role('admin')) then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  update public.robot_center_documentation_versions
  set status = 'failed', error_message = left(coalesce(target_error_message, 'Falha desconhecida.'), 2000)
  where id = target_version_id and generation_token = target_generation_token and status = 'generating';
end;
$$;

revoke all on function public.begin_robot_center_documentation_publication(uuid, uuid) from public, anon;
revoke all on function public.complete_robot_center_documentation_publication(uuid, uuid, jsonb, text, text) from public, anon;
revoke all on function public.fail_robot_center_documentation_publication(uuid, uuid, text) from public, anon;
grant execute on function public.begin_robot_center_documentation_publication(uuid, uuid) to authenticated;
grant execute on function public.complete_robot_center_documentation_publication(uuid, uuid, jsonb, text, text) to authenticated;
grant execute on function public.fail_robot_center_documentation_publication(uuid, uuid, text) to authenticated;

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/png', 'image/jpeg', 'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf'
    ]
where id = 'robot-documentation';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'robot-documentation-templates', 'robot-documentation-templates', false, 52428800,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy robot_documentation_templates_select_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'robot-documentation-templates'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
);

create policy robot_documentation_templates_insert_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'robot-documentation-templates'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
);

create policy robot_documentation_templates_update_admin
on storage.objects for update to authenticated
using (
  bucket_id = 'robot-documentation-templates'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
)
with check (
  bucket_id = 'robot-documentation-templates'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
);

create policy robot_documentation_versions_select_files
on storage.objects for select to authenticated
using (
  bucket_id = 'robot-documentation'
  and (storage.foldername(name))[2] = 'versions'
  and (select private.has_permission('robot_center_documentation.read'))
  and exists (
    select 1 from public.robos r
    where r.id::text = (storage.foldername(name))[1]
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_documentation_versions_insert_files_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'robot-documentation'
  and (storage.foldername(name))[2] = 'versions'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
  and exists (
    select 1 from public.robos r
    where r.id::text = (storage.foldername(name))[1]
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_documentation_versions_update_files_admin
on storage.objects for update to authenticated
using (
  bucket_id = 'robot-documentation'
  and (storage.foldername(name))[2] = 'versions'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
)
with check (
  bucket_id = 'robot-documentation'
  and (storage.foldername(name))[2] = 'versions'
  and (select private.has_role('admin'))
  and (select private.has_permission('robot_center_documentation.manage'))
);

comment on table public.robot_center_documentation_templates is 'Templates DOCX mestres privados; o arquivo nunca é alterado durante a publicação.';
comment on column public.robot_center_documentation_versions.snapshot is 'Snapshot completo e imutável após publicação.';
comment on column public.robot_center_documentation_versions.version is 'Sequência interna: 1=v1.0, 2=v1.1, 3=v1.2.';
