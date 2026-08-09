create table public.user_tutorial_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tutorial_key text not null,
  tutorial_version integer not null,
  status text not null default 'not_started',
  current_step integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_tutorial_progress_key_not_blank check (btrim(tutorial_key) <> ''),
  constraint user_tutorial_progress_version_positive check (tutorial_version > 0),
  constraint user_tutorial_progress_step_nonnegative check (current_step >= 0),
  constraint user_tutorial_progress_status_check check (
    status in ('not_started', 'in_progress', 'completed', 'skipped')
  ),
  constraint user_tutorial_progress_user_tutorial_version_key
    unique (user_id, tutorial_key, tutorial_version)
);

create index user_tutorial_progress_user_updated_idx
  on public.user_tutorial_progress (user_id, updated_at desc);

create or replace function private.set_user_tutorial_progress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.user_id := old.user_id;
  new.tutorial_key := old.tutorial_key;
  new.tutorial_version := old.tutorial_version;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_user_tutorial_progress_updated_at()
  from public, anon, authenticated;

create trigger user_tutorial_progress_set_updated_at
before update on public.user_tutorial_progress
for each row execute function private.set_user_tutorial_progress_updated_at();

revoke all on table public.user_tutorial_progress from anon, authenticated;
grant select, insert, update on table public.user_tutorial_progress to authenticated;

alter table public.user_tutorial_progress enable row level security;

create policy user_tutorial_progress_select_own
on public.user_tutorial_progress for select to authenticated
using ((select auth.uid()) = user_id);

create policy user_tutorial_progress_insert_own
on public.user_tutorial_progress for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy user_tutorial_progress_update_own
on public.user_tutorial_progress for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
