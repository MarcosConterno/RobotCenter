# Permissões e acesso

## Estado atual

A aplicação não implementa autenticação, autorização, RLS, policies ou integração com Supabase Auth.

`TipoUsuario` aceita Admin, Operador e Cliente, mas esses valores são apenas dados cadastrais. Nenhum componente restringe rotas, botões ou operações com base no tipo.

## O que não deve ser inferido

- Usuário do tipo Cliente ainda não pertence a um `Cliente` específico.
- `Robo.responsavel` não identifica o usuário autenticado.
- O texto `Admin` da Topbar não comprova uma sessão autenticada.

## Decisões obrigatórias antes de RLS

- Definir se Usuário será conta do Supabase Auth e como será o perfil de aplicação.
- Definir as permissões efetivas de Admin, Operador e Cliente.
- Definir se dados são globais ou isolados por Cliente/tenant.
- Definir relações Cliente–Usuário e Cliente–Robô.
- Definir quem pode cadastrar, editar, excluir e publicar Robôs.
- Definir quem pode consultar Publicações e cadastros administrativos.

Nenhuma policy deve ser criada antes dessas decisões, pois apenas usar o papel `authenticated` não implementaria autorização por registro.
# Policies implementadas para a V1

As migrations implementam autorização por tabelas RBAC e RLS deny-by-default:

- **Admin**: gerencia clientes, profiles, papéis, permissões, robôs, regras e publicações conforme os grants disponíveis. Pode editar e arquivar usuários e clientes, sem excluir fisicamente seus históricos.
- O primeiro administrador é inicializado de forma idempotente para `marcos.vinicius@loylegal.com`; os demais vínculos são gerenciados pela tela administrativa.
- A importação em lote de robôs e o download do modelo são exclusivos do papel Admin. A interface reutiliza a autorização da sessão autenticada, carregada centralmente, evitando validações repetidas a cada ação; operações persistentes continuam protegidas no servidor e pelas policies RLS.
- **Operador**: consulta robôs e detalhes e altera somente `ideal` e `max` pela permissão `robots.capacity.update`; não acessa Configurações nem a manutenção completa de robôs.
- **Cliente**: lê somente seu próprio cliente, seus robôs, regras e publicações; não acessa Configurações e não possui escrita.
- **Suporte**: acessa somente as Dashboards, incluindo a identificação do Cliente na tabela consolidada. Recebe as leituras mínimas necessárias para compor os indicadores, sem acesso às páginas de Robôs ou Configurações.

Admin e Operador atualizam capacidade pela RPC `public.update_robot_capacity`. A função valida sessão e permissão específica e não permite alterar outras colunas do robô.

A coluna `clientes.cor` segue as policies existentes de `clientes`: somente Admin pode cadastrá-la ou alterá-la; Operador, Cliente e Suporte apenas recebem a cor nas leituras já autorizadas. A mudança não amplia o escopo de nenhuma policy RLS.

O tipo da regra (`documentacao` ou `fora_documentacao`) não altera o escopo de acesso. As duas categorias herdam as mesmas policies de `regras_robo`: leitura exige `robots.read` e escrita/reordenação exige `robots.update`, sempre respeitando o cliente vinculado ao robô.

O histórico `alteracoes_robo` permite leitura com `robots.read`, respeitando `private.can_access_cliente`, e inserção com `robots.update`. Não existem grants ou policies de update/delete para usuários autenticados, garantindo que o histórico anterior não seja alterado pela aplicação.

As policies consultam `roles`, `permissions`, `user_roles` e `role_permissions` por funções no schema privado. `user_metadata` não participa da autorização. Todas as tabelas públicas da aplicação têm RLS habilitada, e `anon` não recebe acesso.
- Todo usuário autenticado pode alterar exclusivamente a própria senha pelo menu da conta. A operação usa a sessão atual do Supabase Auth e não concede acesso administrativo a outros usuários.
- O histórico do Dashboard respeita `publicacoes_select`; somente papéis com `publications.create` podem inserir registros por **Salvar e publicar**.
- O bucket privado `robot-manuals` permite leitura somente a quem possui `robots.read` e acesso ao cliente do robô. Upload e substituição exigem `robots.update`; não existe acesso anônimo.
- Os relacionamentos de gatilho fazem parte de `robos`: leitura segue `robots.read` e alteração segue `robots.update`, com o mesmo isolamento por cliente já aplicado pela RLS.

## Fluxos

| Papel | Ler | Criar | Editar/Publicar | Excluir |
|---|---:|---:|---:|---:|
| Admin | Todos | Sim | Todos | Sim |
| Operador | Todos | Não | Não | Não |
| Suporte | Todos | Não | Não | Não |
| Cliente | Próprio cliente | Não | Próprio cliente | Não |

As permissões RBAC são `flows.read`, `flows.create`, `flows.update`, `flows.delete` e `flows.publish`. As policies de `flow_nodes`, `flow_edges` e `flow_versions` herdam o cliente consultando o Fluxo relacionado. `client_id` recebido da interface nunca é suficiente para autorizar uma operação.

O RPC `publish_flow` usa `SECURITY INVOKER`: as policies e permissões da sessão continuam ativas durante a atualização do Fluxo e a criação da versão. Não há acesso anônimo às tabelas ou ao RPC.
- A importação permanece restrita à capacidade administrativa. UUIDs fora das linhas visíveis ao usuário são rejeitados na validação, e a RLS continua sendo a barreira definitiva na gravação.
