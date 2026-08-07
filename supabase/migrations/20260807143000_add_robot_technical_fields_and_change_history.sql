-- Amplia os dados técnicos do robô e transforma alterações em histórico imutável.
alter table public.robos
  add column court_name text not null default 'Não informado',
  add column ideal integer not null default 0,
  add column max integer not null default 0,
  add constraint robos_court_name_not_blank check (btrim(court_name) <> ''),
  add constraint robos_ideal_nonnegative check (ideal >= 0),
  add constraint robos_max_greater_or_equal_ideal check (max >= ideal);

create table public.alteracoes_robo (
  id uuid primary key default gen_random_uuid(),
  robo_id uuid not null references public.robos(id) on delete restrict,
  descricao text not null,
  realizada_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  constraint alteracoes_robo_descricao_not_blank check (btrim(descricao) <> '')
);

insert into public.alteracoes_robo (robo_id, descricao, realizada_em, created_at, created_by)
select id, alteracao_realizada, updated_at, updated_at, updated_by
from public.robos
where btrim(alteracao_realizada) <> '';

create index alteracoes_robo_robo_realizada_idx
  on public.alteracoes_robo (robo_id, realizada_em desc);

revoke all on table public.alteracoes_robo from anon, authenticated;
grant select, insert on table public.alteracoes_robo to authenticated;

alter table public.alteracoes_robo enable row level security;

create policy alteracoes_robo_select
on public.alteracoes_robo for select
to authenticated
using (
  (select private.has_permission('robots.read'))
  and exists (
    select 1
    from public.robos as r
    where r.id = alteracoes_robo.robo_id
      and r.deleted_at is null
      and (select private.can_access_cliente(r.cliente_id))
  )
);

create policy alteracoes_robo_insert_staff
on public.alteracoes_robo for insert
to authenticated
with check (
  (select private.has_permission('robots.update'))
  and exists (
    select 1
    from public.robos as r
    where r.id = alteracoes_robo.robo_id
      and r.deleted_at is null
  )
);

comment on table public.alteracoes_robo is
  'Histórico imutável das alterações registradas para cada robô.';
