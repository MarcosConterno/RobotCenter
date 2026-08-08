# API administrativa de Usuários

`/api/admin/users` exige sessão autenticada com papel Admin em todos os métodos. A validação ocorre no servidor antes da criação do cliente Supabase administrativo.

## Listagem

`GET` retorna `id`, `login`, `email`, `tipo` e `clienteId`. O email é obtido do Supabase Auth e o vínculo com Cliente vem de `profiles.cliente_id`.

## Cadastro

`POST` aceita `login`, `email`, `password`, `tipo` e `clientId`. `clientId` é obrigatório para o papel Cliente e opcional para Admin, Operador e Suporte. Quando informado, precisa referenciar um Cliente não arquivado.

## Atualização

`PATCH` aceita `id`, `login`, `email`, `tipo` e `clientId`, com as mesmas validações do cadastro. A alteração do vínculo é gravada em `profiles.cliente_id`; o cliente recebido não é usado sem validar a autorização administrativa e a existência do registro.

## Exclusão

`DELETE` mantém o arquivamento lógico existente e não remove fisicamente o profile. A existência de `clienteId` não altera essa regra.
