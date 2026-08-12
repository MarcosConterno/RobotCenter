alter table public.budgets
  add column client_id uuid references public.clientes(id) on delete set null;

create index budgets_client_created_idx
  on public.budgets (client_id, created_at desc)
  where deleted_at is null and client_id is not null;

grant delete on public.budget_items to authenticated;

create policy budget_items_delete
on public.budget_items for delete
to authenticated
using (
  ((select private.has_role('master')) or (select private.has_role('admin')))
  and exists (
    select 1 from public.budgets b
    where b.id = budget_items.budget_id
      and b.deleted_at is null
  )
);

create or replace function public.save_budget(
  p_budget_id uuid,
  p_project_name text,
  p_source text,
  p_source_file_name text,
  p_source_content text,
  p_hourly_rate numeric,
  p_commission_percent numeric,
  p_client_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_id uuid;
  calculated_hours numeric(12,2);
  calculated_subtotal numeric(14,2);
  calculated_total numeric(14,2);
begin
  if auth.uid() is null
     or (not private.has_role('master') and not private.has_role('admin')) then
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
    select 1 from public.clientes c where c.id = p_client_id and c.deleted_at is null
  ) then
    raise exception 'Cliente inválido ou arquivado.' using errcode = '23503';
  end if;

  select
    round(sum(round((item->>'hours')::numeric, 2)), 2),
    round(sum(round((item->>'hours')::numeric, 2) * p_hourly_rate), 2)
  into calculated_hours, calculated_subtotal
  from jsonb_array_elements(p_items) item;

  if calculated_hours < 0 or exists (
    select 1 from jsonb_array_elements(p_items) item
    where btrim(coalesce(item->>'description', '')) = ''
       or (item->>'hours')::numeric < 0
       or (item->>'hours')::numeric > 9999
  ) then
    raise exception 'Um ou mais itens são inválidos.' using errcode = '22023';
  end if;

  calculated_total := round(calculated_subtotal * (1 + p_commission_percent / 100), 2);

  if p_budget_id is null then
    insert into public.budgets (
      project_name, source, status, source_file_name, source_content,
      hourly_rate, commission_percent, total_hours, subtotal, total, client_id
    ) values (
      btrim(p_project_name), p_source, 'finalized', nullif(btrim(coalesce(p_source_file_name, '')), ''), p_source_content,
      p_hourly_rate, p_commission_percent, calculated_hours, calculated_subtotal, calculated_total, p_client_id
    ) returning id into target_id;
  else
    update public.budgets
    set project_name = btrim(p_project_name),
        source = p_source,
        status = 'finalized',
        source_file_name = nullif(btrim(coalesce(p_source_file_name, '')), ''),
        source_content = p_source_content,
        hourly_rate = p_hourly_rate,
        commission_percent = p_commission_percent,
        total_hours = calculated_hours,
        subtotal = calculated_subtotal,
        total = calculated_total,
        client_id = p_client_id
    where id = p_budget_id and deleted_at is null
    returning id into target_id;

    if target_id is null then
      raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
    end if;
    delete from public.budget_items where budget_id = target_id;
  end if;

  insert into public.budget_items (
    budget_id, action_id, description, hours, hourly_rate, amount,
    source_line, source_text, sort_order
  )
  select
    target_id,
    nullif(item->>'action_id', '')::uuid,
    btrim(item->>'description'),
    round((item->>'hours')::numeric, 2),
    p_hourly_rate,
    round(round((item->>'hours')::numeric, 2) * p_hourly_rate, 2),
    nullif(item->>'source_line', '')::integer,
    nullif(item->>'source_text', ''),
    (ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as source(item, ordinality);

  return target_id;
end;
$$;

revoke all on function public.save_budget(uuid,text,text,text,text,numeric,numeric,uuid,jsonb) from public, anon;
grant execute on function public.save_budget(uuid,text,text,text,text,numeric,numeric,uuid,jsonb) to authenticated;

comment on column public.budgets.client_id is
  'Cliente opcional associado ao orçamento; não é necessário para salvar.';
comment on function public.save_budget(uuid,text,text,text,text,numeric,numeric,uuid,jsonb) is
  'Cria ou edita um orçamento e seus itens atomicamente, restrito a Master/Admin.';
