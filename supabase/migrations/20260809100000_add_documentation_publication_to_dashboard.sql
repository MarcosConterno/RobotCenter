create or replace function public.complete_robot_center_documentation_publication(
  target_version_id uuid,
  target_generation_token uuid,
  target_snapshot jsonb,
  target_docx_path text,
  target_pdf_path text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;

revoke all on function public.complete_robot_center_documentation_publication(uuid, uuid, jsonb, text, text)
  from public, anon;
grant execute on function public.complete_robot_center_documentation_publication(uuid, uuid, jsonb, text, text)
  to authenticated;

comment on function public.complete_robot_center_documentation_publication(uuid, uuid, jsonb, text, text)
is 'Conclui a versão documental e registra a publicação na dashboard na mesma transação.';
