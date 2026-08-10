create table public.robot_uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  robot_id uuid not null references public.robos(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  constraint robot_uploaded_documents_path_not_blank check (btrim(storage_path) <> ''),
  constraint robot_uploaded_documents_name_not_blank check (btrim(file_name) <> ''),
  constraint robot_uploaded_documents_mime_not_blank check (btrim(mime_type) <> ''),
  constraint robot_uploaded_documents_size_valid check (
    size_bytes is null or (size_bytes > 0 and size_bytes <= 20971520)
  ),
  constraint robot_uploaded_documents_deleted_by_requires_deleted_at check (
    deleted_by is null or deleted_at is not null
  )
);

create index robot_uploaded_documents_robot_created_idx
  on public.robot_uploaded_documents (robot_id, created_at desc)
  where deleted_at is null;

create trigger robot_uploaded_documents_set_audit_fields
before insert or update on public.robot_uploaded_documents
for each row execute function private.set_row_audit_fields();

insert into public.robot_uploaded_documents (
  robot_id, storage_path, file_name, mime_type, size_bytes, created_at, updated_at, created_by, updated_by
)
select
  id, manual_path, manual_nome, 'application/pdf', null, created_at, updated_at, created_by, updated_by
from public.robos
where manual_path is not null and manual_nome is not null
on conflict (storage_path) do nothing;

revoke all on table public.robot_uploaded_documents from anon, authenticated;
grant select, insert, update on table public.robot_uploaded_documents to authenticated;
alter table public.robot_uploaded_documents enable row level security;

create policy robot_uploaded_documents_select
on public.robot_uploaded_documents for select
to authenticated
using (
  deleted_at is null
  and (select private.has_permission('robots.read'))
  and exists (
    select 1 from public.robos as r
    where r.id = robot_uploaded_documents.robot_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_uploaded_documents_insert
on public.robot_uploaded_documents for insert
to authenticated
with check (
  deleted_at is null
  and (select private.has_permission('robots.update'))
  and exists (
    select 1 from public.robos as r
    where r.id = robot_uploaded_documents.robot_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_uploaded_documents_update
on public.robot_uploaded_documents for update
to authenticated
using (
  deleted_at is null
  and (select private.has_permission('robots.update'))
  and exists (
    select 1 from public.robos as r
    where r.id = robot_uploaded_documents.robot_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
)
with check (
  (select private.has_permission('robots.update'))
  and exists (
    select 1 from public.robos as r
    where r.id = robot_uploaded_documents.robot_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'robot-manuals';

create policy robot_manuals_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'robot-manuals'
  and (select private.has_permission('robots.update'))
  and exists (
    select 1 from public.robos as r
    where r.id::text = (storage.foldername(name))[1]
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

alter publication supabase_realtime add table public.robot_uploaded_documents;

comment on table public.robot_uploaded_documents is
  'Metadados dos documentos e anexos privados enviados para cada robô.';
