alter table public.robos alter column cliente_id drop not null;

alter table public.robos
  add constraint robos_integrador_requires_cliente_check
  check (product_type <> 'INTEGRADOR' or cliente_id is not null);
