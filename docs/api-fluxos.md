# API interna de Fluxos

O módulo usa o cliente Supabase autenticado e Row Level Security. Não expõe uma Route Handler paralela nem utiliza chave `service_role` no navegador.

## Propriedades do Montador

`flow_nodes.data` persiste somente propriedades específicas da documentação visual, incluindo descrição, observações, vínculo com grupo e dimensões. Os dados principais de Robôs não são duplicados e continuam resolvidos por `robot_id`.

As conexões persistem `type`, `condition`, `queue`, `description`, `label_width`, `label_height`, `label_offset_x`, `label_offset_y`, `source_handle` e `target_handle` em `flow_edges`. `queue` é opcional, utiliza string vazia quando ausente, dimensões e offsets preservam tamanho e posição manual da etiqueta, e os handles opcionais preservam o ponto lateral escolhido. Todos os campos seguem a autorização herdada por `flow_id`.

## Leituras

- `flows`: listagem e metadados autorizados.
- `flow_nodes`, `flow_edges`: composição normalizada de um Fluxo.
- `flow_versions`: histórico imutável.
- `robos`: dados atuais para nodes vinculados por `robot_id`.
- `get_flow_creator_name(target_flow_id)`: retorna somente o login do criador quando a sessão possui `flows.read` e acesso ao Cliente do Fluxo.

Operador e Suporte recebem somente grants/policies de leitura. Cliente recebe somente linhas cujo `flows.client_id` corresponde a `profiles.cliente_id`.

## Escritas

- Criação em `flows`: somente Admin.
- Atualização de `flows`, `flow_nodes` e `flow_edges`: Admin ou Cliente autorizado.
- Exclusão de `flows`: somente Admin; filhos são removidos por cascade limitado ao Fluxo.
- Publicação: RPC `publish_flow(target_flow_id, target_snapshot)`, que incrementa a versão e insere o snapshot em uma única transação.

Erros de autorização são retornados pelo PostgreSQL/PostgREST com código `42501`. A interface oculta ações incompatíveis com o papel, mas essa ocultação não substitui as policies.
