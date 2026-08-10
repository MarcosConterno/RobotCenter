create or replace function private.can_access_cliente(target_cliente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      private.has_role('admin')
      or private.has_role('head_setor')
      or private.has_role('operador')
      or private.has_role('dev')
      or (
        private.has_role('cliente')
        and exists (
          select 1 from public.profiles as p
          where p.id = (select auth.uid())
            and p.cliente_id = target_cliente_id
            and p.ativo
            and p.deleted_at is null
        )
      )
    );
$$;
