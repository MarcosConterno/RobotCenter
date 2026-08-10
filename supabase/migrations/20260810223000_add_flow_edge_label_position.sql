alter table public.flow_edges
  add column label_offset_x numeric,
  add column label_offset_y numeric,
  add constraint flow_edges_label_offset_x_valid check (
    label_offset_x is null or label_offset_x between -10000 and 10000
  ),
  add constraint flow_edges_label_offset_y_valid check (
    label_offset_y is null or label_offset_y between -10000 and 10000
  );

comment on column public.flow_edges.label_offset_x is
  'Deslocamento horizontal opcional da etiqueta em relação ao centro calculado da conexão.';

comment on column public.flow_edges.label_offset_y is
  'Deslocamento vertical opcional da etiqueta em relação ao centro calculado da conexão.';
