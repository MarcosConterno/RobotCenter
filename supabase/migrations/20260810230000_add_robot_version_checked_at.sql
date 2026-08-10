alter table public.robos
  add column version_checked_at timestamptz;

comment on column public.robos.version_checked_at is
  'Data e hora da última consulta de versão concluída com sucesso no registry interno.';
