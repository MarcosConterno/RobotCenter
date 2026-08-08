alter table public.flow_edges
add column queue text not null default '';

comment on column public.flow_edges.queue is
  'Fila opcional vinculada à conexão do fluxo; exibida como informação compacta sobre a linha.';
