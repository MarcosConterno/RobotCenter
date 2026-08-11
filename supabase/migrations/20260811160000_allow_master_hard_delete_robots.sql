-- Permite exclusão física de robôs exclusivamente pelo Master.
-- Preserva referências históricas relevantes por SET NULL e remove somente
-- entidades operacionais que pertencem integralmente ao robô por CASCADE.

begin;

create table if not exists private.robot_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  robot_id uuid not null,
  robot_snapshot jsonb not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid not null
);

revoke all on table private.robot_deletion_audit from public, anon, authenticated;

create or replace function private.audit_master_robot_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role('master') then
    raise exception 'Somente o Master pode excluir um robô permanentemente.'
      using errcode = '42501';
  end if;

  insert into private.robot_deletion_audit (
    robot_id,
    robot_snapshot,
    deleted_by
  )
  values (
    old.id,
    to_jsonb(old),
    auth.uid()
  );

  return old;
end;
$$;

revoke all on function private.audit_master_robot_delete() from public, anon, authenticated;

drop trigger if exists robos_audit_master_delete on public.robos;
create trigger robos_audit_master_delete
before delete on public.robos
for each row execute function private.audit_master_robot_delete();

-- Alterações, publicações, regras e metadados de anexos pertencem ao robô.
alter table public.alteracoes_robo
  drop constraint if exists alteracoes_robo_robo_id_fkey,
  add constraint alteracoes_robo_robo_id_fkey
    foreign key (robo_id) references public.robos(id) on delete cascade;

alter table public.publicacoes
  drop constraint if exists publicacoes_robo_id_fkey,
  add constraint publicacoes_robo_id_fkey
    foreign key (robo_id) references public.robos(id) on delete cascade;

alter table public.robot_uploaded_documents
  drop constraint if exists robot_uploaded_documents_robot_id_fkey,
  add constraint robot_uploaded_documents_robot_id_fkey
    foreign key (robot_id) references public.robos(id) on delete cascade;

alter table public.regras_robo
  drop constraint if exists regras_robo_parent_id_fkey,
  add constraint regras_robo_parent_id_fkey
    foreign key (parent_id) references public.regras_robo(id) on delete cascade,
  drop constraint if exists regras_robo_robo_id_fkey,
  add constraint regras_robo_robo_id_fkey
    foreign key (robo_id) references public.robos(id) on delete cascade;

alter table public.robot_center_documentation_blocks
  drop constraint if exists robot_center_documentation_blocks_requirement_id_fkey,
  add constraint robot_center_documentation_blocks_requirement_id_fkey
    foreign key (requirement_id) references public.regras_robo(id) on delete set null;

-- Fluxos, relacionamentos, documentação publicada e solicitações são históricos
-- independentes: permanecem no banco, mas deixam de apontar para o robô removido.
alter table public.flow_nodes
  drop constraint if exists flow_nodes_robot_id_fkey,
  add constraint flow_nodes_robot_id_fkey
    foreign key (robot_id) references public.robos(id) on delete set null;

alter table public.robos
  drop constraint if exists robos_gatilho_de_fkey,
  add constraint robos_gatilho_de_fkey
    foreign key (gatilho_de_robo_id) references public.robos(id) on delete set null,
  drop constraint if exists robos_gatilho_para_fkey,
  add constraint robos_gatilho_para_fkey
    foreign key (gatilho_para_robo_id) references public.robos(id) on delete set null;

alter table public.robot_center_documentations
  alter column robo_id drop not null,
  drop constraint if exists robot_center_documentations_robo_id_fkey,
  add constraint robot_center_documentations_robo_id_fkey
    foreign key (robo_id) references public.robos(id) on delete set null;

alter table public.stack_requests
  alter column robot_id drop not null,
  drop constraint if exists stack_requests_robot_id_fkey,
  add constraint stack_requests_robot_id_fkey
    foreign key (robot_id) references public.robos(id) on delete set null;

grant delete on table public.robos to authenticated;

drop policy if exists robos_delete_master on public.robos;
create policy robos_delete_master
on public.robos for delete
to authenticated
using ((select private.has_role('master')));

comment on table private.robot_deletion_audit is
  'Auditoria privada e imutável das exclusões físicas de robôs realizadas pelo Master.';

comment on policy robos_delete_master on public.robos is
  'Permite exclusão física exclusivamente para usuários com papel Master.';

commit;
