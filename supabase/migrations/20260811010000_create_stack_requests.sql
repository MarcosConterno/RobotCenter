-- Solicitações de Stack vinculadas aos robôs, com RBAC, auditoria e RLS.

alter table public.robos alter column stack drop not null;
alter table public.robos alter column stack_id drop not null;
alter table public.robos drop constraint if exists robos_stack_not_blank;
alter table public.robos add constraint robos_stack_not_blank
  check (stack is null or btrim(stack) <> '');

insert into public.roles (codigo, nome, descricao, ativo)
values ('head_setor', 'Head Setor', 'Analisa e acompanha solicitações operacionais do setor.', true)
on conflict (codigo) do update set nome = excluded.nome, descricao = excluded.descricao, ativo = true;

insert into public.permissions (codigo, recurso, acao, descricao, ativo)
values
  ('stack_requests.read', 'stack_requests', 'read', 'Visualizar solicitações de Stack.', true),
  ('stack_requests.create', 'stack_requests', 'create', 'Criar solicitações de Stack para um robô.', true),
  ('stack_requests.respond', 'stack_requests', 'respond', 'Responder pedidos de informação.', true),
  ('stack_requests.update', 'stack_requests', 'update', 'Editar os dados técnicos da solicitação.', true),
  ('stack_requests.status', 'stack_requests', 'status', 'Alterar o status da solicitação.', true),
  ('stack_requests.request_info', 'stack_requests', 'request_info', 'Solicitar informações adicionais.', true),
  ('stack_requests.complete', 'stack_requests', 'complete', 'Concluir a solicitação e informar a Stack gerada.', true),
  ('stack_requests.cancel', 'stack_requests', 'cancel', 'Cancelar uma solicitação de Stack.', true),
  ('stack_requests.history', 'stack_requests', 'history', 'Visualizar o histórico das solicitações.', true)
on conflict (codigo) do update
set recurso = excluded.recurso, acao = excluded.acao, descricao = excluded.descricao, ativo = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.codigo in ('master', 'admin') and p.recurso = 'stack_requests'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.codigo = 'head_setor'
  and p.codigo in ('stack_requests.read', 'stack_requests.create', 'stack_requests.respond', 'stack_requests.update', 'stack_requests.status', 'stack_requests.request_info', 'stack_requests.complete', 'stack_requests.cancel', 'stack_requests.history')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.codigo = 'operador' and p.codigo in ('stack_requests.read', 'stack_requests.history')
on conflict (role_id, permission_id) do nothing;

create table public.stack_requests (
  id uuid primary key default gen_random_uuid(),
  robot_id uuid not null references public.robos(id) on delete restrict,
  suggested_stack_name text not null check (btrim(suggested_stack_name) <> ''),
  queue_id uuid references public.robot_queues(id) on delete restrict,
  type text not null check (btrim(type) <> ''),
  job text not null check (btrim(job) <> ''),
  status text not null default 'SOLICITADA' check (status in ('SOLICITADA', 'EM_ANALISE', 'AGUARDANDO_INFORMACAO', 'CONCLUIDA', 'CANCELADA')),
  generated_stack text check (generated_stack is null or btrim(generated_stack) <> ''),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint stack_requests_completion_check check (
    (status = 'CONCLUIDA' and generated_stack is not null and completed_at is not null)
    or (status <> 'CONCLUIDA' and completed_at is null)
  )
);

create table public.stack_request_history (
  id uuid primary key default gen_random_uuid(),
  stack_request_id uuid not null references public.stack_requests(id) on delete restrict,
  event_type text not null check (event_type in ('CRIADA', 'EDITADA', 'STATUS_ALTERADO', 'INFORMACAO_SOLICITADA', 'RESPOSTA', 'CONCLUIDA', 'CANCELADA')),
  message text check (message is null or btrim(message) <> ''),
  previous_status text,
  new_status text,
  changes jsonb not null default '{}'::jsonb check (jsonb_typeof(changes) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict
);

create index stack_requests_robot_requested_idx on public.stack_requests (robot_id, requested_at desc);
create index stack_requests_status_requested_idx on public.stack_requests (status, requested_at desc);
create index stack_request_history_request_created_idx on public.stack_request_history (stack_request_id, created_at desc);

create or replace function private.stack_requests_role_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select not private.has_role('cliente')
     and not private.has_role('suporte')
     and not private.has_role('dev');
$$;

create or replace function private.audit_stack_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.stack_request_history (stack_request_id, event_type, new_status, changes, created_by)
    values (new.id, 'CRIADA', new.status, jsonb_build_object('suggested_stack_name', new.suggested_stack_name, 'type', new.type, 'job', new.job), new.created_by);
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'CONCLUIDA' and not private.has_permission('stack_requests.complete') then
      raise exception 'Sem permissão para concluir a solicitação.' using errcode = '42501';
    elsif new.status = 'CANCELADA' and not private.has_permission('stack_requests.cancel') then
      raise exception 'Sem permissão para cancelar a solicitação.' using errcode = '42501';
    elsif new.status not in ('CONCLUIDA', 'CANCELADA') and not private.has_permission('stack_requests.status') then
      raise exception 'Sem permissão para alterar o status.' using errcode = '42501';
    end if;
  end if;
  if (new.suggested_stack_name, new.queue_id, new.type, new.job, new.generated_stack)
      is distinct from (old.suggested_stack_name, old.queue_id, old.type, old.job, old.generated_stack)
     and not private.has_permission('stack_requests.update') then
    raise exception 'Sem permissão para editar a solicitação.' using errcode = '42501';
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.status = 'CONCLUIDA' and old.status <> 'CONCLUIDA' then
    new.completed_at := now(); event_name := 'CONCLUIDA';
  elsif new.status <> 'CONCLUIDA' then
    new.completed_at := null;
    event_name := case when new.status = 'CANCELADA' then 'CANCELADA' when new.status <> old.status then 'STATUS_ALTERADO' else 'EDITADA' end;
  else
    event_name := case when new.status <> old.status then 'STATUS_ALTERADO' else 'EDITADA' end;
  end if;

  insert into public.stack_request_history (stack_request_id, event_type, previous_status, new_status, changes, created_by)
  values (new.id, event_name, old.status, new.status,
    jsonb_strip_nulls(jsonb_build_object(
      'suggested_stack_name', case when new.suggested_stack_name is distinct from old.suggested_stack_name then jsonb_build_array(old.suggested_stack_name, new.suggested_stack_name) end,
      'queue_id', case when new.queue_id is distinct from old.queue_id then jsonb_build_array(old.queue_id, new.queue_id) end,
      'type', case when new.type is distinct from old.type then jsonb_build_array(old.type, new.type) end,
      'job', case when new.job is distinct from old.job then jsonb_build_array(old.job, new.job) end,
      'generated_stack', case when new.generated_stack is distinct from old.generated_stack then jsonb_build_array(old.generated_stack, new.generated_stack) end
    )), coalesce(auth.uid(), new.updated_by, new.created_by));
  return new;
end;
$$;

create trigger stack_requests_audit_insert after insert on public.stack_requests
for each row execute function private.audit_stack_request();
create trigger stack_requests_audit_update before update on public.stack_requests
for each row execute function private.audit_stack_request();

alter table public.stack_requests enable row level security;
alter table public.stack_request_history enable row level security;
revoke all on public.stack_requests, public.stack_request_history from anon, authenticated;
grant select, insert, update on public.stack_requests to authenticated;
grant select, insert on public.stack_request_history to authenticated;

create policy stack_requests_select_allowed on public.stack_requests for select to authenticated
using (private.stack_requests_role_allowed() and private.has_permission('stack_requests.read'));
create policy stack_requests_insert_allowed on public.stack_requests for insert to authenticated
with check (private.stack_requests_role_allowed() and private.has_permission('stack_requests.create') and created_by = auth.uid());
create policy stack_requests_update_allowed on public.stack_requests for update to authenticated
using (private.stack_requests_role_allowed() and (
  private.has_permission('stack_requests.update') or private.has_permission('stack_requests.status')
  or private.has_permission('stack_requests.complete') or private.has_permission('stack_requests.cancel')
))
with check (private.stack_requests_role_allowed() and (
  private.has_permission('stack_requests.update') or private.has_permission('stack_requests.status')
  or private.has_permission('stack_requests.complete') or private.has_permission('stack_requests.cancel')
));

create policy stack_request_history_select_allowed on public.stack_request_history for select to authenticated
using (private.stack_requests_role_allowed() and private.has_permission('stack_requests.history'));
create policy stack_request_history_insert_allowed on public.stack_request_history for insert to authenticated
with check (
  private.stack_requests_role_allowed()
  and created_by = auth.uid()
  and (
    (event_type = 'INFORMACAO_SOLICITADA' and private.has_permission('stack_requests.request_info'))
    or (event_type = 'RESPOSTA' and private.has_permission('stack_requests.respond'))
  )
);

alter publication supabase_realtime add table public.stack_requests;

comment on table public.stack_requests is 'Solicitações operacionais de Stack relacionadas a robôs.';
comment on table public.stack_request_history is 'Histórico imutável de eventos e mensagens das solicitações de Stack.';
