create or replace function private.prevent_cliente_soft_delete_with_dependencies()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

drop trigger if exists clientes_prevent_soft_delete_with_dependencies on public.clientes;

create trigger clientes_prevent_soft_delete_with_dependencies
before update of deleted_at on public.clientes
for each row
execute function private.prevent_cliente_soft_delete_with_dependencies();

revoke all on function private.prevent_cliente_soft_delete_with_dependencies() from public;
revoke all on function private.prevent_cliente_soft_delete_with_dependencies() from anon;
revoke all on function private.prevent_cliente_soft_delete_with_dependencies() from authenticated;
