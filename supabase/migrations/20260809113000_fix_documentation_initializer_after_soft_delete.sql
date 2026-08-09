create or replace function public.initialize_robot_center_documentation(target_robot_id uuid)
returns table (documentation_id uuid, draft_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;

revoke all on function public.initialize_robot_center_documentation(uuid)
  from public, anon;
grant execute on function public.initialize_robot_center_documentation(uuid)
  to authenticated;
