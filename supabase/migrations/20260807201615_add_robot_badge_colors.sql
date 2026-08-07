alter table public.robos
  add column cliente_cor text not null default 'azul',
  add column pacote_cor text not null default 'violeta',
  add constraint robos_cliente_cor_check
    check (cliente_cor in ('azul', 'violeta', 'verde', 'ambar', 'rosa', 'ciano')),
  add constraint robos_pacote_cor_check
    check (pacote_cor in ('azul', 'violeta', 'verde', 'ambar', 'rosa', 'ciano'));

comment on column public.robos.cliente_cor is
  'Paleta visual do badge de cliente escolhida na edição do robô.';

comment on column public.robos.pacote_cor is
  'Paleta visual do badge de pacote escolhida na edição do robô.';
