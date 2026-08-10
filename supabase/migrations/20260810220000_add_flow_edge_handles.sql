alter table public.flow_edges
  add column source_handle text,
  add column target_handle text,
  add constraint flow_edges_source_handle_valid check (
    source_handle is null or source_handle in ('source-right')
  ),
  add constraint flow_edges_target_handle_valid check (
    target_handle is null or target_handle in ('target-left')
  );

comment on column public.flow_edges.source_handle is
  'Identificador opcional do ponto lateral de saída usado no editor visual.';

comment on column public.flow_edges.target_handle is
  'Identificador opcional do ponto lateral de entrada usado no editor visual.';
