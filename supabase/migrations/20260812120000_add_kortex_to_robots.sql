alter table public.robos
  add column kortex boolean not null default false;

comment on column public.robos.kortex is
  'Indica se o robô utiliza Kortex.';
