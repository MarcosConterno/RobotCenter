create or replace function private.sync_robot_package_values() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.robos set pacote=new.name,pacote_cor=new.color where package_id=new.id;
insert into public.publicacoes(robo_id,categoria,descricao) select id,'Atualização do Robô','Pacote atualizado pelo cadastro central: '||new.name||'.' from public.robos where package_id=new.id and deleted_at is null; return new; end $$;
create or replace function private.sync_robot_stack_values() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.robos set stack=new.name where stack_id=new.id;
insert into public.publicacoes(robo_id,categoria,descricao) select id,'Atualização do Robô','Stack atualizada pelo cadastro central: '||new.name||'.' from public.robos where stack_id=new.id and deleted_at is null; return new; end $$;
create or replace function private.sync_robot_queue_values() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.robos set fila=new.name where queue_id=new.id;
insert into public.publicacoes(robo_id,categoria,descricao) select id,'Atualização do Robô','Fila atualizada pelo cadastro central: '||new.name||'.' from public.robos where queue_id=new.id and deleted_at is null; return new; end $$;
create or replace function private.sync_robot_command_values() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.robos set command=new.command where command_id=new.id;
insert into public.publicacoes(robo_id,categoria,descricao) select id,'Atualização do Robô','Command atualizado pelo cadastro central: '||new.name||'.' from public.robos where command_id=new.id and deleted_at is null; return new; end $$;
