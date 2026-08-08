alter table public.flow_edges
  add column label_width double precision,
  add column label_height double precision,
  add constraint flow_edges_label_width_positive check (label_width is null or label_width >= 70),
  add constraint flow_edges_label_height_positive check (label_height is null or label_height >= 34);

comment on column public.flow_edges.label_width is
  'Largura opcional da etiqueta visual da conexão, em pixels.';

comment on column public.flow_edges.label_height is
  'Altura opcional da etiqueta visual da conexão, em pixels.';
