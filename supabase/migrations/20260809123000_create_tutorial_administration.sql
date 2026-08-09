insert into public.permissions (codigo, recurso, acao, descricao, ativo)
values ('tutorials.manage', 'tutorials', 'manage', 'Permite criar, editar, testar e publicar tutoriais do Robot Center.', true)
on conflict (codigo) do update
set recurso = excluded.recurso,
    acao = excluded.acao,
    descricao = excluded.descricao,
    ativo = true,
    updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
cross join public.permissions as permission
where role.codigo in ('admin', 'master')
  and permission.codigo = 'tutorials.manage'
on conflict do nothing;

create table public.tutorials (
  id uuid primary key default gen_random_uuid(),
  tutorial_key text not null unique,
  nome text not null,
  audience_role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'draft',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint tutorials_key_not_blank check (btrim(tutorial_key) <> ''),
  constraint tutorials_nome_not_blank check (btrim(nome) <> ''),
  constraint tutorials_status_check check (status in ('draft', 'published', 'inactive'))
);

create table public.tutorial_drafts (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null unique references public.tutorials(id) on delete cascade,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint tutorial_drafts_revision_nonnegative check (revision >= 0)
);

create table public.tutorial_steps (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.tutorial_drafts(id) on delete cascade,
  ordem integer not null,
  page_key text not null,
  target_key text not null,
  titulo text not null,
  descricao text not null,
  placement text not null default 'bottom',
  condition_key text,
  habilitado boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint tutorial_steps_order_positive check (ordem > 0),
  constraint tutorial_steps_page_not_blank check (btrim(page_key) <> ''),
  constraint tutorial_steps_target_not_blank check (btrim(target_key) <> ''),
  constraint tutorial_steps_title_not_blank check (btrim(titulo) <> ''),
  constraint tutorial_steps_placement_check check (placement in ('top', 'right', 'bottom', 'left')),
  constraint tutorial_steps_draft_order_key unique (draft_id, ordem)
);

create table public.tutorial_versions (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutorials(id) on delete restrict,
  version integer not null,
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references public.profiles(id) on delete restrict,
  constraint tutorial_versions_version_positive check (version > 0),
  constraint tutorial_versions_snapshot_object check (jsonb_typeof(snapshot) = 'object'),
  constraint tutorial_versions_tutorial_version_key unique (tutorial_id, version)
);

alter table public.tutorials
  add constraint tutorials_current_version_id_fkey
  foreign key (current_version_id) references public.tutorial_versions(id) on delete restrict;

alter table public.user_tutorial_progress
  add column tutorial_id uuid references public.tutorials(id) on delete restrict;

create index tutorials_audience_status_idx on public.tutorials (audience_role_id, status);
create index tutorial_steps_draft_order_idx on public.tutorial_steps (draft_id, ordem);
create index tutorial_versions_tutorial_published_idx on public.tutorial_versions (tutorial_id, published_at desc);
create index user_tutorial_progress_tutorial_idx on public.user_tutorial_progress (tutorial_id, tutorial_version);

create or replace function private.set_tutorial_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := coalesce(new.updated_by, new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function private.set_tutorial_audit_fields() from public, anon, authenticated;

create trigger tutorials_set_audit before insert or update on public.tutorials
for each row execute function private.set_tutorial_audit_fields();
create trigger tutorial_drafts_set_audit before insert or update on public.tutorial_drafts
for each row execute function private.set_tutorial_audit_fields();
create trigger tutorial_steps_set_audit before insert or update on public.tutorial_steps
for each row execute function private.set_tutorial_audit_fields();

create or replace function private.prevent_tutorial_version_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Versões publicadas de tutorial são imutáveis.' using errcode = '55000';
end;
$$;
revoke all on function private.prevent_tutorial_version_mutation() from public, anon, authenticated;
create trigger tutorial_versions_immutable before update or delete on public.tutorial_versions
for each row execute function private.prevent_tutorial_version_mutation();

revoke all on table public.tutorials, public.tutorial_drafts, public.tutorial_steps, public.tutorial_versions from anon, authenticated;
grant select, insert, update on public.tutorials, public.tutorial_drafts, public.tutorial_steps to authenticated;
grant delete on public.tutorial_steps to authenticated;
grant select, insert on public.tutorial_versions to authenticated;

alter table public.tutorials enable row level security;
alter table public.tutorial_drafts enable row level security;
alter table public.tutorial_steps enable row level security;
alter table public.tutorial_versions enable row level security;

create policy tutorials_select_allowed on public.tutorials for select to authenticated
using (
  (select private.has_role('master'))
  or (select private.has_permission('tutorials.manage'))
  or (
    status = 'published'
    and current_version_id is not null
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid()) and ur.role_id = tutorials.audience_role_id
    )
  )
);
create policy tutorials_insert_manager on public.tutorials for insert to authenticated
with check ((select private.has_role('master')) or (select private.has_permission('tutorials.manage')));
create policy tutorials_update_manager on public.tutorials for update to authenticated
using ((select private.has_role('master')) or (select private.has_permission('tutorials.manage')))
with check ((select private.has_role('master')) or (select private.has_permission('tutorials.manage')));

create policy tutorial_drafts_manager_all on public.tutorial_drafts for all to authenticated
using ((select private.has_role('master')) or (select private.has_permission('tutorials.manage')))
with check ((select private.has_role('master')) or (select private.has_permission('tutorials.manage')));
create policy tutorial_steps_manager_all on public.tutorial_steps for all to authenticated
using ((select private.has_role('master')) or (select private.has_permission('tutorials.manage')))
with check ((select private.has_role('master')) or (select private.has_permission('tutorials.manage')));

create policy tutorial_versions_select_allowed on public.tutorial_versions for select to authenticated
using (
  (select private.has_role('master'))
  or (select private.has_permission('tutorials.manage'))
  or exists (
    select 1 from public.tutorials tutorial
    join public.user_roles ur on ur.role_id = tutorial.audience_role_id
    where tutorial.id = tutorial_versions.tutorial_id
      and tutorial.status = 'published'
      and tutorial.current_version_id = tutorial_versions.id
      and ur.user_id = (select auth.uid())
  )
);
create policy tutorial_versions_insert_manager on public.tutorial_versions for insert to authenticated
with check (
  ((select private.has_role('master')) or (select private.has_permission('tutorials.manage')))
  and published_by = (select auth.uid())
);

create or replace function public.create_tutorial(target_name text, target_audience_role_id uuid)
returns table (tutorial_id uuid, draft_id uuid)
language plpgsql security invoker set search_path = '' as $$
declare
  new_tutorial_id uuid;
  new_draft_id uuid;
begin
  if auth.uid() is null or (not private.has_role('master') and not private.has_permission('tutorials.manage')) then
    raise exception 'Sem permissão para criar tutoriais.' using errcode = '42501';
  end if;
  if btrim(coalesce(target_name, '')) = '' then
    raise exception 'Nome do tutorial é obrigatório.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.roles where id = target_audience_role_id and ativo) then
    raise exception 'Público inválido.' using errcode = '22023';
  end if;

  insert into public.tutorials (tutorial_key, nome, audience_role_id, created_by)
  values ('tutorial-' || gen_random_uuid()::text, btrim(target_name), target_audience_role_id, auth.uid())
  returning id into new_tutorial_id;
  insert into public.tutorial_drafts (tutorial_id, created_by)
  values (new_tutorial_id, auth.uid()) returning id into new_draft_id;
  return query select new_tutorial_id, new_draft_id;
end;
$$;

create or replace function public.save_tutorial_draft(
  target_tutorial_id uuid,
  target_name text,
  target_audience_role_id uuid,
  target_steps jsonb
)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  target_draft_id uuid;
  step_item jsonb;
  step_order integer := 0;
  step_placement text;
begin
  if auth.uid() is null or (not private.has_role('master') and not private.has_permission('tutorials.manage')) then
    raise exception 'Sem permissão para editar tutoriais.' using errcode = '42501';
  end if;
  if btrim(coalesce(target_name, '')) = '' or jsonb_typeof(target_steps) <> 'array' then
    raise exception 'Rascunho inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.roles where id = target_audience_role_id and ativo) then
    raise exception 'Público inválido.' using errcode = '22023';
  end if;

  select id into target_draft_id from public.tutorial_drafts where tutorial_id = target_tutorial_id;
  if target_draft_id is null then raise exception 'Rascunho não encontrado.' using errcode = 'P0002'; end if;

  update public.tutorials set nome = btrim(target_name), audience_role_id = target_audience_role_id
  where id = target_tutorial_id;
  delete from public.tutorial_steps where draft_id = target_draft_id;

  for step_item in select value from jsonb_array_elements(target_steps)
  loop
    step_order := step_order + 1;
    step_placement := coalesce(step_item ->> 'placement', 'bottom');
    if btrim(coalesce(step_item ->> 'pageKey', '')) = ''
      or btrim(coalesce(step_item ->> 'targetKey', '')) = ''
      or btrim(coalesce(step_item ->> 'title', '')) = ''
      or step_placement not in ('top', 'right', 'bottom', 'left') then
      raise exception 'Passo % inválido.', step_order using errcode = '22023';
    end if;
    insert into public.tutorial_steps (
      draft_id, ordem, page_key, target_key, titulo, descricao, placement,
      condition_key, habilitado, created_by
    ) values (
      target_draft_id, step_order, step_item ->> 'pageKey', step_item ->> 'targetKey',
      btrim(step_item ->> 'title'), coalesce(step_item ->> 'description', ''), step_placement,
      nullif(step_item ->> 'conditionKey', ''), coalesce((step_item ->> 'enabled')::boolean, true), auth.uid()
    );
  end loop;
  update public.tutorial_drafts set revision = revision + 1 where id = target_draft_id;
end;
$$;

revoke all on function public.create_tutorial(text, uuid) from public, anon;
revoke all on function public.save_tutorial_draft(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.create_tutorial(text, uuid) to authenticated;
grant execute on function public.save_tutorial_draft(uuid, text, uuid, jsonb) to authenticated;

create or replace function public.publish_tutorial(target_tutorial_id uuid)
returns table (version_id uuid, version_number integer)
language plpgsql security invoker set search_path = '' as $$
declare
  target public.tutorials%rowtype;
  target_draft_id uuid;
  next_version integer;
  new_version_id uuid;
  version_snapshot jsonb;
begin
  if auth.uid() is null or (not private.has_role('master') and not private.has_permission('tutorials.manage')) then
    raise exception 'Sem permissão para publicar tutoriais.' using errcode = '42501';
  end if;

  select * into target from public.tutorials where id = target_tutorial_id for update;
  if target.id is null then raise exception 'Tutorial não encontrado.' using errcode = 'P0002'; end if;
  select id into target_draft_id from public.tutorial_drafts where tutorial_id = target.id;
  if target_draft_id is null then raise exception 'Rascunho não encontrado.' using errcode = 'P0002'; end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.tutorial_versions where tutorial_id = target.id;

  version_snapshot := jsonb_build_object(
    'tutorialId', target.id,
    'tutorialKey', target.tutorial_key,
    'name', target.nome,
    'audienceRoleId', target.audience_role_id,
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', step.id, 'order', step.ordem, 'pageKey', step.page_key,
        'targetKey', step.target_key, 'title', step.titulo,
        'description', step.descricao, 'placement', step.placement,
        'conditionKey', step.condition_key, 'enabled', step.habilitado
      ) order by step.ordem)
      from public.tutorial_steps step where step.draft_id = target_draft_id
    ), '[]'::jsonb)
  );

  insert into public.tutorial_versions (tutorial_id, version, snapshot, published_by)
  values (target.id, next_version, version_snapshot, auth.uid()) returning id into new_version_id;

  update public.tutorials set status = 'published', current_version_id = new_version_id where id = target.id;
  return query select new_version_id, next_version;
end;
$$;

revoke all on function public.publish_tutorial(uuid) from public, anon;
grant execute on function public.publish_tutorial(uuid) to authenticated;
