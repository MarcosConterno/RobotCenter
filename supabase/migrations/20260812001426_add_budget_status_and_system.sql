create table public.robot_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  constraint robot_systems_name_not_blank check (btrim(name) <> '')
);

create unique index robot_systems_name_key
  on public.robot_systems (lower(btrim(name)));

alter table public.robot_systems enable row level security;
revoke all on table public.robot_systems from anon, authenticated;
grant select, insert, update on table public.robot_systems to authenticated;

create policy robot_systems_select on public.robot_systems
  for select to authenticated
  using ((select private.has_permission('robot_catalog.read')));
create policy robot_systems_insert on public.robot_systems
  for insert to authenticated
  with check ((select private.has_permission('robot_catalog.manage')));
create policy robot_systems_update on public.robot_systems
  for update to authenticated
  using ((select private.has_permission('robot_catalog.manage')))
  with check ((select private.has_permission('robot_catalog.manage')));

create trigger robot_systems_set_audit_fields
  before insert or update on public.robot_systems
  for each row execute function private.set_row_audit_fields();

insert into public.robot_systems (name)
select min(btrim(sistema))
from public.robos
where btrim(sistema) <> ''
group by lower(btrim(sistema))
on conflict do nothing;

alter table public.robos
  add column system_id uuid references public.robot_systems(id) on delete restrict;
create index robos_system_id_idx on public.robos(system_id);

update public.robos r
set system_id = s.id
from public.robot_systems s
where lower(btrim(r.sistema)) = lower(btrim(s.name));

create or replace function private.sync_robot_system_values()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.robos set sistema = new.name where system_id = new.id;
  insert into public.publicacoes(robo_id,categoria,descricao)
  select id,'Atualização do Robô','Sistema atualizado pelo cadastro central: '||new.name||'.'
  from public.robos where system_id=new.id and deleted_at is null;
  return new;
end $$;
revoke all on function private.sync_robot_system_values() from public, anon, authenticated;
create trigger robot_systems_sync_robots
  after update of name on public.robot_systems
  for each row when (old.name is distinct from new.name)
  execute function private.sync_robot_system_values();

alter table public.budgets
  add column system_id uuid references public.robot_systems(id) on delete set null;
create index budgets_system_created_idx
  on public.budgets (system_id, created_at desc)
  where deleted_at is null and system_id is not null;

update public.permissions
set descricao = 'Gerenciar sistemas, pacotes, stacks, commands e filas.'
where codigo = 'robot_catalog.manage';

alter table public.budgets drop constraint if exists budgets_status_valid;
update public.budgets set status = 'novo' where status in ('draft', 'finalized');
alter table public.budgets alter column status set default 'novo';
alter table public.budgets add constraint budgets_status_valid check (
  status in ('novo', 'enviado_comercial', 'projeto_rejeitado', 'arquivado', 'aprovado')
);

drop function if exists public.save_budget(uuid,text,text,text,text,numeric,numeric,uuid,jsonb);

create function public.save_budget(
  p_budget_id uuid,
  p_project_name text,
  p_source text,
  p_source_file_name text,
  p_source_content text,
  p_hourly_rate numeric,
  p_commission_percent numeric,
  p_client_id uuid,
  p_system_id uuid,
  p_status text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_id uuid;
  target_status text;
  calculated_hours numeric(12,2);
  calculated_subtotal numeric(14,2);
  calculated_total numeric(14,2);
begin
  if auth.uid() is null or (not private.has_role('master') and not private.has_role('admin')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_project_name, '')) = '' then
    raise exception 'Nome do projeto é obrigatório.' using errcode = '22023';
  end if;
  if p_source not in ('manual', 'txt') then
    raise exception 'Origem do orçamento inválida.' using errcode = '22023';
  end if;
  if p_hourly_rate < 0 or p_commission_percent < 0 or p_commission_percent > 100 then
    raise exception 'Parâmetros financeiros inválidos.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione ao menos um item.' using errcode = '22023';
  end if;
  if p_client_id is not null and not exists (
    select 1 from public.clientes where id = p_client_id and deleted_at is null
  ) then raise exception 'Cliente inválido ou arquivado.' using errcode = '23503'; end if;
  if p_system_id is not null and not exists (
    select 1 from public.robot_systems where id = p_system_id and active and deleted_at is null
  ) then raise exception 'Sistema inválido ou inativo.' using errcode = '23503'; end if;

  target_status := case when p_budget_id is null then 'novo' else p_status end;
  if target_status not in ('novo','enviado_comercial','projeto_rejeitado','arquivado','aprovado') then
    raise exception 'Status do orçamento inválido.' using errcode = '22023';
  end if;

  select round(sum(round((item->>'hours')::numeric, 2)), 2),
         round(sum(round((item->>'hours')::numeric, 2) * p_hourly_rate), 2)
  into calculated_hours, calculated_subtotal
  from jsonb_array_elements(p_items) item;
  if calculated_hours < 0 or exists (
    select 1 from jsonb_array_elements(p_items) item
    where btrim(coalesce(item->>'description', '')) = ''
       or (item->>'hours')::numeric < 0 or (item->>'hours')::numeric > 9999
  ) then raise exception 'Um ou mais itens são inválidos.' using errcode = '22023'; end if;
  calculated_total := round(calculated_subtotal * (1 + p_commission_percent / 100), 2);

  if p_budget_id is null then
    insert into public.budgets (
      project_name, source, status, source_file_name, source_content, hourly_rate,
      commission_percent, total_hours, subtotal, total, client_id, system_id
    ) values (
      btrim(p_project_name), p_source, target_status, nullif(btrim(coalesce(p_source_file_name,'')),''),
      p_source_content, p_hourly_rate, p_commission_percent, calculated_hours,
      calculated_subtotal, calculated_total, p_client_id, p_system_id
    ) returning id into target_id;
  else
    update public.budgets set
      project_name=btrim(p_project_name), source=p_source, status=target_status,
      source_file_name=nullif(btrim(coalesce(p_source_file_name,'')),''), source_content=p_source_content,
      hourly_rate=p_hourly_rate, commission_percent=p_commission_percent,
      total_hours=calculated_hours, subtotal=calculated_subtotal, total=calculated_total,
      client_id=p_client_id, system_id=p_system_id
    where id=p_budget_id and deleted_at is null returning id into target_id;
    if target_id is null then raise exception 'Orçamento não encontrado.' using errcode = 'P0002'; end if;
    delete from public.budget_items where budget_id=target_id;
  end if;

  insert into public.budget_items (budget_id,action_id,description,hours,hourly_rate,amount,source_line,source_text,sort_order)
  select target_id, nullif(item->>'action_id','')::uuid, btrim(item->>'description'),
    round((item->>'hours')::numeric,2), p_hourly_rate,
    round(round((item->>'hours')::numeric,2)*p_hourly_rate,2),
    nullif(item->>'source_line','')::integer, nullif(item->>'source_text',''), (ordinality-1)::integer
  from jsonb_array_elements(p_items) with ordinality as source(item,ordinality);
  return target_id;
end;
$$;

revoke all on function public.save_budget(uuid,text,text,text,text,numeric,numeric,uuid,uuid,text,jsonb) from public, anon;
grant execute on function public.save_budget(uuid,text,text,text,text,numeric,numeric,uuid,uuid,text,jsonb) to authenticated;

comment on table public.robot_systems is 'Catálogo relacional de sistemas usado por robôs e orçamentos.';
comment on column public.robos.system_id is 'Sistema relacional; sistema permanece como snapshot compatível.';
comment on column public.budgets.system_id is 'Sistema opcional associado ao orçamento.';
