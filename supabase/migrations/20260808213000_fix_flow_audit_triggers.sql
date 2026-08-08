create or replace function private.set_flow_row_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(current_user_id, new.created_by);
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.updated_by := coalesce(current_user_id, new.updated_by, new.created_by);
    return new;
  end if;

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(current_user_id, old.updated_by, old.created_by);

  return new;
end;
$$;

revoke all on function private.set_flow_row_audit_fields()
  from public, anon, authenticated;

drop trigger if exists flows_set_audit_fields on public.flows;
create trigger flows_set_audit_fields
before insert or update on public.flows
for each row execute function private.set_flow_row_audit_fields();

drop trigger if exists flow_nodes_set_audit_fields on public.flow_nodes;
create trigger flow_nodes_set_audit_fields
before insert or update on public.flow_nodes
for each row execute function private.set_flow_row_audit_fields();

drop trigger if exists flow_edges_set_audit_fields on public.flow_edges;
create trigger flow_edges_set_audit_fields
before insert or update on public.flow_edges
for each row execute function private.set_flow_row_audit_fields();
