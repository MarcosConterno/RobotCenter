alter table public.personal_tasks
  drop constraint personal_tasks_completion_consistent,
  drop constraint personal_tasks_priority_check,
  drop constraint personal_tasks_status_check;

update public.personal_tasks
set status = 'todo'
where status = 'pending';

alter table public.personal_tasks
  add column client_id uuid,
  alter column status set default 'todo',
  add constraint personal_tasks_client_id_fkey
    foreign key (client_id) references public.clientes(id) on delete set null,
  add constraint personal_tasks_priority_check
    check (priority in ('urgent', 'high', 'medium', 'low')),
  add constraint personal_tasks_status_check
    check (status in (
      'open_task',
      'budget',
      'todo',
      'waiting_server_update',
      'waiting_stack',
      'testing',
      'waiting_dev',
      'waiting_client',
      'in_progress',
      'completed'
    )),
  add constraint personal_tasks_completion_consistent
    check (
      (status = 'completed' and completed_at is not null)
      or (status <> 'completed' and completed_at is null)
    );

create index personal_tasks_client_id_idx
  on public.personal_tasks (client_id)
  where client_id is not null;

comment on column public.personal_tasks.client_id is
  'Cliente opcional relacionado ao ToDo; a visibilidade do cliente continua limitada pelas policies de clientes.';

comment on column public.personal_tasks.status is
  'Fluxo operacional do ToDo; novos registros iniciam em todo (A Fazer).';

create or replace function private.set_personal_task_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.created_at := now();
    new.updated_at := new.created_at;
    if new.status = 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
    end if;
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
    if new.status = 'completed' and old.status <> 'completed' then
      new.completed_at := now();
    elsif new.status <> 'completed' then
      new.completed_at := null;
    else
      new.completed_at := old.completed_at;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.set_personal_task_audit_fields()
  from public, anon, authenticated;
