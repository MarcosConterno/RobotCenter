create table public.budget_action_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null default 'Geral',
  description text not null,
  default_hours numeric(10,2) not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint budget_action_catalog_code_not_blank check (btrim(code) <> ''),
  constraint budget_action_catalog_description_not_blank check (btrim(description) <> ''),
  constraint budget_action_catalog_hours_valid check (default_hours >= 0 and default_hours <= 9999)
);

create table public.budget_action_aliases (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.budget_action_catalog(id) on delete cascade,
  alias text not null,
  priority integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint budget_action_aliases_alias_not_blank check (btrim(alias) <> ''),
  constraint budget_action_aliases_unique unique (alias)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  source text not null default 'manual',
  status text not null default 'draft',
  source_file_name text,
  source_content text,
  hourly_rate numeric(12,2) not null default 220,
  commission_percent numeric(7,4) not null default 30,
  total_hours numeric(12,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  robot_id uuid references public.robos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  constraint budgets_project_name_not_blank check (btrim(project_name) <> ''),
  constraint budgets_source_file_name_length check (source_file_name is null or char_length(source_file_name) <= 255),
  constraint budgets_source_content_size check (source_content is null or octet_length(source_content) <= 2000000),
  constraint budgets_source_valid check (source in ('manual', 'txt')),
  constraint budgets_status_valid check (status in ('draft', 'finalized')),
  constraint budgets_hourly_rate_valid check (hourly_rate >= 0),
  constraint budgets_commission_valid check (commission_percent >= 0 and commission_percent <= 100),
  constraint budgets_totals_valid check (total_hours >= 0 and subtotal >= 0 and total >= 0),
  constraint budgets_deleted_by_requires_deleted_at check (deleted_by is null or deleted_at is not null)
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  action_id uuid references public.budget_action_catalog(id) on delete set null,
  description text not null,
  hours numeric(10,2) not null,
  hourly_rate numeric(12,2) not null,
  amount numeric(14,2) not null,
  source_line integer,
  source_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint budget_items_description_not_blank check (btrim(description) <> ''),
  constraint budget_items_hours_valid check (hours >= 0 and hours <= 9999),
  constraint budget_items_rate_valid check (hourly_rate >= 0),
  constraint budget_items_amount_valid check (amount >= 0),
  constraint budget_items_amount_matches check (amount = round(hours * hourly_rate, 2)),
  constraint budget_items_source_line_valid check (source_line is null or source_line > 0)
);

create index budget_action_catalog_active_order_idx on public.budget_action_catalog (active, sort_order, description);
create index budget_action_aliases_action_idx on public.budget_action_aliases (action_id, active, priority desc);
create index budgets_created_idx on public.budgets (created_at desc) where deleted_at is null;
create index budgets_robot_idx on public.budgets (robot_id, created_at desc) where deleted_at is null and robot_id is not null;
create index budget_items_budget_order_idx on public.budget_items (budget_id, sort_order);

create trigger budget_action_catalog_set_audit_fields before insert or update on public.budget_action_catalog
for each row execute function private.set_row_audit_fields();
create trigger budget_action_aliases_set_audit_fields before insert or update on public.budget_action_aliases
for each row execute function private.set_row_audit_fields();
create trigger budgets_set_audit_fields before insert or update on public.budgets
for each row execute function private.set_row_audit_fields();
create trigger budget_items_set_audit_fields before insert or update on public.budget_items
for each row execute function private.set_row_audit_fields();

revoke all on public.budget_action_catalog, public.budget_action_aliases, public.budgets, public.budget_items from anon, authenticated;
grant select, insert, update on public.budget_action_catalog, public.budget_action_aliases, public.budgets, public.budget_items to authenticated;

alter table public.budget_action_catalog enable row level security;
alter table public.budget_action_aliases enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_items enable row level security;

create policy budget_action_catalog_select on public.budget_action_catalog for select to authenticated
using ((select private.has_role('master')) or (select private.has_role('admin')));
create policy budget_action_catalog_insert on public.budget_action_catalog for insert to authenticated
with check ((select private.has_role('master')) or (select private.has_role('admin')));
create policy budget_action_catalog_update on public.budget_action_catalog for update to authenticated
using ((select private.has_role('master')) or (select private.has_role('admin')))
with check ((select private.has_role('master')) or (select private.has_role('admin')));

create policy budget_action_aliases_select on public.budget_action_aliases for select to authenticated
using ((select private.has_role('master')) or (select private.has_role('admin')));
create policy budget_action_aliases_insert on public.budget_action_aliases for insert to authenticated
with check ((select private.has_role('master')) or (select private.has_role('admin')));
create policy budget_action_aliases_update on public.budget_action_aliases for update to authenticated
using ((select private.has_role('master')) or (select private.has_role('admin')))
with check ((select private.has_role('master')) or (select private.has_role('admin')));

create policy budgets_select on public.budgets for select to authenticated
using (deleted_at is null and ((select private.has_role('master')) or (select private.has_role('admin'))));
create policy budgets_insert on public.budgets for insert to authenticated
with check (deleted_at is null and ((select private.has_role('master')) or (select private.has_role('admin'))));
create policy budgets_update on public.budgets for update to authenticated
using (deleted_at is null and ((select private.has_role('master')) or (select private.has_role('admin'))))
with check ((select private.has_role('master')) or (select private.has_role('admin')));

create policy budget_items_select on public.budget_items for select to authenticated
using (
  ((select private.has_role('master')) or (select private.has_role('admin')))
  and exists (select 1 from public.budgets b where b.id = budget_items.budget_id and b.deleted_at is null)
);
create policy budget_items_insert on public.budget_items for insert to authenticated
with check (
  ((select private.has_role('master')) or (select private.has_role('admin')))
  and exists (select 1 from public.budgets b where b.id = budget_items.budget_id and b.deleted_at is null)
);
create policy budget_items_update on public.budget_items for update to authenticated
using (
  ((select private.has_role('master')) or (select private.has_role('admin')))
  and exists (select 1 from public.budgets b where b.id = budget_items.budget_id and b.deleted_at is null)
)
with check (
  ((select private.has_role('master')) or (select private.has_role('admin')))
  and exists (select 1 from public.budgets b where b.id = budget_items.budget_id and b.deleted_at is null)
);

insert into public.permissions (codigo, recurso, acao, descricao, ativo) values
  ('budgets.read', 'Orçamentos', 'read', 'Consultar orçamentos', true),
  ('budgets.create', 'Orçamentos', 'create', 'Criar orçamentos', true),
  ('budgets.update', 'Orçamentos', 'update', 'Editar e finalizar orçamentos', true),
  ('budgets.dictionary.manage', 'Orçamentos', 'manage_dictionary', 'Configurar o dicionário de ações', true)
on conflict (codigo) do update set recurso = excluded.recurso, acao = excluded.acao, descricao = excluded.descricao, ativo = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.codigo in ('master', 'admin') and p.codigo like 'budgets.%'
on conflict do nothing;

insert into public.budget_action_catalog (code, category, description, default_hours, sort_order) values
('rpa-first-screen','RPA','(RPA) Navegar para a primeira tela do robo',2.00,10),
('rpa-login','RPA','(RPA) Preencher dados na tela de login',1.50,20),
('rpa-captcha','RPA','(RPA) Resolver captcha',2.00,30),
('rpa-table-read','RPA','(RPA) Leitura de tabela',4.00,40),
('rpa-next-screen','RPA','(RPA) Navegar para outra tela',1.00,50),
('rpa-fill-field','RPA','(RPA) Preencher Campo (cpf, nome, idade, número do processo e etc)',0.50,60),
('rpa-read-field','RPA','(RPA) Ler Campo da tela',0.60,70),
('rpa-document','RPA','(RPA) Baixar documento (.pdf, .doc, etc)',2.50,80),
('rpa-click','RPA','(RPA) Clique de Botão',0.50,90),
('rpa-govbr','RPA','(RPA) Login Gov BR',3.50,100),
('api-fill-field','API','(API) Preencher campo API',1.50,110),
('api-read-field','API','(API) Ler Campo da API',1.50,120),
('api-study','API','(API) Estudo completo de API de terceiros',8.00,130),
('api-auth','API','(API) Autenticação de API',2.00,140),
('vpn','Geral','Tem VPN?',3.00,150),
('application','Geral','Aplicação',6.00,160),
('rpa-email-dpa','RPA','(RPA) DPA E-mail',10.00,170),
('rpa-validation-lock','RPA','(RPA) Trava de Validação de Cadastros.',10.00,180),
('rpa-two-factor','RPA','(RPA) Duplo Fator de Autenticação.',10.00,190),
('rpa-tests','RPA','(RPA) Testes e Validações.',6.00,200),
('rpa-adjustment-tests','RPA','(RPA) Testes e Validações para Ajustes.',3.00,210),
('uncatalogued','Geral','Outra ação não catalogada',0.00,999)
on conflict (code) do nothing;

insert into public.budget_action_aliases (action_id, alias, priority)
select c.id, seed.alias, seed.priority
from (values
('rpa-adjustment-tests','testes_ajustes',100),('rpa-first-screen','primeira tela',50),('rpa-login','login e senha',50),
('rpa-email-dpa','dpa email',50),('rpa-table-read','leitura tabela',50),('rpa-govbr','login govbr',50),
('rpa-captcha','captcha',40),('rpa-next-screen','nova tela',50),('rpa-fill-field','rpa insere dados',50),
('rpa-read-field','leitura de dados',50),('rpa-document','anexar documentos',50),('rpa-click','clique',30),('rpa-click','botao',20),
('vpn','vpn',40),('api-read-field','api ler campo',50),('api-auth','api autenticacao',50),
('api-fill-field','api insere dados',50),('api-study','api estudo',50),('application','aplicacao',40),
('rpa-validation-lock','trava duplicidade',50),('rpa-two-factor','duplo fator',50),('rpa-tests','testes',10)
) as seed(code, alias, priority)
join public.budget_action_catalog c on c.code = seed.code
on conflict (alias) do nothing;

comment on table public.budget_action_catalog is 'Fonte única e configurável das ações usadas em orçamentos.';
comment on table public.budget_action_aliases is 'Expressões normalizadas reconhecidas durante a importação de TXT.';
comment on table public.budgets is 'Orçamentos manuais ou importados, preparados para vínculo opcional com robôs.';
comment on table public.budget_items is 'Snapshot dos itens, horas e valores de cada orçamento.';
