create table public.personal_page_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  show_robot_table boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.personal_page_flows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  flow_id uuid not null references public.flows(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, flow_id)
);

create index personal_page_flows_user_created_idx
  on public.personal_page_flows (user_id, created_at);

create or replace function private.set_personal_page_preferences_audit()
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

revoke all on function private.set_personal_page_preferences_audit()
  from public, anon, authenticated;

create trigger personal_page_preferences_set_audit
before insert or update on public.personal_page_preferences
for each row execute function private.set_personal_page_preferences_audit();

create or replace function private.set_personal_page_flow_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

revoke all on function private.set_personal_page_flow_owner()
  from public, anon, authenticated;

create trigger personal_page_flows_set_owner
before insert on public.personal_page_flows
for each row execute function private.set_personal_page_flow_owner();

revoke all on table public.personal_page_preferences, public.personal_page_flows from anon, authenticated;
grant select, insert, update on table public.personal_page_preferences to authenticated;
grant select, insert, delete on table public.personal_page_flows to authenticated;

alter table public.personal_page_preferences enable row level security;
alter table public.personal_page_flows enable row level security;

create policy personal_page_preferences_select_own
on public.personal_page_preferences for select to authenticated
using ((select auth.uid()) = user_id);
create policy personal_page_preferences_insert_own
on public.personal_page_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy personal_page_preferences_update_own
on public.personal_page_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy personal_page_flows_select_own
on public.personal_page_flows for select to authenticated
using ((select auth.uid()) = user_id);
create policy personal_page_flows_insert_own
on public.personal_page_flows for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.flows where id = flow_id)
);
create policy personal_page_flows_delete_own
on public.personal_page_flows for delete to authenticated
using ((select auth.uid()) = user_id);

comment on table public.personal_page_preferences is
  'Preferências pessoais dos widgets exibidos em Minha página.';
comment on table public.personal_page_flows is
  'Fluxos escolhidos pelo usuário para acesso rápido em Minha página.';
