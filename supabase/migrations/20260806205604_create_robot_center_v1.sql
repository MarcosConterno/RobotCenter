create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tenant text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  constraint clientes_nome_not_blank check (btrim(nome) <> ''),
  constraint clientes_tenant_not_blank check (btrim(tenant) <> ''),
  constraint clientes_deleted_by_requires_deleted_at check (
    deleted_by is null or deleted_at is not null
  )
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  login text not null,
  cliente_id uuid references public.clientes(id) on delete restrict,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  constraint profiles_login_not_blank check (btrim(login) <> ''),
  constraint profiles_deleted_by_requires_deleted_at check (
    deleted_by is null or deleted_at is not null
  )
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint roles_codigo_not_blank check (btrim(codigo) <> ''),
  constraint roles_nome_not_blank check (btrim(nome) <> '')
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  recurso text not null,
  acao text not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint permissions_codigo_not_blank check (btrim(codigo) <> ''),
  constraint permissions_recurso_not_blank check (btrim(recurso) <> ''),
  constraint permissions_acao_not_blank check (btrim(acao) <> ''),
  constraint permissions_recurso_acao_key unique (recurso, acao)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint user_roles_user_role_key unique (user_id, role_id)
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint role_permissions_role_permission_key unique (role_id, permission_id)
);

create table public.robos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  nome text not null,
  sistema text not null,
  pacote text not null,
  descricao text not null,
  ambiente text not null,
  ativo boolean not null default true,
  stack text not null,
  fila text not null,
  versao text not null,
  responsavel text not null,
  alteracao_realizada text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  constraint robos_nome_not_blank check (btrim(nome) <> ''),
  constraint robos_sistema_not_blank check (btrim(sistema) <> ''),
  constraint robos_pacote_not_blank check (btrim(pacote) <> ''),
  constraint robos_descricao_not_blank check (btrim(descricao) <> ''),
  constraint robos_ambiente_check check (
    ambiente in ('Produção', 'Teste', 'Desenvolvimento')
  ),
  constraint robos_stack_not_blank check (btrim(stack) <> ''),
  constraint robos_fila_not_blank check (btrim(fila) <> ''),
  constraint robos_versao_not_blank check (btrim(versao) <> ''),
  constraint robos_responsavel_not_blank check (btrim(responsavel) <> ''),
  constraint robos_deleted_by_requires_deleted_at check (
    deleted_by is null or deleted_at is not null
  )
);

create table public.regras_robo (
  id uuid primary key default gen_random_uuid(),
  robo_id uuid not null references public.robos(id) on delete restrict,
  descricao text not null,
  ordem integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  constraint regras_robo_descricao_not_blank check (btrim(descricao) <> ''),
  constraint regras_robo_ordem_nonnegative check (ordem >= 0),
  constraint regras_robo_deleted_by_requires_deleted_at check (
    deleted_by is null or deleted_at is not null
  )
);

create table public.publicacoes (
  id uuid primary key default gen_random_uuid(),
  robo_id uuid not null references public.robos(id) on delete restrict,
  categoria text not null,
  descricao text not null,
  publicada_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint publicacoes_categoria_check check (
    categoria in ('Novo Robô', 'Atualização de Regra', 'Atualização do Robô')
  ),
  constraint publicacoes_descricao_not_blank check (btrim(descricao) <> '')
);

alter table public.clientes
  add constraint clientes_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict,
  add constraint clientes_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete restrict,
  add constraint clientes_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete restrict;

alter table public.profiles
  add constraint profiles_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict,
  add constraint profiles_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete restrict,
  add constraint profiles_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete restrict;

alter table public.roles
  add constraint roles_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict,
  add constraint roles_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete restrict;

alter table public.permissions
  add constraint permissions_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict,
  add constraint permissions_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete restrict;

alter table public.user_roles
  add constraint user_roles_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict;

alter table public.role_permissions
  add constraint role_permissions_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict;

alter table public.robos
  add constraint robos_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict,
  add constraint robos_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete restrict,
  add constraint robos_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete restrict;

alter table public.regras_robo
  add constraint regras_robo_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict,
  add constraint regras_robo_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete restrict,
  add constraint regras_robo_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete restrict;

alter table public.publicacoes
  add constraint publicacoes_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict;

create unique index clientes_tenant_active_key
  on public.clientes (lower(tenant))
  where deleted_at is null;

create unique index profiles_login_active_key
  on public.profiles (lower(login))
  where deleted_at is null;

create unique index regras_robo_robo_ordem_active_key
  on public.regras_robo (robo_id, ordem)
  where deleted_at is null;

create index profiles_cliente_id_idx on public.profiles (cliente_id);
create index clientes_created_by_idx on public.clientes (created_by);
create index clientes_updated_by_idx on public.clientes (updated_by);
create index clientes_deleted_by_idx on public.clientes (deleted_by);
create index profiles_created_by_idx on public.profiles (created_by);
create index profiles_updated_by_idx on public.profiles (updated_by);
create index profiles_deleted_by_idx on public.profiles (deleted_by);
create index roles_created_by_idx on public.roles (created_by);
create index roles_updated_by_idx on public.roles (updated_by);
create index permissions_created_by_idx on public.permissions (created_by);
create index permissions_updated_by_idx on public.permissions (updated_by);
create index user_roles_role_id_idx on public.user_roles (role_id);
create index user_roles_created_by_idx on public.user_roles (created_by);
create index role_permissions_permission_id_idx
  on public.role_permissions (permission_id);
create index role_permissions_created_by_idx
  on public.role_permissions (created_by);
create index robos_cliente_active_idx
  on public.robos (cliente_id, ativo, ambiente)
  where deleted_at is null;
create index robos_created_by_idx on public.robos (created_by);
create index robos_updated_by_idx on public.robos (updated_by);
create index robos_deleted_by_idx on public.robos (deleted_by);
create index regras_robo_created_by_idx on public.regras_robo (created_by);
create index regras_robo_updated_by_idx on public.regras_robo (updated_by);
create index regras_robo_deleted_by_idx on public.regras_robo (deleted_by);
create index publicacoes_robo_publicada_idx
  on public.publicacoes (robo_id, publicada_em desc);
create index publicacoes_publicada_idx
  on public.publicacoes (publicada_em desc);
create index publicacoes_created_by_idx on public.publicacoes (created_by);

create or replace function private.set_row_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());

    if current_user_id is not null then
      new.created_by := current_user_id;
    elsif new.created_by is null then
      new.created_by := current_user_id;
    end if;

    new.updated_at := coalesce(new.updated_at, new.created_at);

    if new.updated_by is null then
      new.updated_by := new.created_by;
    end if;

    return new;
  end if;

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();

  if current_user_id is not null then
    new.updated_by := current_user_id;
  end if;

  if new.deleted_at is not null
     and old.deleted_at is null
     and new.deleted_by is null then
    new.deleted_by := current_user_id;
  end if;

  return new;
end;
$$;

revoke all on function private.set_row_audit_fields() from public, anon, authenticated;

create or replace function private.set_created_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  new.created_at := coalesce(new.created_at, now());

  if current_user_id is not null then
    new.created_by := current_user_id;
  end if;

  return new;
end;
$$;

revoke all on function private.set_created_audit_fields()
  from public, anon, authenticated;

create trigger clientes_set_audit_fields
before insert or update on public.clientes
for each row execute function private.set_row_audit_fields();

create trigger profiles_set_audit_fields
before insert or update on public.profiles
for each row execute function private.set_row_audit_fields();

create trigger roles_set_audit_fields
before insert or update on public.roles
for each row execute function private.set_row_audit_fields();

create trigger permissions_set_audit_fields
before insert or update on public.permissions
for each row execute function private.set_row_audit_fields();

create trigger robos_set_audit_fields
before insert or update on public.robos
for each row execute function private.set_row_audit_fields();

create trigger regras_robo_set_audit_fields
before insert or update on public.regras_robo
for each row execute function private.set_row_audit_fields();

create trigger user_roles_set_audit_fields
before insert on public.user_roles
for each row execute function private.set_created_audit_fields();

create trigger role_permissions_set_audit_fields
before insert on public.role_permissions
for each row execute function private.set_created_audit_fields();

create trigger publicacoes_set_audit_fields
before insert on public.publicacoes
for each row execute function private.set_created_audit_fields();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, login, ativo)
  values (
    new.id,
    coalesce(nullif(btrim(new.email), ''), nullif(btrim(new.phone), ''), new.id::text),
    true
  );

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.validate_cliente_role_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.roles as r
    where r.id = new.role_id
      and r.codigo = 'cliente'
      and r.ativo
  ) and not exists (
    select 1
    from public.profiles as p
    join public.clientes as c on c.id = p.cliente_id
    where p.id = new.user_id
      and p.ativo
      and p.deleted_at is null
      and c.deleted_at is null
  ) then
    raise exception 'O papel Cliente exige um profile ativo vinculado a um cliente ativo.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_cliente_role_assignment()
  from public, anon, authenticated;

create trigger user_roles_validate_cliente
before insert or update on public.user_roles
for each row execute function private.validate_cliente_role_assignment();

create or replace function private.prevent_cliente_profile_without_cliente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.cliente_id is null or not new.ativo or new.deleted_at is not null)
     and exists (
       select 1
       from public.user_roles as ur
       join public.roles as r on r.id = ur.role_id
       where ur.user_id = new.id
         and r.codigo = 'cliente'
         and r.ativo
     ) then
    raise exception 'Um profile com papel Cliente deve permanecer ativo e vinculado a um cliente.';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_cliente_profile_without_cliente()
  from public, anon, authenticated;

create trigger profiles_validate_cliente_role
before update on public.profiles
for each row execute function private.prevent_cliente_profile_without_cliente();
