-- Limpa o catálogo de robôs para a nova carga de importação.
-- Clientes, usuários, papéis e permissões são preservados.
-- A ordem respeita as FKs com ON DELETE RESTRICT.

delete from public.publicacoes;
delete from public.alteracoes_robo;
delete from public.regras_robo;
delete from public.robos;
