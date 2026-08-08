alter table public.robos
  add column if not exists disparo text not null default 'Manual',
  add column if not exists gatilho_de_robo_id uuid,
  add column if not exists gatilho_para_robo_id uuid;

alter table public.robos
  add constraint robos_disparo_check
    check (disparo in ('Agendado', 'Manual', 'Gatilho')),
  add constraint robos_gatilho_de_fkey
    foreign key (gatilho_de_robo_id) references public.robos(id) on delete restrict,
  add constraint robos_gatilho_para_fkey
    foreign key (gatilho_para_robo_id) references public.robos(id) on delete restrict,
  add constraint robos_gatilhos_nao_autorreferentes_check
    check (
      gatilho_de_robo_id is distinct from id
      and gatilho_para_robo_id is distinct from id
    );

create index robos_gatilho_de_active_idx
  on public.robos (gatilho_de_robo_id)
  where deleted_at is null and gatilho_de_robo_id is not null;

create index robos_gatilho_para_active_idx
  on public.robos (gatilho_para_robo_id)
  where deleted_at is null and gatilho_para_robo_id is not null;

create or replace function private.validate_robot_trigger_relationships()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.gatilho_de_robo_id is not null and not exists (
    select 1 from public.robos r
    where r.id = new.gatilho_de_robo_id
      and r.cliente_id = new.cliente_id
      and r.deleted_at is null
  ) then
    raise exception 'Gatilho De deve ser um robô ativo do mesmo cliente.' using errcode = '23514';
  end if;

  if new.gatilho_para_robo_id is not null and not exists (
    select 1 from public.robos r
    where r.id = new.gatilho_para_robo_id
      and r.cliente_id = new.cliente_id
      and r.deleted_at is null
  ) then
    raise exception 'Gatilho Para deve ser um robô ativo do mesmo cliente.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_robot_trigger_relationships() from public;

create trigger robos_validate_trigger_relationships
before insert or update of cliente_id, gatilho_de_robo_id, gatilho_para_robo_id
on public.robos
for each row execute function private.validate_robot_trigger_relationships();

comment on column public.robos.disparo is 'Forma de início do robô: Agendado, Manual ou Gatilho.';
comment on column public.robos.gatilho_de_robo_id is 'Robô do mesmo cliente que pode disparar o robô atual.';
comment on column public.robos.gatilho_para_robo_id is 'Robô do mesmo cliente que pode ser disparado pelo robô atual.';
