alter table public.clientes
  add column if not exists cor text;

update public.clientes as c
set cor = coalesce(
  (
    select r.cliente_cor
    from public.robos as r
    where r.cliente_id = c.id
      and r.deleted_at is null
    order by r.created_at, r.id
    limit 1
  ),
  'azul'
)
where c.cor is null;

alter table public.clientes
  alter column cor set default 'azul',
  alter column cor set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clientes_cor_check'
      and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes
      add constraint clientes_cor_check
      check (cor in ('azul', 'violeta', 'verde', 'ambar', 'rosa', 'ciano'));
  end if;
end;
$$;

comment on column public.clientes.cor is
  'Paleta visual compartilhada por todos os robôs vinculados ao cliente.';
