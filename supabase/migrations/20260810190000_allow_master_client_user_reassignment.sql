create or replace function public.archive_client_with_user_reassignment(
  target_client_id uuid,
  replacement_client_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;

revoke all on function public.archive_client_with_user_reassignment(uuid, uuid)
  from public, anon;
grant execute on function public.archive_client_with_user_reassignment(uuid, uuid)
  to authenticated;

comment on function public.archive_client_with_user_reassignment(uuid, uuid) is
  'Reatribui ou desvincula usuários e arquiva um cliente atomicamente; uso exclusivo do Master.';
