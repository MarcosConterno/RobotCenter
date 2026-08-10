do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'clientes',
    'robos',
    'regras_robo',
    'alteracoes_robo',
    'publicacoes',
    'robot_center_documentations',
    'robot_center_documentation_versions',
    'flows',
    'flow_nodes',
    'flow_edges',
    'flow_versions'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        relation_name
      );
    end if;
  end loop;
end;
$$;

comment on publication supabase_realtime is
  'Publica alterações das entidades operacionais para sincronização multiusuário em tempo real.';
