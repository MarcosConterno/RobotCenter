-- Distribui a paleta visual entre os clientes existentes. A atribuição é
-- executada uma única vez; alterações manuais posteriores permanecem salvas.
with clientes_ordenados as (
  select
    id,
    row_number() over (order by lower(btrim(nome)), id) - 1 as indice
  from public.clientes
  where deleted_at is null
)
update public.clientes as c
set cor = (array['azul', 'violeta', 'verde', 'ambar', 'rosa', 'ciano'])[
  (co.indice % 6) + 1
]
from clientes_ordenados as co
where c.id = co.id;

-- O pacote continua pertencendo ao robô, mas a cor é compartilhada por nome.
-- Nomes iguais, desconsiderando espaços externos e caixa, recebem a mesma cor.
with pacotes_distintos as (
  select distinct lower(btrim(pacote)) as chave
  from public.robos
  where deleted_at is null
    and btrim(pacote) <> ''
),
pacotes_ordenados as (
  select
    chave,
    row_number() over (order by chave) - 1 as indice
  from pacotes_distintos
),
cores_pacote as (
  select
    chave,
    (array['azul', 'violeta', 'verde', 'ambar', 'rosa', 'ciano'])[
      (indice % 6) + 1
    ] as cor
  from pacotes_ordenados
)
update public.robos as r
set pacote_cor = cp.cor
from cores_pacote as cp
where r.deleted_at is null
  and lower(btrim(r.pacote)) = cp.chave;

-- Em novos cadastros, reutiliza a cor de um pacote homônimo. Quando o nome é
-- inédito, usa a próxima cor do ciclo. Atualizações apenas da cor continuam
-- permitidas para que a configuração manual seja propagada pela aplicação.
create or replace function private.set_robot_package_color()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shared_color text;
  package_count integer;
begin
  if tg_op = 'UPDATE' and lower(btrim(new.pacote)) = lower(btrim(old.pacote)) then
    return new;
  end if;

  select r.pacote_cor
  into shared_color
  from public.robos as r
  where r.deleted_at is null
    and lower(btrim(r.pacote)) = lower(btrim(new.pacote))
    and (tg_op = 'INSERT' or r.id <> new.id)
  order by r.created_at, r.id
  limit 1;

  if shared_color is null then
    select count(distinct lower(btrim(r.pacote)))
    into package_count
    from public.robos as r
    where r.deleted_at is null
      and btrim(r.pacote) <> ''
      and lower(btrim(r.pacote)) <> lower(btrim(new.pacote));

    shared_color := (array['azul', 'violeta', 'verde', 'ambar', 'rosa', 'ciano'])[
      (package_count % 6) + 1
    ];
  end if;

  new.pacote_cor := shared_color;
  return new;
end;
$$;

revoke all on function private.set_robot_package_color() from public;

drop trigger if exists robos_set_package_color on public.robos;
create trigger robos_set_package_color
before insert or update of pacote on public.robos
for each row execute function private.set_robot_package_color();

