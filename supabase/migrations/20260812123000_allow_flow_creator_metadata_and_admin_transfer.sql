create or replace function private.update_flow_metadata(
  target_flow_id uuid,
  target_description text,
  target_client_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_flow public.flows%rowtype;
  can_manage_client boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  select * into current_flow
  from public.flows
  where id = target_flow_id;

  if not found then
    raise exception 'Fluxo não encontrado.' using errcode = 'P0002';
  end if;

  can_manage_client := (select private.has_role('admin')) or (select private.has_role('master'));

  if current_flow.created_by <> (select auth.uid()) and not can_manage_client then
    raise exception 'Somente o criador, um Admin ou o Master pode editar a descrição.' using errcode = '42501';
  end if;

  if target_client_id is not null and target_client_id <> current_flow.client_id then
    if not can_manage_client then
      raise exception 'Somente um Admin ou o Master pode trocar o cliente do fluxo.' using errcode = '42501';
    end if;

    if not exists (
      select 1 from public.clientes
      where id = target_client_id and deleted_at is null
    ) then
      raise exception 'Cliente de destino inválido.' using errcode = '23503';
    end if;

    if exists (
      select 1
      from public.flow_nodes node
      join public.robos robot on robot.id = node.robot_id
      where node.flow_id = target_flow_id
        and node.robot_id is not null
        and (robot.cliente_id is distinct from target_client_id or robot.deleted_at is not null)
    ) then
      raise exception 'Transfira ou remova os robôs vinculados antes de trocar o cliente do fluxo.' using errcode = '23514';
    end if;
  end if;

  update public.flows
  set description = coalesce(target_description, ''),
      client_id = coalesce(target_client_id, current_flow.client_id),
      updated_at = now(),
      updated_by = (select auth.uid())
  where id = target_flow_id;
end;
$$;

revoke all on function private.update_flow_metadata(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.update_flow_metadata(
  target_flow_id uuid,
  target_description text,
  target_client_id uuid default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.update_flow_metadata(target_flow_id, target_description, target_client_id);
$$;

revoke all on function public.update_flow_metadata(uuid, text, uuid) from public, anon;
grant execute on function public.update_flow_metadata(uuid, text, uuid) to authenticated;

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
    raise exception 'Gatilho De deve ser um robô do mesmo cliente.' using errcode = '23514';
  end if;

  if new.gatilho_para_robo_id is not null and not exists (
    select 1 from public.robos r
    where r.id = new.gatilho_para_robo_id
      and r.cliente_id = new.cliente_id
      and r.deleted_at is null
  ) then
    raise exception 'Gatilho Para deve ser um robô do mesmo cliente.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_robot_trigger_relationships() from public, anon, authenticated;

comment on function public.update_flow_metadata(uuid, text, uuid) is
  'Permite ao criador editar a descrição e a Admin/Master também transferir o fluxo entre clientes.';
