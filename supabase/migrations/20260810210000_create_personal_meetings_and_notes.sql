begin;

set local lock_timeout = '30s';
set local statement_timeout = '120s';

-- Mantém uma ordem única de locks durante a criação das relações de origem.
-- Consultas concorrentes aguardam esta transação curta em vez de formar um ciclo.
lock table public.personal_tasks in access exclusive mode;

create table public.personal_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  meeting_date date not null,
  meeting_time time not null,
  participants text,
  notes text not null default '',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_meetings_name_not_blank check (btrim(name) <> '')
);

create table public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_notes_title_not_blank check (btrim(title) <> '')
);

alter table public.personal_tasks
  add column origin_meeting_id uuid references public.personal_meetings(id) on delete set null,
  add column origin_note_id uuid references public.personal_notes(id) on delete set null,
  add constraint personal_tasks_single_origin check (
    not (origin_meeting_id is not null and origin_note_id is not null)
  );

create index personal_meetings_user_schedule_idx
  on public.personal_meetings (user_id, meeting_date, meeting_time);
create index personal_notes_user_updated_idx
  on public.personal_notes (user_id, updated_at desc);
create index personal_tasks_origin_meeting_idx
  on public.personal_tasks (origin_meeting_id) where origin_meeting_id is not null;
create index personal_tasks_origin_note_idx
  on public.personal_tasks (origin_note_id) where origin_note_id is not null;

create or replace function private.set_personal_content_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.created_at := now();
    new.updated_at := new.created_at;
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.set_personal_content_audit_fields()
  from public, anon, authenticated;

create trigger personal_meetings_set_audit_fields
before insert or update on public.personal_meetings
for each row execute function private.set_personal_content_audit_fields();
create trigger personal_notes_set_audit_fields
before insert or update on public.personal_notes
for each row execute function private.set_personal_content_audit_fields();

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
    if new.status = 'completed' then new.completed_at := coalesce(new.completed_at, now());
    else new.completed_at := null;
    end if;
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
    if new.status = 'completed' and old.status <> 'completed' then new.completed_at := now();
    elsif new.status = 'pending' then new.completed_at := null;
    else new.completed_at := old.completed_at;
    end if;
  end if;

  if new.origin_meeting_id is not null and not exists (
    select 1 from public.personal_meetings
    where id = new.origin_meeting_id and user_id = new.user_id
  ) then
    raise exception 'Reunião de origem inválida.' using errcode = '42501';
  end if;
  if new.origin_note_id is not null and not exists (
    select 1 from public.personal_notes
    where id = new.origin_note_id and user_id = new.user_id
  ) then
    raise exception 'Nota de origem inválida.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on table public.personal_meetings, public.personal_notes from anon, authenticated;
grant select, insert, update, delete on table public.personal_meetings, public.personal_notes to authenticated;
alter table public.personal_meetings enable row level security;
alter table public.personal_notes enable row level security;

create policy personal_meetings_select_own on public.personal_meetings for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_meetings_insert_own on public.personal_meetings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_meetings_update_own on public.personal_meetings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy personal_meetings_delete_own on public.personal_meetings for delete to authenticated using ((select auth.uid()) = user_id);
create policy personal_notes_select_own on public.personal_notes for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_notes_insert_own on public.personal_notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_notes_update_own on public.personal_notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy personal_notes_delete_own on public.personal_notes for delete to authenticated using ((select auth.uid()) = user_id);

comment on table public.personal_meetings is 'Caderno pessoal de reuniões, isolado por usuário via RLS.';
comment on table public.personal_notes is 'Notas livres pessoais, isoladas por usuário via RLS.';

commit;
