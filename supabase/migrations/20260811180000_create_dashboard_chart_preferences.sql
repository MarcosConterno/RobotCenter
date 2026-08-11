-- Preferências modulares de quadros gráficos por usuário.

begin;

create table public.dashboard_chart_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_chart_preferences_cards_array
    check (jsonb_typeof(cards) = 'array'),
  constraint dashboard_chart_preferences_cards_limit
    check (jsonb_array_length(cards) <= 20),
  constraint dashboard_chart_preferences_cards_size
    check (octet_length(cards::text) <= 30000)
);

create or replace function private.set_dashboard_chart_preferences_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_dashboard_chart_preferences_updated_at()
  from public, anon, authenticated;

create trigger dashboard_chart_preferences_set_updated_at
before update on public.dashboard_chart_preferences
for each row execute function private.set_dashboard_chart_preferences_updated_at();

alter table public.dashboard_chart_preferences enable row level security;
revoke all on table public.dashboard_chart_preferences from anon, authenticated;
grant select, insert, update, delete on table public.dashboard_chart_preferences to authenticated;

create policy dashboard_chart_preferences_select_own
on public.dashboard_chart_preferences for select
to authenticated
using ((select auth.uid()) = user_id);

create policy dashboard_chart_preferences_insert_own
on public.dashboard_chart_preferences for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy dashboard_chart_preferences_update_own
on public.dashboard_chart_preferences for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy dashboard_chart_preferences_delete_own
on public.dashboard_chart_preferences for delete
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.dashboard_chart_preferences is
  'Configuração individual dos quadros gráficos da Dashboard, limitada a 20 cards.';

commit;
