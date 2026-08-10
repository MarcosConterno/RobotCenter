begin;

alter table public.robos
  add column command text not null default '',
  add column product_type text not null default 'INTEGRADOR',
  add column tribunal text,
  add column tribunal_system text,
  add constraint robos_product_type_check check (
    product_type in (
      'INTEGRADOR',
      'CONSULTA_PROCESSUAL',
      'PETICIONAMENTO',
      'MOVIMENTO'
    )
  ),
  add constraint robos_integrador_without_tribunal_check check (
    product_type <> 'INTEGRADOR'
    or (tribunal is null and tribunal_system is null)
  );

create index robos_product_type_active_name_idx
  on public.robos (product_type, nome)
  where deleted_at is null;

comment on column public.robos.command is
  'Comando técnico utilizado para executar o robô.';
comment on column public.robos.product_type is
  'Produto ao qual o robô pertence: INTEGRADOR, CONSULTA_PROCESSUAL, PETICIONAMENTO ou MOVIMENTO.';
comment on column public.robos.tribunal is
  'Tribunal atendido pelo robô; deve permanecer nulo para robôs integradores.';
comment on column public.robos.tribunal_system is
  'Sistema do tribunal atendido pelo robô; deve permanecer nulo para robôs integradores.';

commit;
