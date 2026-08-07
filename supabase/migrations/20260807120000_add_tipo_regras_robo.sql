-- Separa as regras do documento técnico das regras externas, preservando os dados atuais.
alter table public.regras_robo
  add column tipo text not null default 'documentacao',
  add constraint regras_robo_tipo_check
    check (tipo in ('documentacao', 'fora_documentacao'));

drop index if exists public.regras_robo_robo_ordem_active_key;

create unique index regras_robo_robo_tipo_ordem_active_key
  on public.regras_robo (robo_id, tipo, ordem)
  where deleted_at is null;

comment on column public.regras_robo.tipo is
  'Categoria da regra: documentacao ou fora_documentacao.';
