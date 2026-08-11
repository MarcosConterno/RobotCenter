# API administrativa de Usuários

`/api/admin/users` exige sessão autenticada com papel Admin em todos os métodos. A validação ocorre no servidor antes da criação do cliente Supabase administrativo.

## Listagem

`GET` retorna `id`, `login`, `email`, `tipo`, `clienteId` e `podeEditarRobosCliente`. O email é obtido do Supabase Auth; o vínculo e a capacidade individual vêm de `profiles`.

## Cadastro

`POST` aceita `login`, `email`, `password`, `tipo`, `clientId` e `canEditClientRobots`. `clientId` é obrigatório para o papel Cliente. `canEditClientRobots` somente pode ser verdadeiro para esse papel e começa falso quando omitido.

## Atualização

`PATCH` aceita também `canEditClientRobots`, com as mesmas validações do cadastro. Ao trocar o papel para outro perfil, a capacidade individual é removida automaticamente. A alteração é feita somente após validar Admin/Master e o Cliente ativo.

## Exclusão

`DELETE` mantém o arquivamento lógico existente e não remove fisicamente o profile. A existência de `clienteId` não altera essa regra.
## Exclusão de usuário

`DELETE /api/admin/users` recebe o UUID do usuário e exige uma sessão Admin validada no servidor. A operação rejeita o próprio usuário e qualquer identidade Master, arquiva `profiles`, remove `user_roles` e solicita exclusão lógica da identidade no Supabase Auth com o cliente administrativo. O profile não é removido fisicamente porque entidades históricas o referenciam com `ON DELETE RESTRICT`.
## Remapeamento ao arquivar Cliente

A interface Master chama `archive_client_with_user_reassignment(target_client_id, replacement_client_id)`. O RPC reatribui ou remove `profiles.cliente_id` e arquiva o Cliente em uma única transação. `replacement_client_id = null` remove o vínculo. Robôs ativos continuam impedindo o arquivamento.
