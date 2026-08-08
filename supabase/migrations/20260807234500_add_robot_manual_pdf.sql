alter table public.robos
  add column if not exists manual_path text,
  add column if not exists manual_nome text;

alter table public.robos
  add constraint robos_manual_consistente_check check (
    (manual_path is null and manual_nome is null)
    or (btrim(manual_path) <> '' and btrim(manual_nome) <> '')
  );

comment on column public.robos.manual_path is 'Caminho privado do manual PDF no bucket robot-manuals.';
comment on column public.robos.manual_nome is 'Nome original do manual PDF exibido na aplicação.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('robot-manuals', 'robot-manuals', false, 20971520, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy robot_manuals_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'robot-manuals'
  and (select private.has_permission('robots.read'))
  and exists (
    select 1
    from public.robos as r
    where r.id::text = (storage.foldername(name))[1]
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_manuals_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'robot-manuals'
  and (select private.has_permission('robots.update'))
  and exists (
    select 1
    from public.robos as r
    where r.id::text = (storage.foldername(name))[1]
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy robot_manuals_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'robot-manuals'
  and (select private.has_permission('robots.update'))
  and exists (
    select 1
    from public.robos as r
    where r.id::text = (storage.foldername(name))[1]
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
)
with check (
  bucket_id = 'robot-manuals'
  and (select private.has_permission('robots.update'))
  and exists (
    select 1
    from public.robos as r
    where r.id::text = (storage.foldername(name))[1]
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);
