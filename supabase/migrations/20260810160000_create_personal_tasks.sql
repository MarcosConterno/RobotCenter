create table public.personal_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  note text,
  due_date date not null,
  priority text not null default 'medium',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint personal_tasks_title_not_blank check (btrim(title) <> ''),
  constraint personal_tasks_priority_check check (priority in ('low', 'medium', 'high')),
  constraint personal_tasks_status_check check (status in ('pending', 'completed')),
  constraint personal_tasks_completion_consistent check (
    (status = 'pending' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  )
);

create index personal_tasks_user_due_date_idx
  on public.personal_tasks (user_id, due_date, created_at);

create index personal_tasks_user_status_due_date_idx
  on public.personal_tasks (user_id, status, due_date);

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
    elsif new.status = 'pending' then
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

create trigger personal_tasks_set_audit_fields
before insert or update on public.personal_tasks
for each row execute function private.set_personal_task_audit_fields();

revoke all on table public.personal_tasks from anon, authenticated;
grant select, insert, update, delete on table public.personal_tasks to authenticated;

alter table public.personal_tasks enable row level security;

create policy personal_tasks_select_own
on public.personal_tasks for select to authenticated
using ((select auth.uid()) = user_id);

create policy personal_tasks_insert_own
on public.personal_tasks for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy personal_tasks_update_own
on public.personal_tasks for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy personal_tasks_delete_own
on public.personal_tasks for delete to authenticated
using ((select auth.uid()) = user_id);

comment on table public.personal_tasks is
  'Tarefas pessoais da área Minha página, isoladas por usuário autenticado via RLS.';
