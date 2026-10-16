-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

ALTER TABLE public.publicacoes
  DROP CONSTRAINT publicacoes_robo_id_fkey;

ALTER TABLE public.regras_robo
  DROP CONSTRAINT regras_robo_robo_id_fkey;

ALTER TABLE public.robos
  DROP CONSTRAINT robos_stack_not_blank;

DROP INDEX public.regras_robo_robo_ordem_active_key;

DROP POLICY permissions_update_admin ON public.permissions;

DROP POLICY publicacoes_insert_staff ON public.publicacoes;

DROP POLICY robos_update_staff ON public.robos;

DROP POLICY role_permissions_delete_admin ON public.role_permissions;

DROP POLICY role_permissions_insert_admin ON public.role_permissions;

DROP POLICY roles_update_admin ON public.roles;

DROP POLICY user_roles_delete_admin ON public.user_roles;

DROP POLICY user_roles_insert_admin ON public.user_roles;

CREATE FUNCTION private.audit_master_robot_delete()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null or not private.has_role('master') then
    raise exception 'Somente o Master pode excluir um robô permanentemente.'
      using errcode = '42501';
  end if;

  insert into private.robot_deletion_audit (
    robot_id,
    robot_snapshot,
    deleted_by
  )
  values (
    old.id,
    to_jsonb(old),
    auth.uid()
  );

  return old;
end;
$function$;

REVOKE ALL ON FUNCTION private.audit_master_robot_delete() FROM PUBLIC;

CREATE FUNCTION private.audit_stack_request()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare event_name text;
begin
 if tg_op='INSERT' then
  insert into public.stack_request_history(stack_request_id,event_type,new_status,changes,created_by)
  values(new.id,'CRIADA',new.status,jsonb_build_object('suggested_stack_name',new.suggested_stack_name,'type',new.type,'job',new.job),new.created_by);
  return new;
 end if;
 if new.status is distinct from old.status then
  if new.status='CONCLUIDA' and not private.has_permission('stack_requests.complete') then raise exception 'Sem permissão para concluir a solicitação.' using errcode='42501';
  elsif new.status='CANCELADA' and not private.has_permission('stack_requests.cancel') then raise exception 'Sem permissão para cancelar a solicitação.' using errcode='42501';
  elsif new.status not in('CONCLUIDA','CANCELADA') and not private.has_permission('stack_requests.status') then raise exception 'Sem permissão para alterar o status.' using errcode='42501'; end if;
 end if;
 if (new.suggested_stack_name,new.queue_id,new.type,new.job,new.generated_stack) is distinct from (old.suggested_stack_name,old.queue_id,old.type,old.job,old.generated_stack)
 and not private.has_permission('stack_requests.update') then raise exception 'Sem permissão para editar a solicitação.' using errcode='42501'; end if;
 new.updated_at:=now(); new.updated_by:=auth.uid();
 if new.status='CONCLUIDA' and old.status<>'CONCLUIDA' then new.completed_at:=now();event_name:='CONCLUIDA';
 elsif new.status<>'CONCLUIDA' then new.completed_at:=null;event_name:=case when new.status='CANCELADA' then 'CANCELADA' when new.status<>old.status then 'STATUS_ALTERADO' else 'EDITADA' end;
 else event_name:=case when new.status<>old.status then 'STATUS_ALTERADO' else 'EDITADA' end; end if;
 insert into public.stack_request_history(stack_request_id,event_type,previous_status,new_status,changes,created_by)
 values(new.id,event_name,old.status,new.status,jsonb_strip_nulls(jsonb_build_object(
 'suggested_stack_name',case when new.suggested_stack_name is distinct from old.suggested_stack_name then jsonb_build_array(old.suggested_stack_name,new.suggested_stack_name) end,
 'queue_id',case when new.queue_id is distinct from old.queue_id then jsonb_build_array(old.queue_id,new.queue_id) end,
 'type',case when new.type is distinct from old.type then jsonb_build_array(old.type,new.type) end,
 'job',case when new.job is distinct from old.job then jsonb_build_array(old.job,new.job) end,
 'generated_stack',case when new.generated_stack is distinct from old.generated_stack then jsonb_build_array(old.generated_stack,new.generated_stack) end
 )),coalesce(auth.uid(),new.updated_by,new.created_by));
 return new;
end;$function$;

CREATE OR REPLACE FUNCTION private.can_access_cliente (
  target_cliente_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select (select auth.uid()) is not null
    and (
      private.has_role('master')
      or private.has_role('admin')
      or private.has_role('head_setor')
      or private.has_role('operador')
      or private.has_role('dev')
      or private.has_role('suporte')
      or (
        private.has_role('cliente')
        and target_cliente_id is not null
        and exists (
          select 1
          from public.profiles as profile
          where profile.id = (select auth.uid())
            and profile.cliente_id = target_cliente_id
            and profile.ativo
            and profile.deleted_at is null
        )
      )
    );
$function$;

COMMENT ON FUNCTION private.can_access_cliente(uuid) IS 'Autoriza papéis internos a consultar qualquer Cliente e restringe Cliente ao profiles.cliente_id ativo.';

CREATE FUNCTION private.can_update_robot (
  target_cliente_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    (select private.is_active_user())
    and (select private.can_access_cliente(target_cliente_id))
    and (
      (
        (select private.has_permission('robots.update'))
        and (
          not (select private.has_role('cliente'))
          or (select private.has_role('admin'))
          or (select private.has_role('master'))
        )
      )
      or exists (
        select 1
        from public.profiles as profile
        join public.user_roles as user_role on user_role.user_id = profile.id
        join public.roles as role on role.id = user_role.role_id
        where profile.id = (select auth.uid())
          and profile.cliente_id = target_cliente_id
          and profile.pode_editar_robos_cliente
          and profile.ativo
          and profile.deleted_at is null
          and role.codigo = 'cliente'
          and role.ativo
      )
    );
$function$;

REVOKE ALL ON FUNCTION private.can_update_robot(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION private.can_update_robot(uuid) TO authenticated;

CREATE FUNCTION private.get_flow_creator_name (
  target_flow_id uuid
)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select p.login
  from public.flows as f
  join public.profiles as p on p.id = f.created_by
  where f.id = target_flow_id
    and p.deleted_at is null
    and (select auth.uid()) is not null
    and (select private.has_permission('flows.read'))
    and (select private.can_access_cliente(f.client_id));
$function$;

REVOKE ALL ON FUNCTION private.get_flow_creator_name(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION private.get_flow_creator_name(uuid) TO authenticated;

CREATE FUNCTION private.prevent_cliente_soft_delete_with_dependencies()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    if exists (
      select 1
      from public.robos
      where cliente_id = old.id
        and deleted_at is null
    ) then
      raise exception 'O cliente possui robôs ativos vinculados.'
        using errcode = '23503';
    end if;

    if exists (
      select 1
      from public.profiles
      where cliente_id = old.id
        and deleted_at is null
    ) then
      raise exception 'O cliente possui usuários ativos vinculados.'
        using errcode = '23503';
    end if;
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.prevent_cliente_soft_delete_with_dependencies() FROM PUBLIC;

CREATE FUNCTION private.prevent_robot_center_documentation_version_mutation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Versões da documentação Robot Center não podem ser excluídas.' using errcode = '55000';
  end if;
  if old.status = 'published' then
    raise exception 'Versões publicadas da documentação Robot Center são imutáveis.' using errcode = '55000';
  end if;
  if new.id <> old.id
    or new.documentation_id <> old.documentation_id
    or new.version <> old.version
    or new.created_at <> old.created_at
    or new.created_by <> old.created_by
    or (old.status <> 'failed' and new.generation_token is distinct from old.generation_token) then
    raise exception 'A identidade da versão não pode ser alterada.' using errcode = '55000';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), old.updated_by, old.created_by);
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.prevent_robot_center_documentation_version_mutation() FROM PUBLIC;

CREATE FUNCTION private.prevent_tutorial_version_mutation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  raise exception 'Versões publicadas de tutorial são imutáveis.' using errcode = '55000';
end;
$function$;

REVOKE ALL ON FUNCTION private.prevent_tutorial_version_mutation() FROM PUBLIC;

CREATE FUNCTION private.protect_client_robot_update()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if (select private.has_role('cliente'))
     and not (select private.has_role('admin'))
     and not (select private.has_role('master')) then
    if new.id is distinct from old.id
       or new.cliente_id is distinct from old.cliente_id
       or new.product_type is distinct from old.product_type
       or new.deleted_at is distinct from old.deleted_at
       or new.deleted_by is distinct from old.deleted_by
       or new.created_at is distinct from old.created_at
       or new.created_by is distinct from old.created_by
       or new.manual_path is distinct from old.manual_path
       or new.manual_nome is distinct from old.manual_nome
       or new.version_checked_at is distinct from old.version_checked_at
       or new.cliente_cor is distinct from old.cliente_cor
       or new.pacote_cor is distinct from old.pacote_cor then
      raise exception 'Usuário Cliente não pode transferir, arquivar ou alterar campos administrativos do robô.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.protect_client_robot_update() FROM PUBLIC;

CREATE FUNCTION private.protect_robot_duplicate_permission()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is not null and exists (
    select 1
    from public.permissions as permission
    where permission.id = case when tg_op = 'DELETE' then old.permission_id else new.permission_id end
      and permission.codigo = 'robots.duplicate'
  ) then
    raise exception 'A permissão de duplicar robôs é exclusiva e protegida para Admin e Master.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.protect_robot_duplicate_permission() FROM PUBLIC;

CREATE FUNCTION private.publish_flow (
  target_flow_id  uuid,
  target_snapshot jsonb
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  next_version integer;
begin
  if (select auth.uid()) is null
     or not (select private.has_permission('flows.publish')) then
    raise exception 'Sem permissão para publicar este fluxo.' using errcode = '42501';
  end if;

  if target_snapshot is null or jsonb_typeof(target_snapshot) <> 'object' then
    raise exception 'Snapshot inválido.' using errcode = '22023';
  end if;

  update public.flows as f
  set version = version + 1,
      status = 'publicado'
  where f.id = target_flow_id
    and (select private.can_access_cliente(f.client_id))
  returning f.version into next_version;

  if next_version is null then
    raise exception 'Fluxo não encontrado ou não autorizado.' using errcode = '42501';
  end if;

  insert into public.flow_versions (flow_id, version, snapshot, created_by)
  values (target_flow_id, next_version, target_snapshot, (select auth.uid()));

  return next_version;
end;
$function$;

REVOKE ALL ON FUNCTION private.publish_flow(uuid, jsonb) FROM PUBLIC;

GRANT ALL ON FUNCTION private.publish_flow(uuid, jsonb) TO authenticated;

CREATE FUNCTION private.set_dashboard_chart_preferences_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_dashboard_chart_preferences_updated_at() FROM PUBLIC;

CREATE FUNCTION private.set_flow_row_audit_fields()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  current_user_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(current_user_id, new.created_by);
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.updated_by := coalesce(current_user_id, new.updated_by, new.created_by);
    return new;
  end if;

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(current_user_id, old.updated_by, old.created_by);

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_flow_row_audit_fields() FROM PUBLIC;

CREATE FUNCTION private.set_personal_content_audit_fields()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION private.set_personal_content_audit_fields() FROM PUBLIC;

CREATE FUNCTION private.set_personal_page_flow_owner()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_personal_page_flow_owner() FROM PUBLIC;

CREATE FUNCTION private.set_personal_page_preferences_audit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION private.set_personal_page_preferences_audit() FROM PUBLIC;

CREATE FUNCTION private.set_personal_task_audit_fields()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
    elsif new.status <> 'completed' then
      new.completed_at := null;
    else
      new.completed_at := old.completed_at;
    end if;
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_personal_task_audit_fields() FROM PUBLIC;

CREATE FUNCTION private.set_robot_center_documentation_audit_fields()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  current_user_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := coalesce(current_user_id, new.created_by);
    new.updated_by := coalesce(current_user_id, new.updated_by, new.created_by);
    return new;
  end if;

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(current_user_id, old.updated_by, old.created_by);
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_robot_center_documentation_audit_fields() FROM PUBLIC;

CREATE FUNCTION private.set_robot_package_color()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  shared_color text;
  package_count integer;
begin
  if tg_op = 'UPDATE' and lower(btrim(new.pacote)) = lower(btrim(old.pacote)) then
    return new;
  end if;

  select r.pacote_cor
  into shared_color
  from public.robos as r
  where r.deleted_at is null
    and lower(btrim(r.pacote)) = lower(btrim(new.pacote))
    and (tg_op = 'INSERT' or r.id <> new.id)
  order by r.created_at, r.id
  limit 1;

  if shared_color is null then
    select count(distinct lower(btrim(r.pacote)))
    into package_count
    from public.robos as r
    where r.deleted_at is null
      and btrim(r.pacote) <> ''
      and lower(btrim(r.pacote)) <> lower(btrim(new.pacote));

    shared_color := (array['azul', 'violeta', 'verde', 'ambar', 'rosa', 'ciano'])[
      (package_count % 6) + 1
    ];
  end if;

  new.pacote_cor := shared_color;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_robot_package_color() FROM PUBLIC;

CREATE FUNCTION private.set_tutorial_audit_fields()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := coalesce(new.updated_by, new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_tutorial_audit_fields() FROM PUBLIC;

CREATE FUNCTION private.set_user_tutorial_progress_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.created_at := old.created_at;
  new.user_id := old.user_id;
  new.tutorial_key := old.tutorial_key;
  new.tutorial_version := old.tutorial_version;
  new.updated_at := now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_user_tutorial_progress_updated_at() FROM PUBLIC;

CREATE FUNCTION private.stack_requests_role_allowed()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
 select not private.has_role('cliente') and not private.has_role('suporte');
$function$;

CREATE FUNCTION private.sync_robot_command_values()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ begin update public.robos set command=new.command where command_id=new.id; insert into public.publicacoes(robo_id,categoria,descricao) select id,'Atualização do Robô','Command atualizado pelo cadastro central: '||new.name||'.' from public.robos where command_id=new.id and deleted_at is null; return new; end $function$;

REVOKE ALL ON FUNCTION private.sync_robot_command_values() FROM PUBLIC;

CREATE FUNCTION private.sync_robot_package_values()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ begin update public.robos set pacote=new.name,pacote_cor=new.color where package_id=new.id; insert into public.publicacoes(robo_id,categoria,descricao) select id,'Atualização do Robô','Pacote atualizado pelo cadastro central: '||new.name||'.' from public.robos where package_id=new.id and deleted_at is null; return new; end $function$;

REVOKE ALL ON FUNCTION private.sync_robot_package_values() FROM PUBLIC;

CREATE FUNCTION private.sync_robot_queue_values()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ begin update public.robos set fila=new.name where queue_id=new.id; insert into public.publicacoes(robo_id,categoria,descricao) select id,'Atualização do Robô','Fila atualizada pelo cadastro central: '||new.name||'.' from public.robos where queue_id=new.id and deleted_at is null; return new; end $function$;

REVOKE ALL ON FUNCTION private.sync_robot_queue_values() FROM PUBLIC;

CREATE FUNCTION private.sync_robot_stack_values()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ begin update public.robos set stack=new.name where stack_id=new.id; insert into public.publicacoes(robo_id,categoria,descricao) select id,'Atualização do Robô','Stack atualizada pelo cadastro central: '||new.name||'.' from public.robos where stack_id=new.id and deleted_at is null; return new; end $function$;

REVOKE ALL ON FUNCTION private.sync_robot_stack_values() FROM PUBLIC;

CREATE FUNCTION private.sync_robot_system_values()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  update public.robos set sistema = new.name where system_id = new.id;
  return new;
end $function$;

REVOKE ALL ON FUNCTION private.sync_robot_system_values() FROM PUBLIC;

CREATE FUNCTION private.update_flow_metadata (
  target_flow_id     uuid,
  target_description text,
  target_client_id   uuid DEFAULT NULL::uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION private.update_flow_metadata(uuid, text, uuid) FROM PUBLIC;

CREATE FUNCTION private.validate_robot_documentation_block()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  related_type text;
  related_draft_id uuid;
begin
  if new.requirement_id is not null then
    if not exists (
      select 1
      from public.robot_center_documentation_drafts dr
      join public.robot_center_documentations d on d.id = dr.documentation_id
      join public.regras_robo rr on rr.robo_id = d.robo_id
      where dr.id = new.draft_id
        and rr.id = new.requirement_id
        and rr.deleted_at is null
        and d.deleted_at is null
    ) then
      raise exception 'O bloco e a regra devem pertencer ao mesmo robô.' using errcode = '23514';
    end if;
  elsif new.section_id is not null then
    if not exists (
      select 1
      from public.robot_center_documentation_sections section
      where section.id = new.section_id
        and section.draft_id = new.draft_id
    ) then
      raise exception 'O bloco e a seção devem pertencer ao mesmo rascunho.' using errcode = '23514';
    end if;
  else
    raise exception 'O bloco deve pertencer a uma regra ou seção.' using errcode = '23514';
  end if;

  if new.related_block_id is not null then
    select related.type, related.draft_id
      into related_type, related_draft_id
    from public.robot_center_documentation_blocks related
    where related.id = new.related_block_id
      and related.deleted_at is null;

    if not found or related_draft_id <> new.draft_id then
      raise exception 'O bloco relacionado deve pertencer ao mesmo rascunho.' using errcode = '23514';
    end if;
    if new.type = 'caption' and related_type <> 'image' then
      raise exception 'Uma legenda somente pode ser vinculada a uma imagem.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.validate_robot_documentation_block() FROM PUBLIC;

CREATE FUNCTION private.validate_robot_requirement_hierarchy()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  parent_rule public.regras_robo%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Uma regra não pode ser pai de si mesma.' using errcode = '23514';
  end if;

  select * into parent_rule
  from public.regras_robo
  where id = new.parent_id
    and deleted_at is null;

  if not found then
    raise exception 'Regra pai não encontrada.' using errcode = '23503';
  end if;

  if parent_rule.robo_id <> new.robo_id or parent_rule.tipo <> new.tipo then
    raise exception 'A regra pai deve pertencer ao mesmo robô e à mesma categoria.' using errcode = '23514';
  end if;

  if parent_rule.parent_id is not null then
    raise exception 'A hierarquia de regras aceita somente um nível de sub-regra.' using errcode = '23514';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.validate_robot_requirement_hierarchy() FROM PUBLIC;

CREATE FUNCTION private.validate_robot_trigger_relationships()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION private.validate_robot_trigger_relationships() FROM PUBLIC;

CREATE TABLE private.robot_deletion_audit (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  robot_id       uuid                     NOT NULL,
  robot_snapshot jsonb                    NOT NULL,
  deleted_at     timestamp with time zone DEFAULT now() NOT NULL,
  deleted_by     uuid                     NOT NULL
);

COMMENT ON TABLE private.robot_deletion_audit IS 'Auditoria privada e imutável das exclusões físicas de robôs realizadas pelo Master.';

ALTER TABLE private.robot_deletion_audit
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE private.robot_deletion_audit
  ADD CONSTRAINT robot_deletion_audit_pkey PRIMARY KEY (id);

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE FUNCTION public.append_robot_documentation_image_block (
  target_robot_id       uuid,
  target_draft_id       uuid,
  target_requirement_id uuid,
  target_block_id       uuid,
  target_metadata       jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  next_order integer;
  created_block public.robot_center_documentation_blocks%rowtype;
begin
  if not (select private.has_role('admin'))
    or not (select private.has_permission('robot_center_documentation.manage')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  perform 1
  from public.regras_robo requirement
  join public.robot_center_documentation_drafts draft on draft.id = target_draft_id
  join public.robot_center_documentations documentation on documentation.id = draft.documentation_id
  join public.robos robot on robot.id = documentation.robo_id
  where requirement.id = target_requirement_id
    and requirement.robo_id = target_robot_id
    and documentation.robo_id = target_robot_id
    and requirement.deleted_at is null
    and documentation.deleted_at is null
    and robot.deleted_at is null
    and (select private.can_access_cliente(robot.cliente_id))
  for update of requirement;

  if not found then
    raise exception 'Regra ou rascunho não encontrado.' using errcode = '42501';
  end if;

  select coalesce(max(block.ordem), -1) + 1
    into next_order
  from public.robot_center_documentation_blocks block
  where block.draft_id = target_draft_id
    and block.requirement_id = target_requirement_id
    and block.deleted_at is null;

  insert into public.robot_center_documentation_blocks (
    id, draft_id, requirement_id, type, ordem, metadata
  ) values (
    target_block_id, target_draft_id, target_requirement_id, 'image', next_order, target_metadata
  )
  returning * into created_block;

  return to_jsonb(created_block);
end;
$function$;

REVOKE ALL ON FUNCTION public.append_robot_documentation_image_block(uuid, uuid, uuid, uuid, jsonb) FROM PUBLIC;

GRANT ALL ON FUNCTION public.append_robot_documentation_image_block(uuid, uuid, uuid, uuid, jsonb) TO authenticated;

GRANT ALL ON FUNCTION public.append_robot_documentation_image_block(uuid, uuid, uuid, uuid, jsonb) TO service_role;

CREATE FUNCTION public.archive_client_with_user_reassignment (
  target_client_id      uuid,
  replacement_client_id uuid DEFAULT NULL::uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  reassigned_count integer := 0;
begin
  if auth.uid() is null or not private.has_role('master') then
    raise exception 'Somente o usuário Master pode arquivar clientes.' using errcode = '42501';
  end if;

  if target_client_id is null then
    raise exception 'Cliente inválido.' using errcode = '22023';
  end if;

  if replacement_client_id = target_client_id then
    raise exception 'O cliente substituto deve ser diferente do cliente arquivado.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.clientes
    where id = target_client_id and deleted_at is null
  ) then
    raise exception 'Cliente não encontrado ou já arquivado.' using errcode = 'P0002';
  end if;

  if replacement_client_id is not null and not exists (
    select 1 from public.clientes
    where id = replacement_client_id and deleted_at is null
  ) then
    raise exception 'Cliente substituto não encontrado ou arquivado.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.robos
    where cliente_id = target_client_id and deleted_at is null
  ) then
    raise exception 'O cliente possui robôs ativos vinculados.' using errcode = '23503';
  end if;

  update public.profiles
  set cliente_id = replacement_client_id
  where cliente_id = target_client_id
    and deleted_at is null;
  get diagnostics reassigned_count = row_count;

  update public.clientes
  set deleted_at = now(), deleted_by = auth.uid()
  where id = target_client_id
    and deleted_at is null;

  if not found then
    raise exception 'Não foi possível arquivar o cliente.' using errcode = '55000';
  end if;

  return reassigned_count;
end;
$function$;

COMMENT ON FUNCTION public.archive_client_with_user_reassignment(uuid,uuid) IS 'Reatribui ou desvincula usuários e arquiva um cliente atomicamente; uso exclusivo do Master.';

REVOKE ALL ON FUNCTION public.archive_client_with_user_reassignment(uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.archive_client_with_user_reassignment(uuid, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.archive_client_with_user_reassignment(uuid, uuid) TO service_role;

CREATE FUNCTION public.archive_robot_requirement (
  target_robot_id       uuid,
  target_requirement_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  target_rule public.regras_robo%rowtype;
begin
  if not (select private.has_role('admin')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  select * into target_rule
  from public.regras_robo rr
  where rr.id = target_requirement_id
    and rr.robo_id = target_robot_id
    and rr.deleted_at is null
  for update;

  if not found then
    raise exception 'Regra não encontrada ou não autorizada.' using errcode = '42501';
  end if;

  update public.regras_robo
  set deleted_at = now(), deleted_by = auth.uid()
  where robo_id = target_robot_id
    and deleted_at is null
    and (id = target_requirement_id or parent_id = target_requirement_id);

  update public.regras_robo rr
  set ordem = rr.ordem + 1000000
  where rr.robo_id = target_robot_id
    and rr.tipo = target_rule.tipo
    and rr.deleted_at is null
    and rr.parent_id is not distinct from target_rule.parent_id;

  with ordered as (
    select rr.id, row_number() over (order by rr.ordem, rr.id) - 1 as next_order
    from public.regras_robo rr
    where rr.robo_id = target_robot_id
      and rr.tipo = target_rule.tipo
      and rr.deleted_at is null
      and rr.parent_id is not distinct from target_rule.parent_id
  )
  update public.regras_robo rr
  set ordem = ordered.next_order
  from ordered
  where rr.id = ordered.id;
end;
$function$;

REVOKE ALL ON FUNCTION public.archive_robot_requirement(uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.archive_robot_requirement(uuid, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.archive_robot_requirement(uuid, uuid) TO service_role;

CREATE FUNCTION public.begin_robot_center_documentation_publication (
  target_robot_id         uuid,
  target_generation_token uuid
)
  RETURNS TABLE (
    version_id            uuid,
    version_number        integer,
    documentation_id      uuid,
    draft_id              uuid,
    template_id           uuid,
    template_version      integer,
    template_storage_path text,
    reused                boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  current_documentation public.robot_center_documentations%rowtype;
  current_draft public.robot_center_documentation_drafts%rowtype;
  current_template public.robot_center_documentation_templates%rowtype;
  current_version public.robot_center_documentation_versions%rowtype;
  next_version integer;
begin
  if not (select private.has_role('admin'))
    or not (select private.has_permission('robot_center_documentation.manage')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  select d.* into current_documentation
  from public.robot_center_documentations d
  join public.robos r on r.id = d.robo_id
  where d.robo_id = target_robot_id
    and d.deleted_at is null and r.deleted_at is null
    and (select private.can_access_cliente(r.cliente_id))
  for update of d;
  if not found then raise exception 'Documentação ou robô não encontrado.' using errcode = '42501'; end if;

  select * into current_draft
  from public.robot_center_documentation_drafts dr
  where dr.documentation_id = current_documentation.id;
  if not found then raise exception 'Rascunho não encontrado.' using errcode = '23503'; end if;

  select * into current_template
  from public.robot_center_documentation_templates t
  where t.active
  order by t.version desc
  limit 1;
  if not found then raise exception 'Nenhum template mestre ativo foi configurado.' using errcode = '23503'; end if;

  select * into current_version
  from public.robot_center_documentation_versions v
  where v.generation_token = target_generation_token;
  if found then
    if current_version.documentation_id <> current_documentation.id then
      raise exception 'Token de publicação inválido.' using errcode = '42501';
    end if;
    return query select current_version.id, current_version.version, current_documentation.id,
      current_draft.id, current_version.template_id, current_version.template_version,
      current_template.storage_path, true;
    return;
  end if;

  if exists (
    select 1 from public.robot_center_documentation_versions v
    where v.documentation_id = current_documentation.id and v.status = 'generating'
  ) then
    raise exception 'Já existe uma publicação em andamento.' using errcode = '55000';
  end if;

  select * into current_version
  from public.robot_center_documentation_versions v
  where v.documentation_id = current_documentation.id and v.status = 'failed'
  order by v.version desc
  limit 1
  for update;
  if found then
    update public.robot_center_documentation_versions
    set status = 'generating', snapshot = '{}'::jsonb, template_id = current_template.id,
        template_version = current_template.version, generation_token = target_generation_token,
        docx_path = null, pdf_path = null, error_message = null, started_at = now(), published_at = null
    where id = current_version.id
    returning * into current_version;
    return query select current_version.id, current_version.version, current_documentation.id,
      current_draft.id, current_template.id, current_template.version,
      current_template.storage_path, true;
    return;
  end if;

  select coalesce(max(v.version), 0) + 1 into next_version
  from public.robot_center_documentation_versions v
  where v.documentation_id = current_documentation.id;

  insert into public.robot_center_documentation_versions (
    documentation_id, version, status, snapshot, template_id, template_version,
    generation_token, created_by, updated_by
  ) values (
    current_documentation.id, next_version, 'generating', '{}'::jsonb,
    current_template.id, current_template.version, target_generation_token, auth.uid(), auth.uid()
  ) returning * into current_version;

  return query select current_version.id, current_version.version, current_documentation.id,
    current_draft.id, current_template.id, current_template.version,
    current_template.storage_path, false;
end;
$function$;

REVOKE ALL ON FUNCTION public.begin_robot_center_documentation_publication(uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.begin_robot_center_documentation_publication(uuid, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.begin_robot_center_documentation_publication(uuid, uuid) TO service_role;

CREATE FUNCTION public.complete_robot_center_documentation_publication (
  target_version_id       uuid,
  target_generation_token uuid,
  target_snapshot         jsonb,
  target_docx_path        text,
  target_pdf_path         text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  target_version public.robot_center_documentation_versions%rowtype;
  target_robot_id uuid;
  version_label text;
begin
  if not (select private.has_role('admin'))
    or not (select private.has_permission('robot_center_documentation.manage')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if jsonb_typeof(target_snapshot) <> 'object' or target_snapshot = '{}'::jsonb then
    raise exception 'Snapshot inválido.' using errcode = '22023';
  end if;

  select * into target_version
  from public.robot_center_documentation_versions
  where id = target_version_id
    and generation_token = target_generation_token
    and status = 'generating'
  for update;
  if not found then
    raise exception 'Versão não está disponível para conclusão.' using errcode = '55000';
  end if;

  select d.robo_id into target_robot_id
  from public.robot_center_documentations d
  where d.id = target_version.documentation_id
    and d.deleted_at is null;
  if target_robot_id is null then
    raise exception 'Robô da documentação não encontrado.' using errcode = '23503';
  end if;

  version_label := 'v1.' || greatest(target_version.version - 1, 0)::text;

  update public.robot_center_documentation_versions
  set snapshot = target_snapshot,
      docx_path = target_docx_path,
      pdf_path = target_pdf_path,
      status = 'published',
      published_at = now(),
      error_message = null
  where id = target_version.id;

  update public.robot_center_documentations
  set current_version_id = target_version.id,
      status = 'published',
      updated_at = now(),
      updated_by = auth.uid()
  where id = target_version.documentation_id;

  insert into public.publicacoes (robo_id, categoria, descricao, publicada_em, created_by)
  values (
    target_robot_id,
    'Atualização do Robô',
    'Documentação técnica publicada • Nova versão ' || version_label,
    now(),
    auth.uid()
  );
end;
$function$;

COMMENT ON FUNCTION public.complete_robot_center_documentation_publication(uuid,uuid,jsonb,text,text) IS 'Conclui a versão documental e registra a publicação na dashboard na mesma transação.';

REVOKE ALL ON FUNCTION public.complete_robot_center_documentation_publication(uuid, uuid, jsonb, text, text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.complete_robot_center_documentation_publication(uuid, uuid, jsonb, text, text) TO authenticated;

GRANT ALL ON FUNCTION public.complete_robot_center_documentation_publication(uuid, uuid, jsonb, text, text) TO service_role;

CREATE FUNCTION public.create_tutorial (
  target_name             text,
  target_audience_role_id uuid
)
  RETURNS TABLE (
    tutorial_id uuid,
    draft_id    uuid
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  new_tutorial_id uuid;
  new_draft_id uuid;
begin
  if auth.uid() is null or (not private.has_role('master') and not private.has_permission('tutorials.manage')) then
    raise exception 'Sem permissão para criar tutoriais.' using errcode = '42501';
  end if;
  if btrim(coalesce(target_name, '')) = '' then
    raise exception 'Nome do tutorial é obrigatório.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.roles where id = target_audience_role_id and ativo) then
    raise exception 'Público inválido.' using errcode = '22023';
  end if;

  insert into public.tutorials (tutorial_key, nome, audience_role_id, created_by)
  values ('tutorial-' || gen_random_uuid()::text, btrim(target_name), target_audience_role_id, auth.uid())
  returning id into new_tutorial_id;
  insert into public.tutorial_drafts (tutorial_id, created_by)
  values (new_tutorial_id, auth.uid()) returning id into new_draft_id;
  return query select new_tutorial_id, new_draft_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.create_tutorial(text, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.create_tutorial(text, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.create_tutorial(text, uuid) TO service_role;

CREATE FUNCTION public.fail_robot_center_documentation_publication (
  target_version_id       uuid,
  target_generation_token uuid,
  target_error_message    text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if not (select private.has_role('admin')) then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  update public.robot_center_documentation_versions
  set status = 'failed', error_message = left(coalesce(target_error_message, 'Falha desconhecida.'), 2000)
  where id = target_version_id and generation_token = target_generation_token and status = 'generating';
end;
$function$;

REVOKE ALL ON FUNCTION public.fail_robot_center_documentation_publication(uuid, uuid, text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.fail_robot_center_documentation_publication(uuid, uuid, text) TO authenticated;

GRANT ALL ON FUNCTION public.fail_robot_center_documentation_publication(uuid, uuid, text) TO service_role;

CREATE FUNCTION public.get_flow_creator_name (
  target_flow_id uuid
)
  RETURNS text
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select private.get_flow_creator_name(target_flow_id);
$function$;

REVOKE ALL ON FUNCTION public.get_flow_creator_name(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.get_flow_creator_name(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.get_flow_creator_name(uuid) TO service_role;

CREATE FUNCTION public.initialize_robot_center_documentation (
  target_robot_id uuid
)
  RETURNS TABLE (
    documentation_id uuid,
    draft_id         uuid
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  current_documentation_id uuid;
  current_draft_id uuid;
begin
  if not (select private.has_role('admin'))
    or not (select private.has_permission('robot_center_documentation.manage')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.robos as robot
    where robot.id = target_robot_id
      and robot.deleted_at is null
      and (select private.can_access_cliente(robot.cliente_id))
  ) then
    raise exception 'Robô não encontrado ou não autorizado.' using errcode = '42501';
  end if;

  insert into public.robot_center_documentations (robo_id, status)
  values (target_robot_id, 'draft')
  on conflict (robo_id) where deleted_at is null do nothing;

  select documentation.id
    into current_documentation_id
  from public.robot_center_documentations as documentation
  where documentation.robo_id = target_robot_id
    and documentation.deleted_at is null;

  if current_documentation_id is null then
    raise exception 'Não foi possível inicializar a documentação ativa.' using errcode = '55000';
  end if;

  insert into public.robot_center_documentation_drafts (documentation_id)
  values (current_documentation_id)
  on conflict on constraint robot_center_documentation_drafts_documentation_unique do nothing;

  select draft.id
    into current_draft_id
  from public.robot_center_documentation_drafts as draft
  where draft.documentation_id = current_documentation_id;

  insert into public.robot_center_documentation_sections (draft_id, section_key, ordem)
  values
    (current_draft_id, 'objective', 0),
    (current_draft_id, 'reference_materials', 1),
    (current_draft_id, 'overview', 2),
    (current_draft_id, 'limitations', 3),
    (current_draft_id, 'scope', 4),
    (current_draft_id, 'execution_errors', 5)
  on conflict on constraint robot_center_documentation_sections_draft_key_unique do nothing;

  return query
  select current_documentation_id as documentation_id,
         current_draft_id as draft_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.initialize_robot_center_documentation(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.initialize_robot_center_documentation(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.initialize_robot_center_documentation(uuid) TO service_role;

CREATE FUNCTION public.publish_flow (
  target_flow_id  uuid,
  target_snapshot jsonb
)
  RETURNS integer
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select private.publish_flow(target_flow_id, target_snapshot);
$function$;

REVOKE ALL ON FUNCTION public.publish_flow(uuid, jsonb) FROM PUBLIC;

GRANT ALL ON FUNCTION public.publish_flow(uuid, jsonb) TO authenticated;

GRANT ALL ON FUNCTION public.publish_flow(uuid, jsonb) TO service_role;

CREATE FUNCTION public.publish_tutorial (
  target_tutorial_id uuid
)
  RETURNS TABLE (
    version_id     uuid,
    version_number integer
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  target public.tutorials%rowtype;
  target_draft_id uuid;
  next_version integer;
  new_version_id uuid;
  version_snapshot jsonb;
begin
  if auth.uid() is null or (not private.has_role('master') and not private.has_permission('tutorials.manage')) then
    raise exception 'Sem permissão para publicar tutoriais.' using errcode = '42501';
  end if;

  select * into target from public.tutorials where id = target_tutorial_id for update;
  if target.id is null then raise exception 'Tutorial não encontrado.' using errcode = 'P0002'; end if;
  select id into target_draft_id from public.tutorial_drafts where tutorial_id = target.id;
  if target_draft_id is null then raise exception 'Rascunho não encontrado.' using errcode = 'P0002'; end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.tutorial_versions where tutorial_id = target.id;

  version_snapshot := jsonb_build_object(
    'tutorialId', target.id,
    'tutorialKey', target.tutorial_key,
    'name', target.nome,
    'audienceRoleId', target.audience_role_id,
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', step.id, 'order', step.ordem, 'pageKey', step.page_key,
        'targetKey', step.target_key, 'title', step.titulo,
        'description', step.descricao, 'placement', step.placement,
        'conditionKey', step.condition_key, 'enabled', step.habilitado
      ) order by step.ordem)
      from public.tutorial_steps step where step.draft_id = target_draft_id
    ), '[]'::jsonb)
  );

  insert into public.tutorial_versions (tutorial_id, version, snapshot, published_by)
  values (target.id, next_version, version_snapshot, auth.uid()) returning id into new_version_id;

  update public.tutorials set status = 'published', current_version_id = new_version_id where id = target.id;
  return query select new_version_id, next_version;
end;
$function$;

REVOKE ALL ON FUNCTION public.publish_tutorial(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.publish_tutorial(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.publish_tutorial(uuid) TO service_role;

CREATE FUNCTION public.reorder_robot_documentation_blocks (
  target_robot_id       uuid,
  target_requirement_id uuid,
  ordered_ids           uuid[]
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  current_ids uuid[];
  item_id uuid;
  item_order integer := 0;
begin
  if not (select private.has_role('admin'))
    or not (select private.has_permission('robot_center_documentation.manage')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.regras_robo requirement
    join public.robos robot on robot.id = requirement.robo_id
    where requirement.id = target_requirement_id
      and requirement.robo_id = target_robot_id
      and requirement.deleted_at is null
      and robot.deleted_at is null
      and (select private.can_access_cliente(robot.cliente_id))
  ) then
    raise exception 'Regra não encontrada ou não autorizada.' using errcode = '42501';
  end if;

  perform 1
  from public.robot_center_documentation_blocks block
  join public.robot_center_documentation_drafts draft on draft.id = block.draft_id
  join public.robot_center_documentations documentation on documentation.id = draft.documentation_id
  where block.requirement_id = target_requirement_id
    and block.deleted_at is null
    and documentation.robo_id = target_robot_id
  order by block.id
  for update of block;

  select coalesce(array_agg(block.id order by block.id), '{}'::uuid[])
    into current_ids
  from public.robot_center_documentation_blocks block
  join public.robot_center_documentation_drafts draft on draft.id = block.draft_id
  join public.robot_center_documentations documentation on documentation.id = draft.documentation_id
  where block.requirement_id = target_requirement_id
    and block.deleted_at is null
    and documentation.robo_id = target_robot_id;

  if current_ids <> coalesce(
    (select array_agg(value order by value) from unnest(ordered_ids) value),
    '{}'::uuid[]
  ) then
    raise exception 'A lista de blocos não corresponde ao conjunto atual.' using errcode = '22023';
  end if;

  update public.robot_center_documentation_blocks block
  set ordem = block.ordem + 1000000
  where block.requirement_id = target_requirement_id
    and block.deleted_at is null;

  foreach item_id in array ordered_ids loop
    update public.robot_center_documentation_blocks
    set ordem = item_order
    where id = item_id and requirement_id = target_requirement_id;
    item_order := item_order + 1;
  end loop;
end;
$function$;

REVOKE ALL ON FUNCTION public.reorder_robot_documentation_blocks(uuid, uuid, uuid[]) FROM PUBLIC;

GRANT ALL ON FUNCTION public.reorder_robot_documentation_blocks(uuid, uuid, uuid[]) TO authenticated;

GRANT ALL ON FUNCTION public.reorder_robot_documentation_blocks(uuid, uuid, uuid[]) TO service_role;

CREATE FUNCTION public.reorder_robot_requirements (
  target_robot_id  uuid,
  target_type      text,
  target_parent_id uuid,
  ordered_ids      uuid[]
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  current_ids uuid[];
  item_id uuid;
  item_order integer := 0;
begin
  if not (select private.has_role('admin')) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  perform 1 from public.robos r
  where r.id = target_robot_id and r.deleted_at is null
    and (select private.can_access_cliente(r.cliente_id));
  if not found then
    raise exception 'Robô não encontrado ou não autorizado.' using errcode = '42501';
  end if;

  perform 1
  from public.regras_robo rr
  where rr.robo_id = target_robot_id
    and rr.tipo = target_type
    and rr.deleted_at is null
    and rr.parent_id is not distinct from target_parent_id
  order by rr.id
  for update;

  select coalesce(array_agg(rr.id order by rr.id), '{}'::uuid[]) into current_ids
  from public.regras_robo rr
  where rr.robo_id = target_robot_id
    and rr.tipo = target_type
    and rr.deleted_at is null
    and rr.parent_id is not distinct from target_parent_id;

  if current_ids <> coalesce((select array_agg(value order by value) from unnest(ordered_ids) value), '{}'::uuid[]) then
    raise exception 'A lista de regras não corresponde ao conjunto atual.' using errcode = '22023';
  end if;

  update public.regras_robo rr
  set ordem = rr.ordem + 1000000
  where rr.robo_id = target_robot_id
    and rr.tipo = target_type
    and rr.deleted_at is null
    and rr.parent_id is not distinct from target_parent_id;

  foreach item_id in array ordered_ids loop
    update public.regras_robo set ordem = item_order where id = item_id;
    item_order := item_order + 1;
  end loop;
end;
$function$;

REVOKE ALL ON FUNCTION public.reorder_robot_requirements(uuid, text, uuid, uuid[]) FROM PUBLIC;

GRANT ALL ON FUNCTION public.reorder_robot_requirements(uuid, text, uuid, uuid[]) TO authenticated;

GRANT ALL ON FUNCTION public.reorder_robot_requirements(uuid, text, uuid, uuid[]) TO service_role;

CREATE FUNCTION public.save_budget (
  p_budget_id          uuid,
  p_project_name       text,
  p_source             text,
  p_source_file_name   text,
  p_source_content     text,
  p_hourly_rate        numeric,
  p_commission_percent numeric,
  p_client_id          uuid,
  p_system_id          uuid,
  p_status             text,
  p_items              jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.save_budget(uuid, text, text, text, text, numeric, numeric, uuid, uuid, text, jsonb) FROM PUBLIC;

GRANT ALL ON FUNCTION public.save_budget(uuid, text, text, text, text, numeric, numeric, uuid, uuid, text, jsonb) TO authenticated;

GRANT ALL ON FUNCTION public.save_budget(uuid, text, text, text, text, numeric, numeric, uuid, uuid, text, jsonb) TO service_role;

CREATE FUNCTION public.save_tutorial_draft (
  target_tutorial_id      uuid,
  target_name             text,
  target_audience_role_id uuid,
  target_steps            jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  target_draft_id uuid;
  step_item jsonb;
  step_order integer := 0;
  step_placement text;
begin
  if auth.uid() is null or (not private.has_role('master') and not private.has_permission('tutorials.manage')) then
    raise exception 'Sem permissão para editar tutoriais.' using errcode = '42501';
  end if;
  if btrim(coalesce(target_name, '')) = '' or jsonb_typeof(target_steps) <> 'array' then
    raise exception 'Rascunho inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.roles where id = target_audience_role_id and ativo) then
    raise exception 'Público inválido.' using errcode = '22023';
  end if;

  select id into target_draft_id from public.tutorial_drafts where tutorial_id = target_tutorial_id;
  if target_draft_id is null then raise exception 'Rascunho não encontrado.' using errcode = 'P0002'; end if;

  update public.tutorials set nome = btrim(target_name), audience_role_id = target_audience_role_id
  where id = target_tutorial_id;
  delete from public.tutorial_steps where draft_id = target_draft_id;

  for step_item in select value from jsonb_array_elements(target_steps)
  loop
    step_order := step_order + 1;
    step_placement := coalesce(step_item ->> 'placement', 'bottom');
    if btrim(coalesce(step_item ->> 'pageKey', '')) = ''
      or btrim(coalesce(step_item ->> 'targetKey', '')) = ''
      or btrim(coalesce(step_item ->> 'title', '')) = ''
      or step_placement not in ('top', 'right', 'bottom', 'left') then
      raise exception 'Passo % inválido.', step_order using errcode = '22023';
    end if;
    insert into public.tutorial_steps (
      draft_id, ordem, page_key, target_key, titulo, descricao, placement,
      condition_key, habilitado, created_by
    ) values (
      target_draft_id, step_order, step_item ->> 'pageKey', step_item ->> 'targetKey',
      btrim(step_item ->> 'title'), coalesce(step_item ->> 'description', ''), step_placement,
      nullif(step_item ->> 'conditionKey', ''), coalesce((step_item ->> 'enabled')::boolean, true), auth.uid()
    );
  end loop;
  update public.tutorial_drafts set revision = revision + 1 where id = target_draft_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.save_tutorial_draft(uuid, text, uuid, jsonb) FROM PUBLIC;

GRANT ALL ON FUNCTION public.save_tutorial_draft(uuid, text, uuid, jsonb) TO authenticated;

GRANT ALL ON FUNCTION public.save_tutorial_draft(uuid, text, uuid, jsonb) TO service_role;

CREATE FUNCTION public.update_flow_metadata (
  target_flow_id     uuid,
  target_description text,
  target_client_id   uuid DEFAULT NULL::uuid
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select private.update_flow_metadata(target_flow_id, target_description, target_client_id);
$function$;

COMMENT ON FUNCTION public.update_flow_metadata(uuid,text,uuid) IS 'Permite ao criador editar a descrição e a Admin/Master também transferir o fluxo entre clientes.';

REVOKE ALL ON FUNCTION public.update_flow_metadata(uuid, text, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.update_flow_metadata(uuid, text, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.update_flow_metadata(uuid, text, uuid) TO service_role;

CREATE FUNCTION public.update_robot_capacity (
  target_robot_id uuid,
  target_ideal    integer,
  target_max      integer
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  if not private.has_permission('robots.capacity.update') then
    raise exception 'Sem permissão para alterar Ideal e Max.' using errcode = '42501';
  end if;

  if target_ideal is null or target_max is null or target_ideal < 0 or target_max < 0 then
    raise exception 'Ideal e Max devem ser inteiros maiores ou iguais a zero.' using errcode = '22023';
  end if;

  if target_max < target_ideal then
    raise exception 'Max deve ser maior ou igual a Ideal.' using errcode = '22023';
  end if;

  update public.robos
  set ideal = target_ideal,
      max = target_max
  where id = target_robot_id
    and deleted_at is null;

  if not found then
    raise exception 'Robô não encontrado.' using errcode = 'P0002';
  end if;
end;
$function$;

REVOKE ALL ON FUNCTION public.update_robot_capacity(uuid, integer, integer) FROM PUBLIC;

GRANT ALL ON FUNCTION public.update_robot_capacity(uuid, integer, integer) TO authenticated;

GRANT ALL ON FUNCTION public.update_robot_capacity(uuid, integer, integer) TO service_role;

CREATE FUNCTION public.update_role_permission_matrix (
  change_set jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  change_item jsonb;
  target_role_id uuid;
  target_permission_id uuid;
  target_enabled boolean;
  target_role_code text;
  target_permission_resource text;
  target_permission_code text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;
  if not private.has_role('master') and not private.has_role('admin') then
    raise exception 'Apenas Admin ou Master pode editar permissões.' using errcode = '42501';
  end if;
  if change_set is null or jsonb_typeof(change_set) <> 'array' then
    raise exception 'Lista de alterações inválida.' using errcode = '22023';
  end if;

  for change_item in select value from jsonb_array_elements(change_set)
  loop
    target_role_id := (change_item ->> 'roleId')::uuid;
    target_permission_id := (change_item ->> 'permissionId')::uuid;
    target_enabled := (change_item ->> 'enabled')::boolean;

    select codigo into target_role_code
    from public.roles
    where id = target_role_id and ativo;

    select recurso, codigo into target_permission_resource, target_permission_code
    from public.permissions
    where id = target_permission_id and ativo;

    if target_role_code is null or target_permission_resource is null then
      raise exception 'Papel ou permissão inválida/inativa.' using errcode = '22023';
    end if;
    if target_role_code = 'master' then
      raise exception 'As permissões do perfil Master são protegidas.' using errcode = '42501';
    end if;
    if target_enabled
       and target_role_code in ('cliente', 'suporte')
       and target_permission_resource = 'stack_requests' then
      raise exception 'Cliente e Suporte não podem acessar Solicitações de Stack.' using errcode = '42501';
    end if;
    if target_enabled
       and target_role_code = 'cliente'
       and target_permission_code in (
         'robots.create',
         'robots.update',
         'robots.archive',
         'robots.capacity.update',
         'publications.create',
         'robot_catalog.manage',
         'robot_center_documentation.manage',
         'clients.manage',
         'users.read',
         'users.manage',
         'access_control.read'
       ) then
      raise exception 'Esta permissão administrativa não pode ser atribuída ao perfil Cliente. Use a liberação individual no cadastro do usuário.'
        using errcode = '42501';
    end if;

    if target_enabled then
      insert into public.role_permissions (role_id, permission_id)
      values (target_role_id, target_permission_id)
      on conflict (role_id, permission_id) do nothing;
    else
      delete from public.role_permissions
      where role_id = target_role_id and permission_id = target_permission_id;
    end if;
  end loop;
end;
$function$;

REVOKE ALL ON FUNCTION public.update_role_permission_matrix(jsonb) FROM PUBLIC;

GRANT ALL ON FUNCTION public.update_role_permission_matrix(jsonb) TO authenticated;

GRANT ALL ON FUNCTION public.update_role_permission_matrix(jsonb) TO service_role;

ALTER TABLE public.robos
  ALTER COLUMN cliente_id DROP NOT NULL;

ALTER TABLE public.robos
  ALTER COLUMN stack DROP NOT NULL;

CREATE TABLE public.alteracoes_robo (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  robo_id      uuid                     NOT NULL,
  descricao    text                     NOT NULL,
  realizada_em timestamp with time zone DEFAULT now() NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  created_by   uuid
);

COMMENT ON TABLE public.alteracoes_robo IS 'Histórico imutável das alterações registradas para cada robô.';

ALTER TABLE public.alteracoes_robo
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.alteracoes_robo
  ADD CONSTRAINT alteracoes_robo_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.alteracoes_robo
  ADD CONSTRAINT alteracoes_robo_descricao_not_blank CHECK (btrim(descricao) <> ''::text);

ALTER TABLE public.alteracoes_robo
  ADD CONSTRAINT alteracoes_robo_pkey PRIMARY KEY (id);

ALTER TABLE public.alteracoes_robo
  ADD CONSTRAINT alteracoes_robo_robo_id_fkey FOREIGN KEY (robo_id) REFERENCES public.robos(id) ON DELETE CASCADE;

GRANT INSERT, SELECT ON public.alteracoes_robo TO authenticated;

GRANT ALL ON public.alteracoes_robo TO service_role;

CREATE INDEX alteracoes_robo_robo_realizada_idx ON public.alteracoes_robo (robo_id, realizada_em DESC);

CREATE POLICY alteracoes_robo_insert_staff ON public.alteracoes_robo
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private.has_permission('robots.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.robos r
  WHERE ((r.id = alteracoes_robo.robo_id) AND (r.deleted_at IS NULL))))));

CREATE POLICY alteracoes_robo_select ON public.alteracoes_robo
  FOR SELECT
  TO authenticated
  USING ((( SELECT private.has_permission('robots.read'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.robos r
  WHERE ((r.id = alteracoes_robo.robo_id) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS can_access_cliente))))));

CREATE TABLE public.budget_action_aliases (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  action_id  uuid                     NOT NULL,
  alias      text                     NOT NULL,
  priority   integer                  DEFAULT 0 NOT NULL,
  active     boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  updated_by uuid
);

COMMENT ON TABLE public.budget_action_aliases IS 'Expressões normalizadas reconhecidas durante a importação de TXT.';

ALTER TABLE public.budget_action_aliases
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.budget_action_aliases
  ADD CONSTRAINT budget_action_aliases_alias_not_blank CHECK (btrim(alias) <> ''::text);

ALTER TABLE public.budget_action_aliases
  ADD CONSTRAINT budget_action_aliases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.budget_action_aliases
  ADD CONSTRAINT budget_action_aliases_pkey PRIMARY KEY (id);

ALTER TABLE public.budget_action_aliases
  ADD CONSTRAINT budget_action_aliases_unique UNIQUE (alias);

ALTER TABLE public.budget_action_aliases
  ADD CONSTRAINT budget_action_aliases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.budget_action_aliases TO authenticated;

GRANT ALL ON public.budget_action_aliases TO service_role;

CREATE INDEX budget_action_aliases_action_idx ON public.budget_action_aliases (action_id, active, priority DESC);

CREATE TRIGGER budget_action_aliases_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.budget_action_aliases
  FOR EACH ROW
  EXECUTE FUNCTION private.set_row_audit_fields();

CREATE POLICY budget_action_aliases_insert ON public.budget_action_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)));

CREATE POLICY budget_action_aliases_select ON public.budget_action_aliases
  FOR SELECT
  TO authenticated
  USING ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)));

CREATE POLICY budget_action_aliases_update ON public.budget_action_aliases
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)))
  WITH CHECK ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)));

CREATE TABLE public.budget_action_catalog (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  code          text                     NOT NULL,
  category      text                     DEFAULT 'Geral'::text NOT NULL,
  description   text                     NOT NULL,
  default_hours numeric(10,2)            DEFAULT 0 NOT NULL,
  sort_order    integer                  DEFAULT 0 NOT NULL,
  active        boolean                  DEFAULT true NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL,
  created_by    uuid,
  updated_by    uuid
);

COMMENT ON TABLE public.budget_action_catalog IS 'Fonte única e configurável das ações usadas em orçamentos.';

ALTER TABLE public.budget_action_catalog
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.budget_action_catalog
  ADD CONSTRAINT budget_action_catalog_code_key UNIQUE (code);

ALTER TABLE public.budget_action_catalog
  ADD CONSTRAINT budget_action_catalog_code_not_blank CHECK (btrim(code) <> ''::text);

ALTER TABLE public.budget_action_catalog
  ADD CONSTRAINT budget_action_catalog_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.budget_action_catalog
  ADD CONSTRAINT budget_action_catalog_description_not_blank CHECK (btrim(description) <> ''::text);

ALTER TABLE public.budget_action_catalog
  ADD CONSTRAINT budget_action_catalog_hours_valid CHECK (default_hours >= 0::numeric AND default_hours <= 9999::numeric);

ALTER TABLE public.budget_action_catalog
  ADD CONSTRAINT budget_action_catalog_pkey PRIMARY KEY (id);

ALTER TABLE public.budget_action_aliases
  ADD CONSTRAINT budget_action_aliases_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.budget_action_catalog(id) ON DELETE CASCADE;

ALTER TABLE public.budget_action_catalog
  ADD CONSTRAINT budget_action_catalog_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.budget_action_catalog TO authenticated;

GRANT ALL ON public.budget_action_catalog TO service_role;

CREATE INDEX budget_action_catalog_active_order_idx ON public.budget_action_catalog (active, sort_order, description);

CREATE TRIGGER budget_action_catalog_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.budget_action_catalog
  FOR EACH ROW
  EXECUTE FUNCTION private.set_row_audit_fields();

CREATE POLICY budget_action_catalog_insert ON public.budget_action_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)));

CREATE POLICY budget_action_catalog_select ON public.budget_action_catalog
  FOR SELECT
  TO authenticated
  USING ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)));

CREATE POLICY budget_action_catalog_update ON public.budget_action_catalog
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)))
  WITH CHECK ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)));

CREATE TABLE public.budget_items (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  budget_id   uuid                     NOT NULL,
  action_id   uuid,
  description text                     NOT NULL,
  hours       numeric(10,2)            NOT NULL,
  hourly_rate numeric(12,2)            NOT NULL,
  amount      numeric(14,2)            NOT NULL,
  source_line integer,
  source_text text,
  sort_order  integer                  DEFAULT 0 NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL,
  created_by  uuid,
  updated_by  uuid
);

COMMENT ON TABLE public.budget_items IS 'Snapshot dos itens, horas e valores de cada orçamento.';

ALTER TABLE public.budget_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.budget_action_catalog(id) ON DELETE SET NULL;

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_amount_matches CHECK (amount = round(hours * hourly_rate, 2));

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_amount_valid CHECK (amount >= 0::numeric);

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_description_not_blank CHECK (btrim(description) <> ''::text);

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_hours_valid CHECK (hours >= 0::numeric AND hours <= 9999::numeric);

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_pkey PRIMARY KEY (id);

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_rate_valid CHECK (hourly_rate >= 0::numeric);

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_source_line_valid CHECK (source_line IS NULL OR source_line > 0);

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.budget_items TO authenticated;

GRANT ALL ON public.budget_items TO service_role;

CREATE INDEX budget_items_budget_order_idx ON public.budget_items (budget_id, sort_order);

CREATE TRIGGER budget_items_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.budget_items
  FOR EACH ROW
  EXECUTE FUNCTION private.set_row_audit_fields();

CREATE TABLE public.budgets (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  project_name       text                     NOT NULL,
  source             text                     DEFAULT 'manual'::text NOT NULL,
  status             text                     DEFAULT 'novo'::text NOT NULL,
  source_file_name   text,
  source_content     text,
  hourly_rate        numeric(12,2)            DEFAULT 220 NOT NULL,
  commission_percent numeric(7,4)             DEFAULT 30 NOT NULL,
  total_hours        numeric(12,2)            DEFAULT 0 NOT NULL,
  subtotal           numeric(14,2)            DEFAULT 0 NOT NULL,
  total              numeric(14,2)            DEFAULT 0 NOT NULL,
  robot_id           uuid,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL,
  created_by         uuid,
  updated_by         uuid,
  deleted_at         timestamp with time zone,
  deleted_by         uuid,
  client_id          uuid,
  system_id          uuid
);

CREATE POLICY budget_items_delete ON public.budget_items
  FOR DELETE
  TO authenticated
  USING (((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)) AND (EXISTS ( SELECT 1
   FROM public.budgets b
  WHERE ((b.id = budget_items.budget_id) AND (b.deleted_at IS NULL))))));

CREATE POLICY budget_items_insert ON public.budget_items
  FOR INSERT
  TO authenticated
  WITH CHECK (((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)) AND (EXISTS ( SELECT 1
   FROM public.budgets b
  WHERE ((b.id = budget_items.budget_id) AND (b.deleted_at IS NULL))))));

CREATE POLICY budget_items_select ON public.budget_items
  FOR SELECT
  TO authenticated
  USING (((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)) AND (EXISTS ( SELECT 1
   FROM public.budgets b
  WHERE ((b.id = budget_items.budget_id) AND (b.deleted_at IS NULL))))));

CREATE POLICY budget_items_update ON public.budget_items
  FOR UPDATE
  TO authenticated
  USING (((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)) AND (EXISTS ( SELECT 1
   FROM public.budgets b
  WHERE ((b.id = budget_items.budget_id) AND (b.deleted_at IS NULL))))))
  WITH CHECK (((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)) AND (EXISTS ( SELECT 1
   FROM public.budgets b
  WHERE ((b.id = budget_items.budget_id) AND (b.deleted_at IS NULL))))));

COMMENT ON TABLE public.budgets IS 'Orçamentos manuais ou importados, preparados para vínculo opcional com robôs.';

COMMENT ON COLUMN public.budgets.client_id IS 'Cliente opcional associado ao orçamento; não é necessário para salvar.';

COMMENT ON COLUMN public.budgets.system_id IS 'Sistema opcional associado ao orçamento.';

ALTER TABLE public.budgets
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_commission_valid CHECK (commission_percent >= 0::numeric AND commission_percent <= 100::numeric);

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_deleted_by_requires_deleted_at CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL);

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_hourly_rate_valid CHECK (hourly_rate >= 0::numeric);

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_project_name_not_blank CHECK (btrim(project_name) <> ''::text);

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_robot_id_fkey FOREIGN KEY (robot_id) REFERENCES public.robos(id) ON DELETE SET NULL;

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_source_content_size CHECK (source_content IS NULL OR octet_length(source_content) <= 2000000);

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_source_file_name_length CHECK (source_file_name IS NULL OR char_length(source_file_name) <= 255);

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_source_valid CHECK (source = ANY (ARRAY['manual'::text, 'txt'::text]));

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_status_valid CHECK (status = ANY (ARRAY['novo'::text, 'enviado_comercial'::text, 'projeto_rejeitado'::text, 'arquivado'::text, 'aprovado'::text]));

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_totals_valid CHECK (total_hours >= 0::numeric AND subtotal >= 0::numeric AND total >= 0::numeric);

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.budgets TO authenticated;

GRANT ALL ON public.budgets TO service_role;

CREATE INDEX budgets_client_created_idx ON public.budgets (client_id, created_at DESC)
  WHERE deleted_at IS NULL AND client_id IS NOT NULL;

CREATE INDEX budgets_robot_idx ON public.budgets (robot_id, created_at DESC)
  WHERE deleted_at IS NULL AND robot_id IS NOT NULL;

CREATE INDEX budgets_created_idx ON public.budgets (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX budgets_system_created_idx ON public.budgets (system_id, created_at DESC)
  WHERE deleted_at IS NULL AND system_id IS NOT NULL;

CREATE TRIGGER budgets_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_row_audit_fields();

CREATE POLICY budgets_insert ON public.budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (((deleted_at IS NULL) AND (( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role))));

CREATE POLICY budgets_select ON public.budgets
  FOR SELECT
  TO authenticated
  USING (((deleted_at IS NULL) AND (( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role))));

CREATE POLICY budgets_update ON public.budgets
  FOR UPDATE
  TO authenticated
  USING (((deleted_at IS NULL) AND (( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role))))
  WITH CHECK ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_role('admin'::text) AS has_role)));

ALTER TABLE public.clientes
  ADD COLUMN cor text DEFAULT 'azul'::text NOT NULL;

COMMENT ON COLUMN public.clientes.cor IS 'Paleta visual compartilhada por todos os robôs vinculados ao cliente.';

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_cor_check CHECK (cor = ANY (ARRAY['azul'::text, 'violeta'::text, 'verde'::text, 'ambar'::text, 'rosa'::text, 'ciano'::text]));

GRANT DELETE, INSERT, SELECT, UPDATE ON public.clientes TO service_role;

CREATE TRIGGER clientes_prevent_soft_delete_with_dependencies
  BEFORE UPDATE OF deleted_at ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_cliente_soft_delete_with_dependencies();

CREATE TABLE public.dashboard_chart_preferences (
  user_id    uuid                     NOT NULL,
  cards      jsonb                    DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.dashboard_chart_preferences IS 'Configuração individual dos quadros gráficos da Dashboard, limitada a 20 cards.';

ALTER TABLE public.dashboard_chart_preferences
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dashboard_chart_preferences
  ADD CONSTRAINT dashboard_chart_preferences_cards_array CHECK (jsonb_typeof(cards) = 'array'::text);

ALTER TABLE public.dashboard_chart_preferences
  ADD CONSTRAINT dashboard_chart_preferences_cards_limit CHECK (jsonb_array_length(cards) <= 20);

ALTER TABLE public.dashboard_chart_preferences
  ADD CONSTRAINT dashboard_chart_preferences_cards_size CHECK (octet_length(cards::text) <= 30000);

ALTER TABLE public.dashboard_chart_preferences
  ADD CONSTRAINT dashboard_chart_preferences_pkey PRIMARY KEY (user_id);

ALTER TABLE public.dashboard_chart_preferences
  ADD CONSTRAINT dashboard_chart_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.dashboard_chart_preferences TO authenticated;

GRANT ALL ON public.dashboard_chart_preferences TO service_role;

CREATE TRIGGER dashboard_chart_preferences_set_updated_at
  BEFORE UPDATE ON public.dashboard_chart_preferences
  FOR EACH ROW
  EXECUTE FUNCTION private.set_dashboard_chart_preferences_updated_at();

CREATE POLICY dashboard_chart_preferences_delete_own ON public.dashboard_chart_preferences
  FOR DELETE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY dashboard_chart_preferences_insert_own ON public.dashboard_chart_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY dashboard_chart_preferences_select_own ON public.dashboard_chart_preferences
  FOR SELECT
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY dashboard_chart_preferences_update_own ON public.dashboard_chart_preferences
  FOR UPDATE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.flow_edges (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  flow_id        uuid                     NOT NULL,
  source_node_id uuid                     NOT NULL,
  target_node_id uuid                     NOT NULL,
  type           text                     DEFAULT 'conexao'::text NOT NULL,
  label          text                     DEFAULT ''::text NOT NULL,
  condition      text                     DEFAULT ''::text NOT NULL,
  description    text                     DEFAULT ''::text NOT NULL,
  created_by     uuid                     NOT NULL,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  updated_at     timestamp with time zone DEFAULT now() NOT NULL,
  updated_by     uuid,
  queue          text                     DEFAULT ''::text NOT NULL,
  label_width    double precision,
  label_height   double precision,
  source_handle  text,
  target_handle  text,
  label_offset_x numeric,
  label_offset_y numeric
);

COMMENT ON COLUMN public.flow_edges.queue IS 'Fila opcional vinculada à conexão do fluxo; exibida como informação compacta sobre a linha.';

COMMENT ON COLUMN public.flow_edges.label_width IS 'Largura opcional da etiqueta visual da conexão, em pixels.';

COMMENT ON COLUMN public.flow_edges.label_height IS 'Altura opcional da etiqueta visual da conexão, em pixels.';

COMMENT ON COLUMN public.flow_edges.source_handle IS 'Identificador opcional do ponto lateral de saída usado no editor visual.';

COMMENT ON COLUMN public.flow_edges.target_handle IS 'Identificador opcional do ponto lateral de entrada usado no editor visual.';

COMMENT ON COLUMN public.flow_edges.label_offset_x IS 'Deslocamento horizontal opcional da etiqueta em relação ao centro calculado da conexão.';

COMMENT ON COLUMN public.flow_edges.label_offset_y IS 'Deslocamento vertical opcional da etiqueta em relação ao centro calculado da conexão.';

ALTER TABLE public.flow_edges
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_distinct_nodes CHECK (source_node_id <> target_node_id);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_label_height_positive CHECK (label_height IS NULL OR label_height >= 34::double precision);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_label_offset_x_valid CHECK (label_offset_x IS NULL OR label_offset_x >= '-10000'::integer::numeric AND label_offset_x <= 10000::numeric);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_label_offset_y_valid CHECK (label_offset_y IS NULL OR label_offset_y >= '-10000'::integer::numeric AND label_offset_y <= 10000::numeric);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_label_width_positive CHECK (label_width IS NULL OR label_width >= 70::double precision);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_pkey PRIMARY KEY (id);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_source_handle_valid CHECK (source_handle IS NULL OR source_handle = 'source-right'::text);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_target_handle_valid CHECK (target_handle IS NULL OR target_handle = 'target-left'::text);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_type_not_blank CHECK (btrim(type) <> ''::text);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.flow_edges TO authenticated;

GRANT ALL ON public.flow_edges TO service_role;

CREATE INDEX flow_edges_created_by_idx ON public.flow_edges (created_by);

CREATE INDEX flow_edges_target_idx ON public.flow_edges (target_node_id);

CREATE INDEX flow_edges_updated_by_idx ON public.flow_edges (updated_by);

CREATE INDEX flow_edges_source_idx ON public.flow_edges (source_node_id);

CREATE INDEX flow_edges_flow_idx ON public.flow_edges (flow_id);

CREATE TRIGGER flow_edges_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.flow_edges
  FOR EACH ROW
  EXECUTE FUNCTION private.set_flow_row_audit_fields();

CREATE TABLE public.flow_nodes (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  flow_id    uuid                     NOT NULL,
  type       text                     NOT NULL,
  robot_id   uuid,
  position_x double precision         DEFAULT 0 NOT NULL,
  position_y double precision         DEFAULT 0 NOT NULL,
  data       jsonb                    DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid
);

ALTER TABLE public.flow_nodes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.flow_nodes
  ADD CONSTRAINT flow_nodes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.flow_nodes
  ADD CONSTRAINT flow_nodes_data_object CHECK (jsonb_typeof(data) = 'object'::text);

ALTER TABLE public.flow_nodes
  ADD CONSTRAINT flow_nodes_id_flow_unique UNIQUE (id, flow_id);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_source_same_flow_fkey FOREIGN KEY (source_node_id, flow_id) REFERENCES public.flow_nodes(id, flow_id) ON DELETE CASCADE;

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_target_same_flow_fkey FOREIGN KEY (target_node_id, flow_id) REFERENCES public.flow_nodes(id, flow_id) ON DELETE CASCADE;

ALTER TABLE public.flow_nodes
  ADD CONSTRAINT flow_nodes_pkey PRIMARY KEY (id);

ALTER TABLE public.flow_nodes
  ADD CONSTRAINT flow_nodes_robot_id_fkey FOREIGN KEY (robot_id) REFERENCES public.robos(id) ON DELETE SET NULL;

ALTER TABLE public.flow_nodes
  ADD CONSTRAINT flow_nodes_robot_link_check CHECK (type = 'robot'::text AND robot_id IS NOT NULL OR type <> 'robot'::text AND robot_id IS NULL);

ALTER TABLE public.flow_nodes
  ADD CONSTRAINT flow_nodes_type_check CHECK (type = ANY (ARRAY['robot'::text, 'trigger'::text, 'system'::text, 'decision'::text, 'note'::text, 'text'::text, 'group'::text]));

ALTER TABLE public.flow_nodes
  ADD CONSTRAINT flow_nodes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.flow_nodes TO authenticated;

GRANT ALL ON public.flow_nodes TO service_role;

CREATE INDEX flow_nodes_flow_idx ON public.flow_nodes (flow_id);

CREATE INDEX flow_nodes_updated_by_idx ON public.flow_nodes (updated_by);

CREATE INDEX flow_nodes_created_by_idx ON public.flow_nodes (created_by);

CREATE INDEX flow_nodes_robot_idx ON public.flow_nodes (robot_id)
  WHERE robot_id IS NOT NULL;

CREATE TRIGGER flow_nodes_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.flow_nodes
  FOR EACH ROW
  EXECUTE FUNCTION private.set_flow_row_audit_fields();

CREATE TABLE public.flow_versions (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  flow_id    uuid                     NOT NULL,
  version    integer                  NOT NULL,
  snapshot   jsonb                    NOT NULL,
  created_by uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.flow_versions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.flow_versions
  ADD CONSTRAINT flow_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.flow_versions
  ADD CONSTRAINT flow_versions_flow_version_unique UNIQUE (flow_id, VERSION);

ALTER TABLE public.flow_versions
  ADD CONSTRAINT flow_versions_pkey PRIMARY KEY (id);

ALTER TABLE public.flow_versions
  ADD CONSTRAINT flow_versions_snapshot_object CHECK (jsonb_typeof(snapshot) = 'object'::text);

ALTER TABLE public.flow_versions
  ADD CONSTRAINT flow_versions_version_positive CHECK (version > 0);

GRANT SELECT ON public.flow_versions TO authenticated;

GRANT ALL ON public.flow_versions TO service_role;

CREATE INDEX flow_versions_created_by_idx ON public.flow_versions (created_by);

CREATE INDEX flow_versions_flow_created_idx ON public.flow_versions (flow_id, created_at DESC);

CREATE TRIGGER flow_versions_set_audit_fields
  BEFORE INSERT ON public.flow_versions
  FOR EACH ROW
  EXECUTE FUNCTION private.set_created_audit_fields();

CREATE TABLE public.flows (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  client_id   uuid                     NOT NULL,
  name        text                     NOT NULL,
  description text                     DEFAULT ''::text NOT NULL,
  version     integer                  DEFAULT 0 NOT NULL,
  status      text                     DEFAULT 'rascunho'::text NOT NULL,
  viewport    jsonb                    DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb NOT NULL,
  created_by  uuid                     NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_by  uuid
);

CREATE POLICY flow_edges_delete ON public.flow_edges
  FOR DELETE
  TO authenticated
  USING ((( SELECT private.has_permission('flows.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_edges.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente))))));

CREATE POLICY flow_edges_insert ON public.flow_edges
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private.has_permission('flows.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_edges.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente))))));

CREATE POLICY flow_edges_select ON public.flow_edges
  FOR SELECT
  TO authenticated
  USING ((( SELECT private.has_permission('flows.read'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_edges.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente))))));

CREATE POLICY flow_edges_update ON public.flow_edges
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private.has_permission('flows.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_edges.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente))))))
  WITH CHECK ((( SELECT private.has_permission('flows.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_edges.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente))))));

CREATE POLICY flow_nodes_delete ON public.flow_nodes
  FOR DELETE
  TO authenticated
  USING ((( SELECT private.has_permission('flows.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_nodes.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente))))));

CREATE POLICY flow_nodes_insert ON public.flow_nodes
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private.has_permission('flows.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_nodes.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente)))) AND ((robot_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (public.robos r
     JOIN public.flows f ON ((f.id = flow_nodes.flow_id)))
  WHERE ((r.id = flow_nodes.robot_id) AND (r.cliente_id = f.client_id) AND (r.deleted_at IS NULL)))))));

CREATE POLICY flow_nodes_select ON public.flow_nodes
  FOR SELECT
  TO authenticated
  USING ((( SELECT private.has_permission('flows.read'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_nodes.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente))))));

CREATE POLICY flow_nodes_update ON public.flow_nodes
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private.has_permission('flows.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_nodes.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente))))))
  WITH CHECK ((( SELECT private.has_permission('flows.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_nodes.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente))))));

CREATE POLICY flow_versions_select ON public.flow_versions
  FOR SELECT
  TO authenticated
  USING ((( SELECT private.has_permission('flows.read'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_versions.flow_id) AND ( SELECT private.can_access_cliente(f.client_id) AS can_access_cliente))))));

ALTER TABLE public.flows
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.flows
  ADD CONSTRAINT flows_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;

ALTER TABLE public.flows
  ADD CONSTRAINT flows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.flows
  ADD CONSTRAINT flows_name_not_blank CHECK (btrim(name) <> ''::text);

ALTER TABLE public.flows
  ADD CONSTRAINT flows_pkey PRIMARY KEY (id);

ALTER TABLE public.flow_edges
  ADD CONSTRAINT flow_edges_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id) ON DELETE CASCADE;

ALTER TABLE public.flow_nodes
  ADD CONSTRAINT flow_nodes_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id) ON DELETE CASCADE;

ALTER TABLE public.flow_versions
  ADD CONSTRAINT flow_versions_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id) ON DELETE CASCADE;

ALTER TABLE public.flows
  ADD CONSTRAINT flows_status_check CHECK (status = ANY (ARRAY['rascunho'::text, 'publicado'::text]));

ALTER TABLE public.flows
  ADD CONSTRAINT flows_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.flows
  ADD CONSTRAINT flows_version_nonnegative CHECK (version >= 0);

ALTER TABLE public.flows
  ADD CONSTRAINT flows_viewport_object CHECK (jsonb_typeof(viewport) = 'object'::text);

GRANT DELETE, INSERT, SELECT ON public.flows TO authenticated;

GRANT UPDATE (description, name, viewport) ON public.flows TO authenticated;

GRANT ALL ON public.flows TO service_role;

CREATE INDEX flows_created_by_idx ON public.flows (created_by);

CREATE INDEX flows_updated_by_idx ON public.flows (updated_by);

CREATE INDEX flows_client_updated_idx ON public.flows (client_id, updated_at DESC);

CREATE TRIGGER flows_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.flows
  FOR EACH ROW
  EXECUTE FUNCTION private.set_flow_row_audit_fields();

CREATE POLICY flows_delete_admin ON public.flows
  FOR DELETE
  TO authenticated
  USING ((( SELECT private.has_permission('flows.delete'::text) AS has_permission) AND ( SELECT private.has_role('admin'::text) AS has_role)));

CREATE POLICY flows_insert_admin ON public.flows
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private.has_permission('flows.create'::text) AS has_permission) AND ( SELECT private.has_role('admin'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM public.clientes c
  WHERE ((c.id = flows.client_id) AND (c.deleted_at IS NULL))))));

CREATE POLICY flows_select ON public.flows
  FOR SELECT
  TO authenticated
  USING ((( SELECT private.has_permission('flows.read'::text) AS has_permission) AND ( SELECT private.can_access_cliente(flows.client_id) AS can_access_cliente)));

CREATE POLICY flows_update_authorized ON public.flows
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private.has_permission('flows.update'::text) AS has_permission) AND ( SELECT private.can_access_cliente(flows.client_id) AS can_access_cliente)))
  WITH CHECK ((( SELECT private.has_permission('flows.update'::text) AS has_permission) AND ( SELECT private.can_access_cliente(flows.client_id) AS can_access_cliente)));

GRANT DELETE, INSERT, SELECT, UPDATE ON public.permissions TO service_role;

CREATE POLICY permissions_update_admin ON public.permissions
  FOR UPDATE
  TO authenticated
  USING
    ((( SELECT private.has_permission('users.manage'::text) AS has_permission) AND ((recurso <> 'access_control'::text) OR ( SELECT private.has_role('master'::text) AS has_role))))
  WITH
    CHECK
    ((( SELECT private.has_permission('users.manage'::text) AS has_permission) AND ((recurso <> 'access_control'::text) OR ( SELECT private.has_role('master'::text) AS has_role))));

CREATE TABLE public.personal_meetings (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id      uuid                     NOT NULL,
  name         text                     NOT NULL,
  meeting_date date                     NOT NULL,
  meeting_time time without time zone   NOT NULL,
  participants text,
  notes        text                     DEFAULT ''::text NOT NULL,
  summary      text,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.personal_meetings IS 'Caderno pessoal de reuniões, isolado por usuário via RLS.';

ALTER TABLE public.personal_meetings
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.personal_meetings
  ADD CONSTRAINT personal_meetings_name_not_blank CHECK (btrim(name) <> ''::text);

ALTER TABLE public.personal_meetings
  ADD CONSTRAINT personal_meetings_pkey PRIMARY KEY (id);

ALTER TABLE public.personal_meetings
  ADD CONSTRAINT personal_meetings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.personal_meetings TO authenticated;

GRANT ALL ON public.personal_meetings TO service_role;

CREATE INDEX personal_meetings_user_schedule_idx ON public.personal_meetings (user_id, meeting_date, meeting_time);

CREATE TRIGGER personal_meetings_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.personal_meetings
  FOR EACH ROW
  EXECUTE FUNCTION private.set_personal_content_audit_fields();

CREATE POLICY personal_meetings_delete_own ON public.personal_meetings
  FOR DELETE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_meetings_insert_own ON public.personal_meetings
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_meetings_select_own ON public.personal_meetings
  FOR SELECT
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_meetings_update_own ON public.personal_meetings
  FOR UPDATE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.personal_notes (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id    uuid                     NOT NULL,
  title      text                     NOT NULL,
  content    text                     DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.personal_notes IS 'Notas livres pessoais, isoladas por usuário via RLS.';

ALTER TABLE public.personal_notes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.personal_notes
  ADD CONSTRAINT personal_notes_pkey PRIMARY KEY (id);

ALTER TABLE public.personal_notes
  ADD CONSTRAINT personal_notes_title_not_blank CHECK (btrim(title) <> ''::text);

ALTER TABLE public.personal_notes
  ADD CONSTRAINT personal_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.personal_notes TO authenticated;

GRANT ALL ON public.personal_notes TO service_role;

CREATE INDEX personal_notes_user_updated_idx ON public.personal_notes (user_id, updated_at DESC);

CREATE TRIGGER personal_notes_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.personal_notes
  FOR EACH ROW
  EXECUTE FUNCTION private.set_personal_content_audit_fields();

CREATE POLICY personal_notes_delete_own ON public.personal_notes
  FOR DELETE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_notes_insert_own ON public.personal_notes
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_notes_select_own ON public.personal_notes
  FOR SELECT
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_notes_update_own ON public.personal_notes
  FOR UPDATE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.personal_page_flows (
  user_id    uuid                     NOT NULL,
  flow_id    uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.personal_page_flows IS 'Fluxos escolhidos pelo usuário para acesso rápido em Minha página.';

ALTER TABLE public.personal_page_flows
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.personal_page_flows
  ADD CONSTRAINT personal_page_flows_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id) ON DELETE CASCADE;

ALTER TABLE public.personal_page_flows
  ADD CONSTRAINT personal_page_flows_pkey PRIMARY KEY (user_id, flow_id);

ALTER TABLE public.personal_page_flows
  ADD CONSTRAINT personal_page_flows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT ON public.personal_page_flows TO authenticated;

GRANT ALL ON public.personal_page_flows TO service_role;

CREATE INDEX personal_page_flows_user_created_idx ON public.personal_page_flows (user_id, created_at);

CREATE TRIGGER personal_page_flows_set_owner
  BEFORE INSERT ON public.personal_page_flows
  FOR EACH ROW
  EXECUTE FUNCTION private.set_personal_page_flow_owner();

CREATE POLICY personal_page_flows_delete_own ON public.personal_page_flows
  FOR DELETE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_page_flows_insert_own ON public.personal_page_flows
  FOR INSERT
  TO authenticated
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.flows
  WHERE (flows.id = personal_page_flows.flow_id)))));

CREATE POLICY personal_page_flows_select_own ON public.personal_page_flows
  FOR SELECT
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.personal_page_preferences (
  user_id          uuid                     NOT NULL,
  show_robot_table boolean                  DEFAULT false NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.personal_page_preferences IS 'Preferências pessoais dos widgets exibidos em Minha página.';

ALTER TABLE public.personal_page_preferences
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.personal_page_preferences
  ADD CONSTRAINT personal_page_preferences_pkey PRIMARY KEY (user_id);

ALTER TABLE public.personal_page_preferences
  ADD CONSTRAINT personal_page_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT INSERT, SELECT, UPDATE ON public.personal_page_preferences TO authenticated;

GRANT ALL ON public.personal_page_preferences TO service_role;

CREATE TRIGGER personal_page_preferences_set_audit
  BEFORE INSERT OR UPDATE ON public.personal_page_preferences
  FOR EACH ROW
  EXECUTE FUNCTION private.set_personal_page_preferences_audit();

CREATE POLICY personal_page_preferences_insert_own ON public.personal_page_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_page_preferences_select_own ON public.personal_page_preferences
  FOR SELECT
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_page_preferences_update_own ON public.personal_page_preferences
  FOR UPDATE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.personal_tasks (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id           uuid                     NOT NULL,
  title             text                     NOT NULL,
  note              text,
  due_date          date                     NOT NULL,
  priority          text                     DEFAULT 'medium'::text NOT NULL,
  status            text                     DEFAULT 'todo'::text NOT NULL,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  updated_at        timestamp with time zone DEFAULT now() NOT NULL,
  completed_at      timestamp with time zone,
  origin_meeting_id uuid,
  origin_note_id    uuid,
  client_id         uuid
);

COMMENT ON TABLE public.personal_tasks IS 'Tarefas pessoais da área Minha página, isoladas por usuário autenticado via RLS.';

COMMENT ON COLUMN public.personal_tasks.status IS 'Fluxo operacional do ToDo; novos registros iniciam em todo (A Fazer).';

COMMENT ON COLUMN public.personal_tasks.client_id IS 'Cliente opcional relacionado ao ToDo; a visibilidade do cliente continua limitada pelas policies de clientes.';

ALTER TABLE public.personal_tasks
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.personal_tasks
  ADD CONSTRAINT personal_tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.personal_tasks
  ADD CONSTRAINT personal_tasks_completion_consistent CHECK (status = 'completed'::text AND completed_at IS NOT NULL OR status <> 'completed'::text AND completed_at IS NULL);

ALTER TABLE public.personal_tasks
  ADD CONSTRAINT personal_tasks_origin_meeting_id_fkey FOREIGN KEY (origin_meeting_id) REFERENCES public.personal_meetings(id) ON DELETE SET NULL;

ALTER TABLE public.personal_tasks
  ADD CONSTRAINT personal_tasks_origin_note_id_fkey FOREIGN KEY (origin_note_id) REFERENCES public.personal_notes(id) ON DELETE SET NULL;

ALTER TABLE public.personal_tasks
  ADD CONSTRAINT personal_tasks_pkey PRIMARY KEY (id);

ALTER TABLE public.personal_tasks
  ADD CONSTRAINT personal_tasks_priority_check CHECK (priority = ANY (ARRAY['urgent'::text, 'high'::text, 'medium'::text, 'low'::text]));

ALTER TABLE public.personal_tasks
  ADD CONSTRAINT personal_tasks_single_origin CHECK (NOT (origin_meeting_id IS NOT NULL AND origin_note_id IS NOT NULL));

ALTER TABLE public.personal_tasks
  ADD CONSTRAINT personal_tasks_status_check
    CHECK
    (status = ANY (ARRAY['open_task'::text, 'budget'::text, 'todo'::text, 'waiting_server_update'::text, 'waiting_stack'::text, 'testing'::text, 'waiting_dev'::text,
    'waiting_client'::text, 'in_progress'::text, 'completed'::text]));

ALTER TABLE public.personal_tasks
  ADD CONSTRAINT personal_tasks_title_not_blank CHECK (btrim(title) <> ''::text);

ALTER TABLE public.personal_tasks
  ADD CONSTRAINT personal_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.personal_tasks TO authenticated;

GRANT ALL ON public.personal_tasks TO service_role;

CREATE INDEX personal_tasks_user_status_due_date_idx ON public.personal_tasks (user_id, status, due_date);

CREATE INDEX personal_tasks_user_due_date_idx ON public.personal_tasks (user_id, due_date, created_at);

CREATE INDEX personal_tasks_client_id_idx ON public.personal_tasks (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX personal_tasks_origin_note_idx ON public.personal_tasks (origin_note_id)
  WHERE origin_note_id IS NOT NULL;

CREATE INDEX personal_tasks_origin_meeting_idx ON public.personal_tasks (origin_meeting_id)
  WHERE origin_meeting_id IS NOT NULL;

CREATE TRIGGER personal_tasks_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.personal_tasks
  FOR EACH ROW
  EXECUTE FUNCTION private.set_personal_task_audit_fields();

CREATE POLICY personal_tasks_delete_own ON public.personal_tasks
  FOR DELETE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_tasks_insert_own ON public.personal_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_tasks_select_own ON public.personal_tasks
  FOR SELECT
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY personal_tasks_update_own ON public.personal_tasks
  FOR UPDATE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.profiles
  ADD COLUMN pode_editar_robos_cliente boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.profiles.pode_editar_robos_cliente IS 'Autoriza um usuário com papel Cliente a editar somente robôs do profiles.cliente_id. Não autoriza criação, arquivamento, transferência, catálogos ou documentação.';

GRANT DELETE, INSERT, SELECT, UPDATE ON public.profiles TO service_role;

ALTER TABLE public.publicacoes
  ADD CONSTRAINT publicacoes_robo_id_fkey FOREIGN KEY (robo_id) REFERENCES public.robos(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.publicacoes TO service_role;

CREATE POLICY publicacoes_insert_staff ON public.publicacoes
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.robos robot
  WHERE
    ((robot.id = publicacoes.robo_id) AND (robot.deleted_at IS NULL) AND (( SELECT private.has_permission('publications.create'::text) AS has_permission) OR ( SELECT
    private.can_update_robot(robot.cliente_id) AS can_update_robot))))));

ALTER TABLE public.regras_robo
  ADD CONSTRAINT regras_robo_robo_id_fkey FOREIGN KEY (robo_id) REFERENCES public.robos(id) ON DELETE CASCADE;

ALTER TABLE public.regras_robo
  ADD COLUMN tipo text DEFAULT 'documentacao'::text NOT NULL;

COMMENT ON COLUMN public.regras_robo.tipo IS 'Categoria da regra: documentacao ou fora_documentacao.';

ALTER TABLE public.regras_robo
  ADD CONSTRAINT regras_robo_tipo_check CHECK (tipo = ANY (ARRAY['documentacao'::text, 'fora_documentacao'::text]));

ALTER TABLE public.regras_robo
  ADD COLUMN parent_id uuid;

COMMENT ON COLUMN public.regras_robo.parent_id IS 'Regra funcional pai; permite um nível de sub-regra com numeração derivada.';

ALTER TABLE public.regras_robo
  ADD CONSTRAINT regras_robo_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.regras_robo(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.regras_robo TO service_role;

CREATE UNIQUE INDEX regras_robo_root_order_active_key ON public.regras_robo (robo_id, tipo, ordem)
  WHERE deleted_at IS NULL AND parent_id IS NULL;

CREATE UNIQUE INDEX regras_robo_child_order_active_key ON public.regras_robo (parent_id, ordem)
  WHERE deleted_at IS NULL AND parent_id IS NOT NULL;

CREATE INDEX regras_robo_parent_active_idx ON public.regras_robo (parent_id, ordem)
  WHERE deleted_at IS NULL;

CREATE TRIGGER regras_robo_validate_hierarchy
  BEFORE INSERT OR UPDATE OF parent_id, robo_id, tipo ON public.regras_robo
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_robot_requirement_hierarchy();

ALTER TABLE public.robos
  ADD CONSTRAINT robos_stack_not_blank CHECK (stack IS NULL OR btrim(stack) <> ''::text);

ALTER TABLE public.robos
  ADD COLUMN court_name text DEFAULT 'Não informado'::text NOT NULL;

ALTER TABLE public.robos
  ADD CONSTRAINT robos_court_name_not_blank CHECK (btrim(court_name) <> ''::text);

ALTER TABLE public.robos
  ADD COLUMN ideal integer DEFAULT 0 NOT NULL;

ALTER TABLE public.robos
  ADD CONSTRAINT robos_ideal_nonnegative CHECK (ideal >= 0);

ALTER TABLE public.robos
  ADD COLUMN max integer DEFAULT 0 NOT NULL;

ALTER TABLE public.robos
  ADD CONSTRAINT robos_max_greater_or_equal_ideal CHECK (max >= ideal);

ALTER TABLE public.robos
  ADD COLUMN cliente_cor text DEFAULT 'azul'::text NOT NULL;

COMMENT ON COLUMN public.robos.cliente_cor IS 'Paleta visual do badge de cliente escolhida na edição do robô.';

ALTER TABLE public.robos
  ADD CONSTRAINT robos_cliente_cor_check CHECK (cliente_cor = ANY (ARRAY['azul'::text, 'violeta'::text, 'verde'::text, 'ambar'::text, 'rosa'::text, 'ciano'::text]));

ALTER TABLE public.robos
  ADD COLUMN pacote_cor text DEFAULT 'violeta'::text NOT NULL;

COMMENT ON COLUMN public.robos.pacote_cor IS 'Paleta visual do badge de pacote escolhida na edição do robô.';

ALTER TABLE public.robos
  ADD CONSTRAINT robos_pacote_cor_check CHECK (pacote_cor = ANY (ARRAY['azul'::text, 'violeta'::text, 'verde'::text, 'ambar'::text, 'rosa'::text, 'ciano'::text]));

ALTER TABLE public.robos
  ADD COLUMN manual_path text;

COMMENT ON COLUMN public.robos.manual_path IS 'Caminho privado do manual PDF no bucket robot-manuals.';

ALTER TABLE public.robos
  ADD COLUMN manual_nome text;

COMMENT ON COLUMN public.robos.manual_nome IS 'Nome original do manual PDF exibido na aplicação.';

ALTER TABLE public.robos
  ADD CONSTRAINT robos_manual_consistente_check CHECK (manual_path IS NULL AND manual_nome IS NULL OR btrim(manual_path) <> ''::text AND btrim(manual_nome) <> ''::text);

ALTER TABLE public.robos
  ADD COLUMN disparo text DEFAULT 'Manual'::text NOT NULL;

COMMENT ON COLUMN public.robos.disparo IS 'Forma de início do robô: Agendado, Manual ou Gatilho.';

ALTER TABLE public.robos
  ADD CONSTRAINT robos_disparo_check CHECK (disparo = ANY (ARRAY['Agendado'::text, 'Manual'::text, 'Gatilho'::text]));

ALTER TABLE public.robos
  ADD COLUMN gatilho_de_robo_id uuid;

COMMENT ON COLUMN public.robos.gatilho_de_robo_id IS 'Robô do mesmo cliente que pode disparar o robô atual.';

ALTER TABLE public.robos
  ADD CONSTRAINT robos_gatilho_de_fkey FOREIGN KEY (gatilho_de_robo_id) REFERENCES public.robos(id) ON DELETE SET NULL;

ALTER TABLE public.robos
  ADD COLUMN gatilho_para_robo_id uuid;

COMMENT ON COLUMN public.robos.gatilho_para_robo_id IS 'Robô do mesmo cliente que pode ser disparado pelo robô atual.';

ALTER TABLE public.robos
  ADD CONSTRAINT robos_gatilho_para_fkey FOREIGN KEY (gatilho_para_robo_id) REFERENCES public.robos(id) ON DELETE SET NULL;

ALTER TABLE public.robos
  ADD CONSTRAINT robos_gatilhos_nao_autorreferentes_check CHECK (gatilho_de_robo_id IS DISTINCT FROM id AND gatilho_para_robo_id IS DISTINCT FROM id);

ALTER TABLE public.robos
  ADD COLUMN version_checked_at timestamp with time zone;

COMMENT ON COLUMN public.robos.version_checked_at IS 'Data e hora da última consulta de versão concluída com sucesso no registry interno.';

ALTER TABLE public.robos
  ADD COLUMN command text DEFAULT ''::text NOT NULL;

COMMENT ON COLUMN public.robos.command IS 'Comando técnico utilizado para executar o robô.';

ALTER TABLE public.robos
  ADD COLUMN product_type text DEFAULT 'INTEGRADOR'::text NOT NULL;

COMMENT ON COLUMN public.robos.product_type IS 'Produto ao qual o robô pertence: INTEGRADOR, CONSULTA_PROCESSUAL, PETICIONAMENTO ou MOVIMENTO.';

ALTER TABLE public.robos
  ADD CONSTRAINT robos_integrador_requires_cliente_check CHECK (product_type <> 'INTEGRADOR'::text OR cliente_id IS NOT NULL);

ALTER TABLE public.robos
  ADD CONSTRAINT robos_product_type_check CHECK (product_type = ANY (ARRAY['INTEGRADOR'::text, 'CONSULTA_PROCESSUAL'::text, 'PETICIONAMENTO'::text, 'MOVIMENTO'::text]));

ALTER TABLE public.robos
  ADD COLUMN tribunal text;

COMMENT ON COLUMN public.robos.tribunal IS 'Tribunal atendido pelo robô; deve permanecer nulo para robôs integradores.';

ALTER TABLE public.robos
  ADD COLUMN tribunal_system text;

COMMENT ON COLUMN public.robos.tribunal_system IS 'Sistema do tribunal atendido pelo robô; deve permanecer nulo para robôs integradores.';

ALTER TABLE public.robos
  ADD CONSTRAINT robos_integrador_without_tribunal_check CHECK (product_type <> 'INTEGRADOR'::text OR tribunal IS NULL AND tribunal_system IS NULL);

ALTER TABLE public.robos
  ADD COLUMN package_id uuid;

ALTER TABLE public.robos
  ADD COLUMN stack_id uuid;

ALTER TABLE public.robos
  ADD COLUMN queue_id uuid;

ALTER TABLE public.robos
  ADD COLUMN command_id uuid;

ALTER TABLE public.robos
  ADD COLUMN system_id uuid;

COMMENT ON COLUMN public.robos.system_id IS 'Sistema relacional; sistema permanece como snapshot compatível.';

ALTER TABLE public.robos
  ADD COLUMN kortex boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.robos.kortex IS 'Indica se o robô utiliza Kortex.';

GRANT DELETE ON public.robos TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.robos TO service_role;

CREATE INDEX robos_command_id_idx ON public.robos (command_id)
  WHERE command_id IS NOT NULL;

CREATE INDEX robos_gatilho_de_active_idx ON public.robos (gatilho_de_robo_id)
  WHERE deleted_at IS NULL AND gatilho_de_robo_id IS NOT NULL;

CREATE INDEX robos_gatilho_para_active_idx ON public.robos (gatilho_para_robo_id)
  WHERE deleted_at IS NULL AND gatilho_para_robo_id IS NOT NULL;

CREATE INDEX robos_product_type_active_name_idx ON public.robos (product_type, nome)
  WHERE deleted_at IS NULL;

CREATE INDEX robos_system_id_idx ON public.robos (system_id);

CREATE INDEX robos_package_id_idx ON public.robos (package_id);

CREATE INDEX robos_stack_id_idx ON public.robos (stack_id);

CREATE INDEX robos_queue_id_idx ON public.robos (queue_id);

CREATE TRIGGER robos_audit_master_delete
  BEFORE DELETE ON public.robos
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_master_robot_delete();

CREATE TRIGGER robos_protect_client_update
  BEFORE UPDATE ON public.robos
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_client_robot_update();

CREATE TRIGGER robos_set_package_color
  BEFORE INSERT OR UPDATE OF pacote ON public.robos
  FOR EACH ROW
  EXECUTE FUNCTION private.set_robot_package_color();

CREATE TRIGGER robos_validate_trigger_relationships
  BEFORE INSERT OR UPDATE OF cliente_id, gatilho_de_robo_id, gatilho_para_robo_id ON public.robos
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_robot_trigger_relationships();

CREATE POLICY robos_delete_master ON public.robos
  FOR DELETE
  TO authenticated
  USING (( SELECT private.has_role('master'::text) AS has_role));

CREATE POLICY robos_update_staff ON public.robos
  FOR UPDATE
  TO authenticated
  USING (((deleted_at IS NULL) AND ( SELECT private.can_update_robot(robos.cliente_id) AS can_update_robot)))
  WITH CHECK (((deleted_at IS NULL) AND ( SELECT private.can_update_robot(robos.cliente_id) AS can_update_robot)));

CREATE TABLE public.robot_center_documentation_blocks (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  draft_id         uuid                     NOT NULL,
  requirement_id   uuid,
  type             text                     NOT NULL,
  ordem            integer                  NOT NULL,
  content          text                     DEFAULT ''::text NOT NULL,
  metadata         jsonb                    DEFAULT '{}'::jsonb NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  created_by       uuid,
  updated_by       uuid,
  deleted_at       timestamp with time zone,
  deleted_by       uuid,
  section_id       uuid,
  related_block_id uuid
);

COMMENT ON TABLE public.robot_center_documentation_blocks IS 'Blocos documentais vinculados por UUID às regras reais do robô.';

COMMENT ON COLUMN public.robot_center_documentation_blocks.section_id IS 'Seção proprietária quando o bloco não estiver vinculado a uma regra.';

COMMENT ON COLUMN public.robot_center_documentation_blocks.related_block_id IS 'Relação lógica entre blocos, utilizada inicialmente por legenda e imagem.';

ALTER TABLE public.robot_center_documentation_blocks
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_deleted_consistency CHECK (deleted_at IS NULL AND deleted_by IS NULL OR deleted_at IS NOT NULL AND deleted_by IS NOT NULL);

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'::text);

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_order_nonnegative CHECK (ordem >= 0);

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_owner_check CHECK (num_nonnulls(requirement_id, section_id) = 1);

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_pkey PRIMARY KEY (id);

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_related_block_id_fkey FOREIGN KEY (related_block_id) REFERENCES public.robot_center_documentation_blocks(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.regras_robo(id) ON DELETE SET NULL;

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_type_check CHECK (type = ANY (ARRAY['text'::text, 'image'::text, 'caption'::text, 'note'::text, 'page_break'::text]));

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.robot_center_documentation_blocks TO authenticated;

GRANT ALL ON public.robot_center_documentation_blocks TO service_role;

CREATE INDEX robot_center_documentation_blocks_related_idx ON public.robot_center_documentation_blocks (related_block_id)
  WHERE deleted_at IS NULL AND related_block_id IS NOT NULL;

CREATE INDEX robot_center_documentation_blocks_section_active_idx ON public.robot_center_documentation_blocks (section_id, ordem)
  WHERE deleted_at IS NULL AND section_id IS NOT NULL;

CREATE UNIQUE INDEX robot_center_documentation_blocks_section_order_active_key ON public.robot_center_documentation_blocks (draft_id, section_id, ordem)
  WHERE deleted_at IS NULL AND section_id IS NOT NULL;

CREATE UNIQUE INDEX robot_center_documentation_blocks_requirement_order_active_key ON public.robot_center_documentation_blocks (draft_id, requirement_id, ordem)
  WHERE deleted_at IS NULL AND requirement_id IS NOT NULL;

CREATE INDEX robot_center_documentation_blocks_requirement_active_idx ON public.robot_center_documentation_blocks (requirement_id, ordem)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX robot_center_documentation_caption_image_active_key ON public.robot_center_documentation_blocks (related_block_id)
  WHERE deleted_at IS NULL AND TYPE = 'caption'::text AND related_block_id IS NOT NULL;

CREATE TRIGGER robot_center_documentation_blocks_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_center_documentation_blocks
  FOR EACH ROW
  EXECUTE FUNCTION private.set_robot_center_documentation_audit_fields();

CREATE TRIGGER robot_center_documentation_blocks_validate_relationship
  BEFORE INSERT OR UPDATE OF draft_id, requirement_id ON public.robot_center_documentation_blocks
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_robot_documentation_block();

CREATE TABLE public.robot_center_documentation_drafts (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  documentation_id uuid                     NOT NULL,
  revision         integer                  DEFAULT 0 NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  created_by       uuid,
  updated_by       uuid
);

ALTER TABLE public.robot_center_documentation_drafts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_center_documentation_drafts
  ADD CONSTRAINT robot_center_documentation_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_drafts
  ADD CONSTRAINT robot_center_documentation_drafts_documentation_unique UNIQUE (documentation_id);

ALTER TABLE public.robot_center_documentation_drafts
  ADD CONSTRAINT robot_center_documentation_drafts_pkey PRIMARY KEY (id);

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.robot_center_documentation_drafts(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_drafts
  ADD CONSTRAINT robot_center_documentation_drafts_revision_nonnegative CHECK (revision >= 0);

ALTER TABLE public.robot_center_documentation_drafts
  ADD CONSTRAINT robot_center_documentation_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.robot_center_documentation_drafts TO authenticated;

GRANT ALL ON public.robot_center_documentation_drafts TO service_role;

CREATE TRIGGER robot_center_documentation_drafts_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_center_documentation_drafts
  FOR EACH ROW
  EXECUTE FUNCTION private.set_robot_center_documentation_audit_fields();

CREATE TABLE public.robot_center_documentation_sections (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  draft_id    uuid                     NOT NULL,
  section_key text                     NOT NULL,
  content     text                     DEFAULT ''::text NOT NULL,
  ordem       integer                  NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL,
  created_by  uuid,
  updated_by  uuid
);

COMMENT ON TABLE public.robot_center_documentation_sections IS 'Conteúdo editável das seções fixas do rascunho Robot Center.';

ALTER TABLE public.robot_center_documentation_sections
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_center_documentation_sections
  ADD CONSTRAINT robot_center_documentation_sections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_sections
  ADD CONSTRAINT robot_center_documentation_sections_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.robot_center_documentation_drafts(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_sections
  ADD CONSTRAINT robot_center_documentation_sections_draft_key_unique UNIQUE (draft_id, section_key);

ALTER TABLE public.robot_center_documentation_sections
  ADD CONSTRAINT robot_center_documentation_sections_draft_order_unique UNIQUE (draft_id, ordem);

ALTER TABLE public.robot_center_documentation_sections
  ADD CONSTRAINT robot_center_documentation_sections_key_check
    CHECK (section_key = ANY (ARRAY['objective'::text, 'reference_materials'::text, 'overview'::text, 'limitations'::text, 'scope'::text, 'execution_errors'::text]));

ALTER TABLE public.robot_center_documentation_sections
  ADD CONSTRAINT robot_center_documentation_sections_order_nonnegative CHECK (ordem >= 0);

ALTER TABLE public.robot_center_documentation_sections
  ADD CONSTRAINT robot_center_documentation_sections_pkey PRIMARY KEY (id);

ALTER TABLE public.robot_center_documentation_blocks
  ADD CONSTRAINT robot_center_documentation_blocks_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.robot_center_documentation_sections(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_sections
  ADD CONSTRAINT robot_center_documentation_sections_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.robot_center_documentation_sections TO authenticated;

GRANT ALL ON public.robot_center_documentation_sections TO service_role;

CREATE INDEX robot_center_documentation_sections_draft_idx ON public.robot_center_documentation_sections (draft_id, ordem);

CREATE TRIGGER robot_center_documentation_sections_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_center_documentation_sections
  FOR EACH ROW
  EXECUTE FUNCTION private.set_robot_center_documentation_audit_fields();

CREATE TABLE public.robot_center_documentation_templates (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name         text                     NOT NULL,
  version      integer                  NOT NULL,
  storage_path text                     NOT NULL,
  active       boolean                  DEFAULT false NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL,
  created_by   uuid,
  updated_by   uuid
);

COMMENT ON TABLE public.robot_center_documentation_templates IS 'Templates DOCX mestres privados; o arquivo nunca é alterado durante a publicação.';

ALTER TABLE public.robot_center_documentation_templates
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_center_documentation_templates
  ADD CONSTRAINT robot_center_documentation_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_templates
  ADD CONSTRAINT robot_center_documentation_templates_name_not_blank CHECK (btrim(name) <> ''::text);

ALTER TABLE public.robot_center_documentation_templates
  ADD CONSTRAINT robot_center_documentation_templates_name_version_unique UNIQUE (name, VERSION);

ALTER TABLE public.robot_center_documentation_templates
  ADD CONSTRAINT robot_center_documentation_templates_path_not_blank CHECK (btrim(storage_path) <> ''::text);

ALTER TABLE public.robot_center_documentation_templates
  ADD CONSTRAINT robot_center_documentation_templates_pkey PRIMARY KEY (id);

ALTER TABLE public.robot_center_documentation_templates
  ADD CONSTRAINT robot_center_documentation_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_templates
  ADD CONSTRAINT robot_center_documentation_templates_version_positive CHECK (version > 0);

GRANT SELECT ON public.robot_center_documentation_templates TO authenticated;

GRANT ALL ON public.robot_center_documentation_templates TO service_role;

CREATE UNIQUE INDEX robot_center_documentation_templates_one_active_idx ON public.robot_center_documentation_templates (active)
  WHERE active;

CREATE TRIGGER robot_center_documentation_templates_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_center_documentation_templates
  FOR EACH ROW
  EXECUTE FUNCTION private.set_robot_center_documentation_audit_fields();

CREATE POLICY robot_center_documentation_templates_select_admin ON public.robot_center_documentation_templates
  FOR SELECT
  TO authenticated
  USING ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission)));

CREATE TABLE public.robot_center_documentation_versions (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  documentation_id uuid                     NOT NULL,
  version          integer                  NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  created_by       uuid                     NOT NULL,
  status           text                     DEFAULT 'generating'::text NOT NULL,
  snapshot         jsonb                    DEFAULT '{}'::jsonb NOT NULL,
  template_id      uuid,
  template_version integer,
  docx_path        text,
  pdf_path         text,
  generation_token uuid,
  error_message    text,
  started_at       timestamp with time zone DEFAULT now() NOT NULL,
  published_at     timestamp with time zone,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_by       uuid
);

COMMENT ON COLUMN public.robot_center_documentation_versions.version IS 'Sequência interna: 1=v1.0, 2=v1.1, 3=v1.2.';

COMMENT ON COLUMN public.robot_center_documentation_versions.snapshot IS 'Snapshot completo e imutável após publicação.';

ALTER TABLE public.robot_center_documentation_versions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_center_documentation_versions
  ADD CONSTRAINT robot_center_documentation_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_versions
  ADD CONSTRAINT robot_center_documentation_versions_documentation_version_uniqu UNIQUE (documentation_id, VERSION);

ALTER TABLE public.robot_center_documentation_versions
  ADD CONSTRAINT robot_center_documentation_versions_pkey PRIMARY KEY (id);

ALTER TABLE public.robot_center_documentation_versions
  ADD CONSTRAINT robot_center_documentation_versions_published_files_check CHECK (status <> 'published'::text OR docx_path IS NOT NULL AND pdf_path IS NOT NULL AND published_at IS
    NOT NULL);

ALTER TABLE public.robot_center_documentation_versions
  ADD CONSTRAINT robot_center_documentation_versions_snapshot_object_check CHECK (jsonb_typeof(snapshot) = 'object'::text);

ALTER TABLE public.robot_center_documentation_versions
  ADD CONSTRAINT robot_center_documentation_versions_status_check CHECK (status = ANY (ARRAY['generating'::text, 'published'::text, 'failed'::text]));

ALTER TABLE public.robot_center_documentation_versions
  ADD CONSTRAINT robot_center_documentation_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.robot_center_documentation_templates(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_versions
  ADD CONSTRAINT robot_center_documentation_versions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_versions
  ADD CONSTRAINT robot_center_documentation_versions_version_positive CHECK (version > 0);

GRANT INSERT, SELECT, UPDATE ON public.robot_center_documentation_versions TO authenticated;

GRANT ALL ON public.robot_center_documentation_versions TO service_role;

CREATE INDEX robot_center_documentation_versions_documentation_created_idx ON public.robot_center_documentation_versions (documentation_id, created_at DESC);

CREATE UNIQUE INDEX robot_center_documentation_versions_one_generating_idx ON public.robot_center_documentation_versions (documentation_id)
  WHERE status = 'generating'::text;

CREATE UNIQUE INDEX robot_center_documentation_versions_generation_token_idx ON public.robot_center_documentation_versions (generation_token)
  WHERE generation_token IS NOT NULL;

CREATE TRIGGER robot_center_documentation_versions_immutable
  BEFORE DELETE OR UPDATE ON public.robot_center_documentation_versions
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_robot_center_documentation_version_mutation();

CREATE TABLE public.robot_center_documentations (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  robo_id            uuid,
  status             text                     DEFAULT 'draft'::text NOT NULL,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL,
  created_by         uuid,
  updated_by         uuid,
  deleted_at         timestamp with time zone,
  deleted_by         uuid,
  current_version_id uuid
);

CREATE POLICY robot_center_documentation_blocks_admin ON public.robot_center_documentation_blocks
  TO authenticated
  USING
    (((deleted_at IS NULL) AND ( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS
    has_permission) AND (EXISTS ( SELECT 1
   FROM ((public.robot_center_documentation_drafts dr
     JOIN public.robot_center_documentations d ON ((d.id = dr.documentation_id)))
     JOIN public.robos r ON ((r.id = d.robo_id)))
  WHERE
    ((dr.id = robot_center_documentation_blocks.draft_id) AND (d.deleted_at IS NULL) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS
    can_access_cliente))))))
  WITH
    CHECK
    ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM ((public.robot_center_documentation_drafts dr
     JOIN public.robot_center_documentations d ON ((d.id = dr.documentation_id)))
     JOIN public.robos r ON ((r.id = d.robo_id)))
  WHERE
    ((dr.id = robot_center_documentation_blocks.draft_id) AND (d.deleted_at IS NULL) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS
    can_access_cliente))))));

CREATE POLICY robot_center_documentation_drafts_insert_admin ON public.robot_center_documentation_drafts
  FOR INSERT
  TO authenticated
  WITH
    CHECK
    ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM (public.robot_center_documentations d
     JOIN public.robos r ON ((r.id = d.robo_id)))
  WHERE
    ((d.id = robot_center_documentation_drafts.documentation_id) AND (d.deleted_at IS NULL) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS
    can_access_cliente))))));

CREATE POLICY robot_center_documentation_drafts_select_admin ON public.robot_center_documentation_drafts
  FOR SELECT
  TO authenticated
  USING
    ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM (public.robot_center_documentations d
     JOIN public.robos r ON ((r.id = d.robo_id)))
  WHERE
    ((d.id = robot_center_documentation_drafts.documentation_id) AND (d.deleted_at IS NULL) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS
    can_access_cliente))))));

CREATE POLICY robot_center_documentation_drafts_update_admin ON public.robot_center_documentation_drafts
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission)))
  WITH
    CHECK
    ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM (public.robot_center_documentations d
     JOIN public.robos r ON ((r.id = d.robo_id)))
  WHERE
    ((d.id = robot_center_documentation_drafts.documentation_id) AND (d.deleted_at IS NULL) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS
    can_access_cliente))))));

CREATE POLICY robot_center_documentation_sections_admin ON public.robot_center_documentation_sections
  TO authenticated
  USING
    ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM ((public.robot_center_documentation_drafts dr
     JOIN public.robot_center_documentations d ON ((d.id = dr.documentation_id)))
     JOIN public.robos r ON ((r.id = d.robo_id)))
  WHERE
    ((dr.id = robot_center_documentation_sections.draft_id) AND (d.deleted_at IS NULL) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS
    can_access_cliente))))))
  WITH
    CHECK
    ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM ((public.robot_center_documentation_drafts dr
     JOIN public.robot_center_documentations d ON ((d.id = dr.documentation_id)))
     JOIN public.robos r ON ((r.id = d.robo_id)))
  WHERE
    ((dr.id = robot_center_documentation_sections.draft_id) AND (d.deleted_at IS NULL) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS
    can_access_cliente))))));

CREATE POLICY robot_center_documentation_versions_insert_admin ON public.robot_center_documentation_versions
  FOR INSERT
  TO authenticated
  WITH
    CHECK
    ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission) AND (created_by = (
    SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (public.robot_center_documentations d
     JOIN public.robos r ON ((r.id = d.robo_id)))
  WHERE
    ((d.id = robot_center_documentation_versions.documentation_id) AND (d.deleted_at IS NULL) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS
    can_access_cliente))))));

CREATE POLICY robot_center_documentation_versions_select ON public.robot_center_documentation_versions
  FOR SELECT
  TO authenticated
  USING ((( SELECT private.has_permission('robot_center_documentation.read'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM (public.robot_center_documentations d
     JOIN public.robos r ON ((r.id = d.robo_id)))
  WHERE
    ((d.id = robot_center_documentation_versions.documentation_id) AND (d.deleted_at IS NULL) AND (r.deleted_at IS NULL) AND ((d.status = 'published'::text) OR (( SELECT
    private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission))) AND
    ( SELECT private.can_access_cliente(r.cliente_id) AS can_access_cliente))))));

CREATE POLICY robot_center_documentation_versions_update_admin ON public.robot_center_documentation_versions
  FOR UPDATE
  TO authenticated
  USING
    (((status = ANY (ARRAY['generating'::text, 'failed'::text])) AND ( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT
    private.has_permission('robot_center_documentation.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM (public.robot_center_documentations d
     JOIN public.robos r ON ((r.id = d.robo_id)))
  WHERE
    ((d.id = robot_center_documentation_versions.documentation_id) AND (d.deleted_at IS NULL) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS
    can_access_cliente))))))
  WITH CHECK ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission)));

ALTER TABLE public.robot_center_documentations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_center_documentations
  ADD CONSTRAINT robot_center_documentations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentations
  ADD CONSTRAINT robot_center_documentations_current_version_id_fkey FOREIGN KEY (current_version_id) REFERENCES public.robot_center_documentation_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentations
  ADD CONSTRAINT robot_center_documentations_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentations
  ADD CONSTRAINT robot_center_documentations_deleted_consistency CHECK (deleted_at IS NULL AND deleted_by IS NULL OR deleted_at IS NOT NULL AND deleted_by IS NOT NULL);

ALTER TABLE public.robot_center_documentations
  ADD CONSTRAINT robot_center_documentations_pkey PRIMARY KEY (id);

ALTER TABLE public.robot_center_documentation_drafts
  ADD CONSTRAINT robot_center_documentation_drafts_documentation_id_fkey FOREIGN KEY (documentation_id) REFERENCES public.robot_center_documentations(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentation_versions
  ADD CONSTRAINT robot_center_documentation_versions_documentation_id_fkey FOREIGN KEY (documentation_id) REFERENCES public.robot_center_documentations(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_center_documentations
  ADD CONSTRAINT robot_center_documentations_robo_id_fkey FOREIGN KEY (robo_id) REFERENCES public.robos(id) ON DELETE SET NULL;

ALTER TABLE public.robot_center_documentations
  ADD CONSTRAINT robot_center_documentations_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]));

ALTER TABLE public.robot_center_documentations
  ADD CONSTRAINT robot_center_documentations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.robot_center_documentations TO authenticated;

GRANT ALL ON public.robot_center_documentations TO service_role;

CREATE INDEX robot_center_documentations_robo_active_idx ON public.robot_center_documentations (robo_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX robot_center_documentations_robo_active_key ON public.robot_center_documentations (robo_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER robot_center_documentations_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_center_documentations
  FOR EACH ROW
  EXECUTE FUNCTION private.set_robot_center_documentation_audit_fields();

CREATE POLICY robot_center_documentations_insert_admin ON public.robot_center_documentations
  FOR INSERT
  TO authenticated
  WITH
    CHECK
    ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.robos r
  WHERE ((r.id = robot_center_documentations.robo_id) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS can_access_cliente))))));

CREATE POLICY robot_center_documentations_select ON public.robot_center_documentations
  FOR SELECT
  TO authenticated
  USING
    (((deleted_at IS NULL) AND ( SELECT private.has_permission('robot_center_documentation.read'::text) AS has_permission) AND ((status = 'published'::text) OR (( SELECT
    private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission))) AND (EXISTS ( SELECT 1
   FROM public.robos r
  WHERE ((r.id = robot_center_documentations.robo_id) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS can_access_cliente))))));

CREATE POLICY robot_center_documentations_update_admin ON public.robot_center_documentations
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission)))
  WITH
    CHECK
    ((( SELECT private.has_role('admin'::text) AS has_role) AND ( SELECT private.has_permission('robot_center_documentation.manage'::text) AS has_permission) AND ((deleted_at IS
    NULL) OR ( SELECT private.has_role('master'::text) AS has_role)) AND (EXISTS ( SELECT 1
   FROM public.robos robot
  WHERE ((robot.id = robot_center_documentations.robo_id) AND (robot.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(robot.cliente_id) AS can_access_cliente))))));

CREATE TABLE public.robot_commands (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name       text                     NOT NULL,
  command    text                     NOT NULL,
  active     boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid
);

ALTER TABLE public.robot_commands
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_commands
  ADD CONSTRAINT robot_commands_command_not_blank CHECK (btrim(command) <> ''::text);

ALTER TABLE public.robot_commands
  ADD CONSTRAINT robot_commands_name_not_blank CHECK (btrim(name) <> ''::text);

ALTER TABLE public.robot_commands
  ADD CONSTRAINT robot_commands_pkey PRIMARY KEY (id);

ALTER TABLE public.robos
  ADD CONSTRAINT robos_command_id_fkey FOREIGN KEY (command_id) REFERENCES public.robot_commands(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.robot_commands TO authenticated;

GRANT ALL ON public.robot_commands TO service_role;

CREATE UNIQUE INDEX robot_commands_command_key ON public.robot_commands (lower(btrim(command)));

CREATE UNIQUE INDEX robot_commands_name_key ON public.robot_commands (lower(btrim(name)));

CREATE TRIGGER robot_commands_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_commands
  FOR EACH ROW
  EXECUTE FUNCTION private.set_row_audit_fields();

CREATE TRIGGER robot_commands_sync_robots
  AFTER UPDATE OF command ON public.robot_commands
  FOR EACH ROW
  WHEN (old.command IS DISTINCT FROM new.command)
  EXECUTE FUNCTION private.sync_robot_command_values();

CREATE POLICY robot_commands_insert ON public.robot_commands
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission));

CREATE POLICY robot_commands_select ON public.robot_commands
  FOR SELECT
  TO authenticated
  USING (( SELECT private.has_permission('robot_catalog.read'::text) AS has_permission));

CREATE POLICY robot_commands_update ON public.robot_commands
  FOR UPDATE
  TO authenticated
  USING (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission));

CREATE TABLE public.robot_packages (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name       text                     NOT NULL,
  color      text                     DEFAULT 'violeta'::text NOT NULL,
  active     boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid
);

ALTER TABLE public.robot_packages
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_packages
  ADD CONSTRAINT robot_packages_color_check CHECK (color = ANY (ARRAY['azul'::text, 'violeta'::text, 'verde'::text, 'ambar'::text, 'rosa'::text, 'ciano'::text]));

ALTER TABLE public.robot_packages
  ADD CONSTRAINT robot_packages_name_not_blank CHECK (btrim(name) <> ''::text);

ALTER TABLE public.robot_packages
  ADD CONSTRAINT robot_packages_pkey PRIMARY KEY (id);

ALTER TABLE public.robos
  ADD CONSTRAINT robos_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.robot_packages(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.robot_packages TO authenticated;

GRANT ALL ON public.robot_packages TO service_role;

CREATE UNIQUE INDEX robot_packages_name_key ON public.robot_packages (lower(btrim(name)));

CREATE TRIGGER robot_packages_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_packages
  FOR EACH ROW
  EXECUTE FUNCTION private.set_row_audit_fields();

CREATE TRIGGER robot_packages_sync_robots
  AFTER UPDATE OF name, color ON public.robot_packages
  FOR EACH ROW
  WHEN (old.name IS DISTINCT FROM new.name OR old.color IS DISTINCT FROM new.color)
  EXECUTE FUNCTION private.sync_robot_package_values();

CREATE POLICY robot_packages_insert ON public.robot_packages
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission));

CREATE POLICY robot_packages_select ON public.robot_packages
  FOR SELECT
  TO authenticated
  USING (( SELECT private.has_permission('robot_catalog.read'::text) AS has_permission));

CREATE POLICY robot_packages_update ON public.robot_packages
  FOR UPDATE
  TO authenticated
  USING (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission));

CREATE TABLE public.robot_queues (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name       text                     NOT NULL,
  active     boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid
);

ALTER TABLE public.robot_queues
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_queues
  ADD CONSTRAINT robot_queues_name_not_blank CHECK (btrim(name) <> ''::text);

ALTER TABLE public.robot_queues
  ADD CONSTRAINT robot_queues_pkey PRIMARY KEY (id);

ALTER TABLE public.robos
  ADD CONSTRAINT robos_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.robot_queues(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.robot_queues TO authenticated;

GRANT ALL ON public.robot_queues TO service_role;

CREATE UNIQUE INDEX robot_queues_name_key ON public.robot_queues (lower(btrim(name)));

CREATE TRIGGER robot_queues_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_queues
  FOR EACH ROW
  EXECUTE FUNCTION private.set_row_audit_fields();

CREATE TRIGGER robot_queues_sync_robots
  AFTER UPDATE OF name ON public.robot_queues
  FOR EACH ROW
  WHEN (old.name IS DISTINCT FROM new.name)
  EXECUTE FUNCTION private.sync_robot_queue_values();

CREATE POLICY robot_queues_insert ON public.robot_queues
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission));

CREATE POLICY robot_queues_select ON public.robot_queues
  FOR SELECT
  TO authenticated
  USING (( SELECT private.has_permission('robot_catalog.read'::text) AS has_permission));

CREATE POLICY robot_queues_update ON public.robot_queues
  FOR UPDATE
  TO authenticated
  USING (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission));

CREATE TABLE public.robot_stacks (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name       text                     NOT NULL,
  active     boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid
);

ALTER TABLE public.robot_stacks
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_stacks
  ADD CONSTRAINT robot_stacks_name_not_blank CHECK (btrim(name) <> ''::text);

ALTER TABLE public.robot_stacks
  ADD CONSTRAINT robot_stacks_pkey PRIMARY KEY (id);

ALTER TABLE public.robos
  ADD CONSTRAINT robos_stack_id_fkey FOREIGN KEY (stack_id) REFERENCES public.robot_stacks(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.robot_stacks TO authenticated;

GRANT ALL ON public.robot_stacks TO service_role;

CREATE UNIQUE INDEX robot_stacks_name_key ON public.robot_stacks (lower(btrim(name)));

CREATE TRIGGER robot_stacks_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_stacks
  FOR EACH ROW
  EXECUTE FUNCTION private.set_row_audit_fields();

CREATE TRIGGER robot_stacks_sync_robots
  AFTER UPDATE OF name ON public.robot_stacks
  FOR EACH ROW
  WHEN (old.name IS DISTINCT FROM new.name)
  EXECUTE FUNCTION private.sync_robot_stack_values();

CREATE POLICY robot_stacks_insert ON public.robot_stacks
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission));

CREATE POLICY robot_stacks_select ON public.robot_stacks
  FOR SELECT
  TO authenticated
  USING (( SELECT private.has_permission('robot_catalog.read'::text) AS has_permission));

CREATE POLICY robot_stacks_update ON public.robot_stacks
  FOR UPDATE
  TO authenticated
  USING (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission));

CREATE TABLE public.robot_systems (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name       text                     NOT NULL,
  active     boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid
);

COMMENT ON TABLE public.robot_systems IS 'Catálogo relacional de sistemas usado por robôs e orçamentos.';

ALTER TABLE public.robot_systems
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_systems
  ADD CONSTRAINT robot_systems_name_not_blank CHECK (btrim(name) <> ''::text);

ALTER TABLE public.robot_systems
  ADD CONSTRAINT robot_systems_pkey PRIMARY KEY (id);

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.robot_systems(id) ON DELETE SET NULL;

ALTER TABLE public.robos
  ADD CONSTRAINT robos_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.robot_systems(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.robot_systems TO authenticated;

GRANT ALL ON public.robot_systems TO service_role;

CREATE UNIQUE INDEX robot_systems_name_key ON public.robot_systems (lower(btrim(name)));

CREATE TRIGGER robot_systems_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_systems
  FOR EACH ROW
  EXECUTE FUNCTION private.set_row_audit_fields();

CREATE TRIGGER robot_systems_sync_robots
  AFTER UPDATE OF name ON public.robot_systems
  FOR EACH ROW
  WHEN (old.name IS DISTINCT FROM new.name)
  EXECUTE FUNCTION private.sync_robot_system_values();

CREATE POLICY robot_systems_insert ON public.robot_systems
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission));

CREATE POLICY robot_systems_select ON public.robot_systems
  FOR SELECT
  TO authenticated
  USING (( SELECT private.has_permission('robot_catalog.read'::text) AS has_permission));

CREATE POLICY robot_systems_update ON public.robot_systems
  FOR UPDATE
  TO authenticated
  USING (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('robot_catalog.manage'::text) AS has_permission));

CREATE TABLE public.robot_uploaded_documents (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  robot_id     uuid                     NOT NULL,
  storage_path text                     NOT NULL,
  file_name    text                     NOT NULL,
  mime_type    text                     NOT NULL,
  size_bytes   bigint,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL,
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamp with time zone,
  deleted_by   uuid
);

COMMENT ON TABLE public.robot_uploaded_documents IS 'Metadados dos documentos e anexos privados enviados para cada robô.';

ALTER TABLE public.robot_uploaded_documents
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_deleted_by_requires_deleted_at CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL);

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_mime_not_blank CHECK (btrim(mime_type) <> ''::text);

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_name_not_blank CHECK (btrim(file_name) <> ''::text);

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_path_not_blank CHECK (btrim(storage_path) <> ''::text);

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_pkey PRIMARY KEY (id);

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_robot_id_fkey FOREIGN KEY (robot_id) REFERENCES public.robos(id) ON DELETE CASCADE;

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_size_valid CHECK (size_bytes IS NULL OR size_bytes > 0 AND size_bytes <= 20971520);

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_storage_path_key UNIQUE (storage_path);

ALTER TABLE public.robot_uploaded_documents
  ADD CONSTRAINT robot_uploaded_documents_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.robot_uploaded_documents TO authenticated;

GRANT ALL ON public.robot_uploaded_documents TO service_role;

CREATE INDEX robot_uploaded_documents_robot_created_idx ON public.robot_uploaded_documents (robot_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER robot_uploaded_documents_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.robot_uploaded_documents
  FOR EACH ROW
  EXECUTE FUNCTION private.set_row_audit_fields();

CREATE POLICY robot_uploaded_documents_insert ON public.robot_uploaded_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (((deleted_at IS NULL) AND ( SELECT private.has_permission('robots.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.robos r
  WHERE ((r.id = robot_uploaded_documents.robot_id) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS can_access_cliente))))));

CREATE POLICY robot_uploaded_documents_select ON public.robot_uploaded_documents
  FOR SELECT
  TO authenticated
  USING (((deleted_at IS NULL) AND ( SELECT private.has_permission('robots.read'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.robos r
  WHERE ((r.id = robot_uploaded_documents.robot_id) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS can_access_cliente))))));

CREATE POLICY robot_uploaded_documents_update ON public.robot_uploaded_documents
  FOR UPDATE
  TO authenticated
  USING (((deleted_at IS NULL) AND ( SELECT private.has_permission('robots.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.robos r
  WHERE ((r.id = robot_uploaded_documents.robot_id) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS can_access_cliente))))))
  WITH CHECK ((( SELECT private.has_permission('robots.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM public.robos r
  WHERE ((r.id = robot_uploaded_documents.robot_id) AND (r.deleted_at IS NULL) AND ( SELECT private.can_access_cliente(r.cliente_id) AS can_access_cliente))))));

GRANT DELETE, INSERT, SELECT, UPDATE ON public.role_permissions TO service_role;

CREATE TRIGGER role_permissions_protect_robot_duplicate
  BEFORE INSERT OR DELETE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_robot_duplicate_permission();

CREATE POLICY role_permissions_delete_admin ON public.role_permissions
  FOR DELETE
  TO authenticated
  USING (((private.has_role('master'::text) OR private.has_role('admin'::text)) AND (NOT (EXISTS ( SELECT 1
   FROM public.roles r
  WHERE ((r.id = role_permissions.role_id) AND (r.codigo = 'master'::text)))))));

CREATE POLICY role_permissions_insert_admin ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (((private.has_role('master'::text) OR private.has_role('admin'::text)) AND (NOT (EXISTS ( SELECT 1
   FROM public.roles role
  WHERE ((role.id = role_permissions.role_id) AND (role.codigo = 'master'::text))))) AND (NOT ((EXISTS ( SELECT 1
   FROM public.roles role
  WHERE ((role.id = role_permissions.role_id) AND (role.codigo = ANY (ARRAY['cliente'::text, 'suporte'::text]))))) AND (EXISTS ( SELECT 1
   FROM public.permissions permission
  WHERE ((permission.id = role_permissions.permission_id) AND (permission.recurso = 'stack_requests'::text)))))) AND (NOT ((EXISTS ( SELECT 1
   FROM public.roles role
  WHERE ((role.id = role_permissions.role_id) AND (role.codigo = 'cliente'::text)))) AND (EXISTS ( SELECT 1
   FROM public.permissions permission
  WHERE
    ((permission.id = role_permissions.permission_id) AND (permission.codigo = ANY (ARRAY['robots.create'::text, 'robots.update'::text, 'robots.archive'::text,
    'robots.capacity.update'::text,
    'publications.create'::text,
    'robot_catalog.manage'::text, 'robot_center_documentation.manage'::text, 'clients.manage'::text, 'users.read'::text, 'users.manage'::text, 'access_control.read'::text])))))))));

GRANT DELETE, INSERT, SELECT, UPDATE ON public.roles TO service_role;

CREATE POLICY roles_update_admin ON public.roles
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private.has_permission('users.manage'::text) AS has_permission) AND ((codigo <> 'master'::text) OR ( SELECT private.has_role('master'::text) AS has_role))))
  WITH CHECK ((( SELECT private.has_permission('users.manage'::text) AS has_permission) AND ((codigo <> 'master'::text) OR ( SELECT private.has_role('master'::text) AS has_role))));

CREATE TABLE public.stack_request_history (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  stack_request_id uuid                     NOT NULL,
  event_type       text                     NOT NULL,
  message          text,
  previous_status  text,
  new_status       text,
  changes          jsonb                    DEFAULT '{}'::jsonb NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  created_by       uuid                     DEFAULT auth.uid() NOT NULL
);

COMMENT ON TABLE public.stack_request_history IS 'Histórico imutável de eventos e mensagens das solicitações de Stack.';

ALTER TABLE public.stack_request_history
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stack_request_history
  ADD CONSTRAINT stack_request_history_changes_check CHECK (jsonb_typeof(changes) = 'object'::text);

ALTER TABLE public.stack_request_history
  ADD CONSTRAINT stack_request_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.stack_request_history
  ADD CONSTRAINT stack_request_history_event_type_check
    CHECK
    (event_type = ANY (ARRAY['CRIADA'::text, 'EDITADA'::text, 'STATUS_ALTERADO'::text, 'INFORMACAO_SOLICITADA'::text, 'RESPOSTA'::text, 'CONCLUIDA'::text, 'CANCELADA'::text]));

ALTER TABLE public.stack_request_history
  ADD CONSTRAINT stack_request_history_message_check CHECK (message IS NULL OR btrim(message) <> ''::text);

ALTER TABLE public.stack_request_history
  ADD CONSTRAINT stack_request_history_pkey PRIMARY KEY (id);

GRANT INSERT, SELECT ON public.stack_request_history TO authenticated;

GRANT ALL ON public.stack_request_history TO service_role;

CREATE INDEX stack_request_history_created_by_idx ON public.stack_request_history (created_by);

CREATE INDEX stack_request_history_request_created_idx ON public.stack_request_history (stack_request_id, created_at DESC);

CREATE POLICY stack_request_history_insert_allowed ON public.stack_request_history
  FOR INSERT
  TO authenticated
  WITH
    CHECK
    ((private.stack_requests_role_allowed() AND (created_by = auth.uid()) AND (((event_type = 'INFORMACAO_SOLICITADA'::text) AND
    private.has_permission('stack_requests.request_info'::text)) OR ((event_type = 'RESPOSTA'::text) AND private.has_permission('stack_requests.respond'::text)))));

CREATE POLICY stack_request_history_select_allowed ON public.stack_request_history
  FOR SELECT
  TO authenticated
  USING ((private.stack_requests_role_allowed() AND private.has_permission('stack_requests.history'::text)));

CREATE TABLE public.stack_requests (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  robot_id             uuid,
  suggested_stack_name text                     NOT NULL,
  queue_id             uuid,
  type                 text                     NOT NULL,
  job                  text                     NOT NULL,
  status               text                     DEFAULT 'SOLICITADA'::text NOT NULL,
  generated_stack      text,
  requested_at         timestamp with time zone DEFAULT now() NOT NULL,
  completed_at         timestamp with time zone,
  created_at           timestamp with time zone DEFAULT now() NOT NULL,
  updated_at           timestamp with time zone DEFAULT now() NOT NULL,
  created_by           uuid                     DEFAULT auth.uid() NOT NULL,
  updated_by           uuid
);

COMMENT ON TABLE public.stack_requests IS 'Solicitações operacionais de Stack relacionadas a robôs.';

ALTER TABLE public.stack_requests
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_completion_check CHECK (status = 'CONCLUIDA'::text AND generated_stack IS NOT NULL AND completed_at IS
    NOT NULL OR status <> 'CONCLUIDA'::text AND completed_at IS NULL);

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_generated_stack_check CHECK (generated_stack IS NULL OR btrim(generated_stack) <> ''::text);

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_job_check CHECK (btrim(job) <> ''::text);

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_pkey PRIMARY KEY (id);

ALTER TABLE public.stack_request_history
  ADD CONSTRAINT stack_request_history_stack_request_id_fkey FOREIGN KEY (stack_request_id) REFERENCES public.stack_requests(id) ON DELETE RESTRICT;

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.robot_queues(id) ON DELETE RESTRICT;

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_robot_id_fkey FOREIGN KEY (robot_id) REFERENCES public.robos(id) ON DELETE SET NULL;

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_status_check
    CHECK (status = ANY (ARRAY['SOLICITADA'::text, 'EM_ANALISE'::text, 'AGUARDANDO_INFORMACAO'::text, 'CONCLUIDA'::text, 'CANCELADA'::text]));

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_suggested_stack_name_check CHECK (btrim(suggested_stack_name) <> ''::text);

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_type_check CHECK (btrim(type) <> ''::text);

ALTER TABLE public.stack_requests
  ADD CONSTRAINT stack_requests_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.stack_requests TO authenticated;

GRANT ALL ON public.stack_requests TO service_role;

CREATE INDEX stack_requests_created_by_idx ON public.stack_requests (created_by);

CREATE INDEX stack_requests_status_requested_idx ON public.stack_requests (status, requested_at DESC);

CREATE INDEX stack_requests_robot_requested_idx ON public.stack_requests (robot_id, requested_at DESC);

CREATE INDEX stack_requests_updated_by_idx ON public.stack_requests (updated_by)
  WHERE updated_by IS NOT NULL;

CREATE INDEX stack_requests_queue_idx ON public.stack_requests (queue_id)
  WHERE queue_id IS NOT NULL;

CREATE TRIGGER stack_requests_audit_insert
  AFTER INSERT ON public.stack_requests
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_stack_request();

CREATE TRIGGER stack_requests_audit_update
  BEFORE UPDATE ON public.stack_requests
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_stack_request();

CREATE POLICY stack_requests_insert_allowed ON public.stack_requests
  FOR INSERT
  TO authenticated
  WITH CHECK ((private.stack_requests_role_allowed() AND private.has_permission('stack_requests.create'::text) AND (created_by = auth.uid())));

CREATE POLICY stack_requests_select_allowed ON public.stack_requests
  FOR SELECT
  TO authenticated
  USING ((private.stack_requests_role_allowed() AND private.has_permission('stack_requests.read'::text)));

CREATE POLICY stack_requests_update_allowed ON public.stack_requests
  FOR UPDATE
  TO authenticated
  USING
    ((private.stack_requests_role_allowed() AND (private.has_permission('stack_requests.update'::text) OR private.has_permission('stack_requests.status'::text) OR
    private.has_permission('stack_requests.complete'::text) OR private.has_permission('stack_requests.cancel'::text))))
  WITH
    CHECK
    ((private.stack_requests_role_allowed() AND (private.has_permission('stack_requests.update'::text) OR private.has_permission('stack_requests.status'::text) OR
    private.has_permission('stack_requests.complete'::text) OR private.has_permission('stack_requests.cancel'::text))));

CREATE TABLE public.tutorial_drafts (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tutorial_id uuid                     NOT NULL,
  revision    integer                  DEFAULT 0 NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL,
  created_by  uuid                     NOT NULL,
  updated_by  uuid
);

ALTER TABLE public.tutorial_drafts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tutorial_drafts
  ADD CONSTRAINT tutorial_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.tutorial_drafts
  ADD CONSTRAINT tutorial_drafts_pkey PRIMARY KEY (id);

ALTER TABLE public.tutorial_drafts
  ADD CONSTRAINT tutorial_drafts_revision_nonnegative CHECK (revision >= 0);

ALTER TABLE public.tutorial_drafts
  ADD CONSTRAINT tutorial_drafts_tutorial_id_key UNIQUE (tutorial_id);

ALTER TABLE public.tutorial_drafts
  ADD CONSTRAINT tutorial_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.tutorial_drafts TO authenticated;

GRANT ALL ON public.tutorial_drafts TO service_role;

CREATE TRIGGER tutorial_drafts_set_audit
  BEFORE INSERT OR UPDATE ON public.tutorial_drafts
  FOR EACH ROW
  EXECUTE FUNCTION private.set_tutorial_audit_fields();

CREATE POLICY tutorial_drafts_manager_all ON public.tutorial_drafts
  TO authenticated
  USING ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_permission('tutorials.manage'::text) AS has_permission)))
  WITH CHECK ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_permission('tutorials.manage'::text) AS has_permission)));

CREATE TABLE public.tutorial_steps (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  draft_id      uuid                     NOT NULL,
  ordem         integer                  NOT NULL,
  page_key      text                     NOT NULL,
  target_key    text                     NOT NULL,
  titulo        text                     NOT NULL,
  descricao     text                     NOT NULL,
  placement     text                     DEFAULT 'bottom'::text NOT NULL,
  condition_key text,
  habilitado    boolean                  DEFAULT true NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL,
  created_by    uuid                     NOT NULL,
  updated_by    uuid
);

ALTER TABLE public.tutorial_steps
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tutorial_steps
  ADD CONSTRAINT tutorial_steps_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.tutorial_steps
  ADD CONSTRAINT tutorial_steps_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.tutorial_drafts(id) ON DELETE CASCADE;

ALTER TABLE public.tutorial_steps
  ADD CONSTRAINT tutorial_steps_draft_order_key UNIQUE (draft_id, ordem);

ALTER TABLE public.tutorial_steps
  ADD CONSTRAINT tutorial_steps_order_positive CHECK (ordem > 0);

ALTER TABLE public.tutorial_steps
  ADD CONSTRAINT tutorial_steps_page_not_blank CHECK (btrim(page_key) <> ''::text);

ALTER TABLE public.tutorial_steps
  ADD CONSTRAINT tutorial_steps_pkey PRIMARY KEY (id);

ALTER TABLE public.tutorial_steps
  ADD CONSTRAINT tutorial_steps_placement_check CHECK (placement = ANY (ARRAY['top'::text, 'right'::text, 'bottom'::text, 'left'::text]));

ALTER TABLE public.tutorial_steps
  ADD CONSTRAINT tutorial_steps_target_not_blank CHECK (btrim(target_key) <> ''::text);

ALTER TABLE public.tutorial_steps
  ADD CONSTRAINT tutorial_steps_title_not_blank CHECK (btrim(titulo) <> ''::text);

ALTER TABLE public.tutorial_steps
  ADD CONSTRAINT tutorial_steps_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.tutorial_steps TO authenticated;

GRANT ALL ON public.tutorial_steps TO service_role;

CREATE INDEX tutorial_steps_draft_order_idx ON public.tutorial_steps (draft_id, ordem);

CREATE TRIGGER tutorial_steps_set_audit
  BEFORE INSERT OR UPDATE ON public.tutorial_steps
  FOR EACH ROW
  EXECUTE FUNCTION private.set_tutorial_audit_fields();

CREATE POLICY tutorial_steps_manager_all ON public.tutorial_steps
  TO authenticated
  USING ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_permission('tutorials.manage'::text) AS has_permission)))
  WITH CHECK ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_permission('tutorials.manage'::text) AS has_permission)));

CREATE TABLE public.tutorial_versions (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tutorial_id  uuid                     NOT NULL,
  version      integer                  NOT NULL,
  snapshot     jsonb                    NOT NULL,
  published_at timestamp with time zone DEFAULT now() NOT NULL,
  published_by uuid                     NOT NULL
);

ALTER TABLE public.tutorial_versions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tutorial_versions
  ADD CONSTRAINT tutorial_versions_pkey PRIMARY KEY (id);

ALTER TABLE public.tutorial_versions
  ADD CONSTRAINT tutorial_versions_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.tutorial_versions
  ADD CONSTRAINT tutorial_versions_snapshot_object CHECK (jsonb_typeof(snapshot) = 'object'::text);

ALTER TABLE public.tutorial_versions
  ADD CONSTRAINT tutorial_versions_tutorial_version_key UNIQUE (tutorial_id, VERSION);

ALTER TABLE public.tutorial_versions
  ADD CONSTRAINT tutorial_versions_version_positive CHECK (version > 0);

GRANT INSERT, SELECT ON public.tutorial_versions TO authenticated;

GRANT ALL ON public.tutorial_versions TO service_role;

CREATE INDEX tutorial_versions_tutorial_published_idx ON public.tutorial_versions (tutorial_id, published_at DESC);

CREATE TRIGGER tutorial_versions_immutable
  BEFORE DELETE OR UPDATE ON public.tutorial_versions
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_tutorial_version_mutation();

CREATE POLICY tutorial_versions_insert_manager ON public.tutorial_versions
  FOR INSERT
  TO authenticated
  WITH
    CHECK
    (((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_permission('tutorials.manage'::text) AS has_permission)) AND (published_by = ( SELECT
    auth.uid() AS uid))));

CREATE TABLE public.tutorials (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tutorial_key       text                     NOT NULL,
  nome               text                     NOT NULL,
  audience_role_id   uuid                     NOT NULL,
  status             text                     DEFAULT 'draft'::text NOT NULL,
  current_version_id uuid,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL,
  created_by         uuid                     NOT NULL,
  updated_by         uuid
);

CREATE POLICY tutorial_versions_select_allowed ON public.tutorial_versions
  FOR SELECT
  TO authenticated
  USING ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_permission('tutorials.manage'::text) AS has_permission) OR (EXISTS ( SELECT 1
   FROM (public.tutorials tutorial
     JOIN public.user_roles ur ON ((ur.role_id = tutorial.audience_role_id)))
  WHERE
    ((tutorial.id = tutorial_versions.tutorial_id) AND (tutorial.status = 'published'::text) AND (tutorial.current_version_id = tutorial_versions.id) AND (ur.user_id = ( SELECT
    auth.uid() AS uid)))))));

ALTER TABLE public.tutorials
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tutorials
  ADD CONSTRAINT tutorials_audience_role_id_fkey FOREIGN KEY (audience_role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;

ALTER TABLE public.tutorials
  ADD CONSTRAINT tutorials_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.tutorials
  ADD CONSTRAINT tutorials_current_version_id_fkey FOREIGN KEY (current_version_id) REFERENCES public.tutorial_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.tutorials
  ADD CONSTRAINT tutorials_key_not_blank CHECK (btrim(tutorial_key) <> ''::text);

ALTER TABLE public.tutorials
  ADD CONSTRAINT tutorials_nome_not_blank CHECK (btrim(nome) <> ''::text);

ALTER TABLE public.tutorials
  ADD CONSTRAINT tutorials_pkey PRIMARY KEY (id);

ALTER TABLE public.tutorial_drafts
  ADD CONSTRAINT tutorial_drafts_tutorial_id_fkey FOREIGN KEY (tutorial_id) REFERENCES public.tutorials(id) ON DELETE CASCADE;

ALTER TABLE public.tutorial_versions
  ADD CONSTRAINT tutorial_versions_tutorial_id_fkey FOREIGN KEY (tutorial_id) REFERENCES public.tutorials(id) ON DELETE RESTRICT;

ALTER TABLE public.tutorials
  ADD CONSTRAINT tutorials_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'inactive'::text]));

ALTER TABLE public.tutorials
  ADD CONSTRAINT tutorials_tutorial_key_key UNIQUE (tutorial_key);

ALTER TABLE public.tutorials
  ADD CONSTRAINT tutorials_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT INSERT, SELECT, UPDATE ON public.tutorials TO authenticated;

GRANT ALL ON public.tutorials TO service_role;

CREATE INDEX tutorials_audience_status_idx ON public.tutorials (audience_role_id, status);

CREATE TRIGGER tutorials_set_audit
  BEFORE INSERT OR UPDATE ON public.tutorials
  FOR EACH ROW
  EXECUTE FUNCTION private.set_tutorial_audit_fields();

CREATE POLICY tutorials_insert_manager ON public.tutorials
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_permission('tutorials.manage'::text) AS has_permission)));

CREATE POLICY tutorials_select_allowed ON public.tutorials
  FOR SELECT
  TO authenticated
  USING
    ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_permission('tutorials.manage'::text) AS has_permission) OR ((status = 'published'::text) AND
    (current_version_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (ur.role_id = tutorials.audience_role_id)))))));

CREATE POLICY tutorials_update_manager ON public.tutorials
  FOR UPDATE
  TO authenticated
  USING ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_permission('tutorials.manage'::text) AS has_permission)))
  WITH CHECK ((( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT private.has_permission('tutorials.manage'::text) AS has_permission)));

GRANT DELETE, INSERT, SELECT, UPDATE ON public.user_roles TO service_role;

CREATE POLICY user_roles_delete_admin ON public.user_roles
  FOR DELETE
  TO authenticated
  USING ((( SELECT private.has_role('admin'::text) AS has_role) AND (NOT (EXISTS ( SELECT 1
   FROM public.roles ROLE
  WHERE ((role.id = user_roles.role_id) AND (role.codigo = 'master'::text)))))));

CREATE POLICY user_roles_insert_admin ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private.has_role('admin'::text) AS has_role) AND (NOT (EXISTS ( SELECT 1
   FROM public.roles role
  WHERE ((role.id = user_roles.role_id) AND (role.codigo = 'master'::text)))))));

CREATE TABLE public.user_tutorial_progress (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  tutorial_key     text                     NOT NULL,
  tutorial_version integer                  NOT NULL,
  status           text                     DEFAULT 'not_started'::text NOT NULL,
  current_step     integer                  DEFAULT 0 NOT NULL,
  started_at       timestamp with time zone,
  completed_at     timestamp with time zone,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  tutorial_id      uuid
);

ALTER TABLE public.user_tutorial_progress
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_tutorial_progress
  ADD CONSTRAINT user_tutorial_progress_key_not_blank CHECK (btrim(tutorial_key) <> ''::text);

ALTER TABLE public.user_tutorial_progress
  ADD CONSTRAINT user_tutorial_progress_pkey PRIMARY KEY (id);

ALTER TABLE public.user_tutorial_progress
  ADD CONSTRAINT user_tutorial_progress_status_check CHECK (status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'skipped'::text]));

ALTER TABLE public.user_tutorial_progress
  ADD CONSTRAINT user_tutorial_progress_step_nonnegative CHECK (current_step >= 0);

ALTER TABLE public.user_tutorial_progress
  ADD CONSTRAINT user_tutorial_progress_tutorial_id_fkey FOREIGN KEY (tutorial_id) REFERENCES public.tutorials(id) ON DELETE RESTRICT;

ALTER TABLE public.user_tutorial_progress
  ADD CONSTRAINT user_tutorial_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_tutorial_progress
  ADD CONSTRAINT user_tutorial_progress_user_tutorial_version_key UNIQUE (user_id, tutorial_key, tutorial_version);

ALTER TABLE public.user_tutorial_progress
  ADD CONSTRAINT user_tutorial_progress_version_positive CHECK (tutorial_version > 0);

GRANT INSERT, SELECT, UPDATE ON public.user_tutorial_progress TO authenticated;

GRANT ALL ON public.user_tutorial_progress TO service_role;

CREATE INDEX user_tutorial_progress_tutorial_idx ON public.user_tutorial_progress (tutorial_id, tutorial_version);

CREATE INDEX user_tutorial_progress_user_updated_idx ON public.user_tutorial_progress (user_id, updated_at DESC);

CREATE TRIGGER user_tutorial_progress_set_updated_at
  BEFORE UPDATE ON public.user_tutorial_progress
  FOR EACH ROW
  EXECUTE FUNCTION private.set_user_tutorial_progress_updated_at();

CREATE POLICY user_tutorial_progress_insert_own ON public.user_tutorial_progress
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY user_tutorial_progress_select_own ON public.user_tutorial_progress
  FOR SELECT
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY user_tutorial_progress_update_own ON public.user_tutorial_progress
  FOR UPDATE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

COMMENT ON INDEX public.robot_center_documentations_robo_active_key IS 'Garante uma única Documentação Robot Center ativa por robô e permite nova criação após exclusão lógica.';

ALTER POLICY clientes_select ON public.clientes
  USING
  (((deleted_at IS NULL) AND ( SELECT private.has_permission('clients.read'::text) AS has_permission) AND (( SELECT private.has_role('master'::text) AS has_role) OR ( SELECT
  private.has_role('admin'::text) AS has_role) OR ( SELECT private.has_role('head_setor'::text) AS has_role) OR ( SELECT private.has_role('operador'::text) AS has_role) OR
  ( SELECT private.has_role('dev'::text) AS has_role) OR ( SELECT private.has_role('suporte'::text) AS has_role) OR
  (( SELECT private.has_role('cliente'::text) AS has_role) AND (id = ( SELECT profile.cliente_id
   FROM public.profiles profile
  WHERE ((profile.id = ( SELECT auth.uid() AS uid)) AND profile.ativo AND (profile.deleted_at IS NULL))))))));

COMMENT ON POLICY robos_delete_master ON public.robos IS 'Permite exclusão física exclusivamente para usuários com papel Master.';

ALTER POLICY robos_select ON public.robos
  USING
  (((deleted_at IS NULL) AND ( SELECT private.has_permission('robots.read'::text) AS has_permission) AND ( SELECT private.can_access_cliente(robos.cliente_id) AS
  can_access_cliente) AND
CASE product_type
    WHEN 'INTEGRADOR'::text THEN ( SELECT private.has_permission('robots.product.integrador.read'::text) AS has_permission)
    WHEN 'CONSULTA_PROCESSUAL'::text THEN ( SELECT private.has_permission('robots.product.consulta_processual.read'::text) AS has_permission)
    WHEN 'PETICIONAMENTO'::text THEN ( SELECT private.has_permission('robots.product.peticionamento.read'::text) AS has_permission)
    WHEN 'MOVIMENTO'::text THEN ( SELECT private.has_permission('robots.product.movimento.read'::text) AS has_permission)
    ELSE false
END));