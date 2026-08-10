create or replace function private.sync_robot_package_values() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.robos set pacote=new.name,pacote_cor=new.color where package_id=new.id; return new; end $$;
create or replace function private.sync_robot_stack_values() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.robos set stack=new.name where stack_id=new.id; return new; end $$;
create or replace function private.sync_robot_queue_values() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.robos set fila=new.name where queue_id=new.id; return new; end $$;
create or replace function private.sync_robot_command_values() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.robos set command=new.command where command_id=new.id; return new; end $$;
revoke all on function private.sync_robot_package_values() from public,anon,authenticated;
revoke all on function private.sync_robot_stack_values() from public,anon,authenticated;
revoke all on function private.sync_robot_queue_values() from public,anon,authenticated;
revoke all on function private.sync_robot_command_values() from public,anon,authenticated;
create trigger robot_packages_sync_robots after update of name,color on public.robot_packages for each row when (old.name is distinct from new.name or old.color is distinct from new.color) execute function private.sync_robot_package_values();
create trigger robot_stacks_sync_robots after update of name on public.robot_stacks for each row when (old.name is distinct from new.name) execute function private.sync_robot_stack_values();
create trigger robot_queues_sync_robots after update of name on public.robot_queues for each row when (old.name is distinct from new.name) execute function private.sync_robot_queue_values();
create trigger robot_commands_sync_robots after update of command on public.robot_commands for each row when (old.command is distinct from new.command) execute function private.sync_robot_command_values();
