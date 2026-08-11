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

A publicação `supabase_realtime` inclui as tabelas operacionais usadas pelos providers de Robôs e Fluxos. A publicação não constitui autorização: cada inscrição usa o JWT da sessão e continua limitada pelas policies RLS das tabelas. Usuários Cliente recebem somente alterações do próprio cliente; usuários sem permissão de leitura não recebem as linhas protegidas. Não há canal anônimo nem uso da chave `service_role` no navegador.

- **Master**: papel complementar e superior ao Admin, atribuído exclusivamente a `marcos.vinicius@loylegal.com`. Consulta e edita toda a matriz de permissões e executa ações excepcionais explicitamente protegidas, mantendo também o papel Admin por compatibilidade.
- **Admin**: gerencia clientes, profiles, robôs, regras e publicações conforme os grants disponíveis. Pode editar e arquivar usuários e clientes, sem excluir fisicamente seus históricos. No painel de permissões, altera somente Operador, Dev, Cliente e Suporte.
- O vínculo entre usuário e Cliente é alterado somente pelo endpoint `/api/admin/users`, após validação server-side do papel Admin. A operação usa o cliente administrativo apenas depois dessa validação; papéis não administrativos recebem `403` e não podem escolher outro `cliente_id` por payload.
- O primeiro administrador é inicializado de forma idempotente para `marcos.vinicius@loylegal.com`; os demais vínculos são gerenciados pela tela administrativa.
- A importação em lote de robôs e o download do modelo são exclusivos do papel Admin. A interface reutiliza a autorização da sessão autenticada, carregada centralmente, evitando validações repetidas a cada ação; operações persistentes continuam protegidas no servidor e pelas policies RLS.
- **Operador**: consulta robôs e detalhes e altera somente `ideal` e `max` pela permissão `robots.capacity.update`; não acessa Configurações nem a manutenção completa de robôs.
- **Dev**: inicia com as mesmas permissões e o mesmo escopo global de dados do Operador. Sua matriz é independente e pode ser editada por Admin ou Master para receber novas capacidades no futuro.
- **Cliente**: lê somente seu próprio cliente, seus robôs, regras e publicações; não acessa Configurações e não possui escrita.
- **Suporte**: acessa Dashboard, listagem/detalhes de Robôs e Fluxos em modo de visualização. Recebe somente as leituras necessárias e não acessa Configurações nem ações de manutenção.
- **Head Setor**: consulta Robôs e analisa Solicitações de Stack conforme as permissões `stack_requests.*`, sem receber manutenção geral do cadastro de Robôs.

Solicitações de Stack possuem permissões separadas para leitura, criação, resposta, edição, status, pedido de informação, conclusão, cancelamento e histórico. Master e Admin administram essa matriz; Dev, Cliente e Suporte são bloqueados também por RLS. Operador recebe somente leitura e histórico por padrão.

Admin e Operador atualizam capacidade pela RPC `public.update_robot_capacity`. A função valida sessão e permissão específica e não permite alterar outras colunas do robô.

A coluna `clientes.cor` segue as policies existentes de `clientes`: somente Admin pode cadastrá-la ou alterá-la; Operador, Cliente e Suporte apenas recebem a cor nas leituras já autorizadas. A mudança não amplia o escopo de nenhuma policy RLS.

O endpoint `/api/admin/client-metrics` exige sessão com papel Admin ou Master antes de calcular os totais de Robôs, Fluxos e documentos por Cliente. As consultas agregadas são executadas somente no servidor; nenhuma credencial administrativa é enviada ao navegador.

O tipo da regra (`documentacao` ou `fora_documentacao`) não altera o escopo de acesso. As duas categorias herdam as mesmas policies de `regras_robo`: leitura exige `robots.read` e escrita/reordenação exige `robots.update`, sempre respeitando o cliente vinculado ao robô.

## Progresso do tutorial

Todo usuário autenticado pode consultar, criar e atualizar exclusivamente seu próprio registro em `user_tutorial_progress`. As policies comparam `auth.uid()` a `user_id` em `SELECT`, `INSERT` e nos dois lados de `UPDATE`. Não há grant ou policy de exclusão, acesso anônimo ou edição administrativa do progresso de terceiros.

## Administração de tutoriais

`tutorials.manage` permite acessar as rotas e APIs administrativas, criar e salvar rascunhos, testar sem progresso e publicar snapshots. Admin e Master recebem a permissão inicialmente; a matriz existente pode concedê-la ou removê-la conforme suas próprias regras, enquanto Master conserva acesso superior. As tabelas de rascunho e passos exigem essa capacidade. A leitura de versões atuais por usuários comuns exige tutorial publicado e vínculo com o papel definido como público.

| Operação | Master | Admin padrão | Outros perfis |
|---|---:|---:|---:|
| Executar tutorial publicado do próprio público | Sim | Sim | Sim |
| Gerenciar/testar/publicar | Sim | Sim | Somente se receber `tutorials.manage` |
| Alterar versão publicada | Não | Não | Não |

O histórico `alteracoes_robo` permite leitura com `robots.read`, respeitando `private.can_access_cliente`, e inserção com `robots.update`. Não existem grants ou policies de update/delete para usuários autenticados, garantindo que o histórico anterior não seja alterado pela aplicação.

As policies consultam `roles`, `permissions`, `user_roles` e `role_permissions` por funções no schema privado. `user_metadata` não participa da autorização. Todas as tabelas públicas da aplicação têm RLS habilitada, e `anon` não recebe acesso. O papel Master é um vínculo RBAC real, nunca uma condição confiada apenas ao email enviado pela interface.
- Todo usuário autenticado pode alterar exclusivamente a própria senha pelo menu da conta. A operação usa a sessão atual do Supabase Auth e não concede acesso administrativo a outros usuários.
- O histórico do Dashboard respeita `publicacoes_select`; somente papéis com `publications.create` podem inserir registros por **Salvar e publicar**.
- O bucket privado `robot-manuals` permite leitura somente a quem possui `robots.read` e acesso ao cliente do robô. Upload e exclusão de objetos exigem `robots.update`; não existe acesso anônimo. Os metadados em `robot_uploaded_documents` repetem o mesmo escopo por RLS.
- Master e Admin podem criar, editar ou arquivar requisitos funcionais e regras fora da documentação diretamente na aba Documentação, sem editar o robô inteiro. A interface não exibe as ações a outros papéis, e `regras_robo` exige `robots.update` no banco.
- Os relacionamentos de gatilho fazem parte de `robos`: leitura segue `robots.read` e alteração segue `robots.update`, com o mesmo isolamento por cliente já aplicado pela RLS.
- `product_type`, `command`, `tribunal` e `tribunal_system` fazem parte da mesma tabela `robos`. A segregação visual por produto não amplia acesso: leitura e escrita continuam submetidas às policies `robos_select`, `robos_insert_staff` e `robos_update_staff`, incluindo escopo por Cliente.

## Fluxos

| Papel | Ler | Criar | Editar/Publicar | Excluir |
|---|---:|---:|---:|---:|
| Admin | Todos | Sim | Todos | Sim |
| Operador | Todos | Não | Não | Não |
| Dev | Todos | Não | Não | Não |
| Suporte | Todos | Não | Não | Não |
| Cliente | Próprio cliente | Não | Próprio cliente | Não |

As permissões RBAC são `flows.read`, `flows.create`, `flows.update`, `flows.delete` e `flows.publish`. As policies de `flow_nodes`, `flow_edges` e `flow_versions` herdam o cliente consultando o Fluxo relacionado. `client_id` recebido da interface nunca é suficiente para autorizar uma operação.

A sincronização manual de versões exige sessão válida e papel `admin` ou `master` na API. O conector local apenas consulta o registry; somente a API autenticada altera `robos.versao` e `robos.version_checked_at`. As policies existentes de `robos` permanecem como defesa adicional.

A fila de uma conexão é armazenada em `flow_edges.queue` e segue exatamente a mesma RLS da Edge. A adição dessa propriedade não amplia os grants nem altera o escopo por Cliente.

Os pontos opcionais `source_handle` e `target_handle` pertencem à própria Edge e seguem as policies existentes de `flow_edges`; não criam novo escopo de acesso nem permitem conexões entre Fluxos distintos.

Os deslocamentos opcionais `label_offset_x` e `label_offset_y` são apenas propriedades visuais da Edge e seguem as mesmas policies, grants e escopo por Cliente.

Os triggers de auditoria dos Fluxos executam uma função privada sem grants diretos para usuários. A função apenas preenche autoria e timestamps; não ignora nem substitui as policies RLS aplicadas à operação original.

O RPC `publish_flow` usa `SECURITY INVOKER`: as policies e permissões da sessão continuam ativas durante a atualização do Fluxo e a criação da versão. Não há acesso anônimo às tabelas ou ao RPC.

O nome do criador é resolvido por `get_flow_creator_name`. A função privilegiada permanece no schema privado e valida sessão, `flows.read` e acesso ao Cliente antes de retornar exclusivamente `profiles.login`; não expõe outros campos do profile.
- A importação permanece restrita à capacidade administrativa. UUIDs fora das linhas visíveis ao usuário são rejeitados na validação, e a RLS continua sendo a barreira definitiva na gravação.

## Documentação Robot Center

Somente Admin pode criar e editar. A exclusão lógica exige adicionalmente o papel Master. Essa regra é validada na interface, na rota autenticada e na policy RLS de atualização.

O endpoint e a rota do editor exigem papel `admin`. As tabelas de seções e blocos usam RLS herdada do rascunho, documento, robô e cliente. As RPCs de inicialização, reordenação e arquivamento repetem a validação de Admin e do escopo do robô; ocultar o botão nunca é a única barreira.

O bucket `robot-documentation` é privado. Leitura, inserção, substituição e remoção no caminho de rascunho exigem Admin, `robot_center_documentation.manage` e acesso ao cliente do robô identificado no primeiro segmento da pasta. Versões publicadas terão caminhos e política de leitura próprios na etapa de publicação.

Versões publicadas permanecem no mesmo bucket privado, sob `<robo_id>/versions/`. Usuários com `robot_center_documentation.read` e acesso ao cliente do robô podem obter URL assinada; somente Admin com `robot_center_documentation.manage` grava artefatos. O bucket `robot-documentation-templates` é privado e acessível apenas a Admin. Publicar e alterar estados de geração também exigem Admin no backend e nas policies/RPCs.

| Permissão | Admin | Operador | Cliente | Suporte |
|---|---:|---:|---:|---:|
| `robot_center_documentation.read` | Sim | Conforme `robots.read` | Próprio cliente | Conforme `robots.read` |
| `robot_center_documentation.manage` | Sim | Não | Não | Não |

## Painel administrativo de permissões

O **Controle de Acesso** apresenta recursos em cards e níveis Sem acesso, Somente leitura, Personalizado e Acesso total. A edição detalhada ocorre em drawer: fechar descarta, “Aplicar alterações” atualiza apenas o rascunho e somente “Salvar alterações” persiste a matriz. Os produtos de Robôs possuem permissões `robots.product.*.read`; menu, rota direta e `robos_select` exigem o produto correspondente, mantendo também `robots.read` e o escopo por Cliente.

O painel **Configurações → Permissões** agrupa o catálogo de `permissions` pelo campo `recurso` e mostra quais registros ativos de `roles` estão relacionados por `role_permissions`. A descrição funcional é o título e o código técnico aparece como informação secundária. A API `/api/admin/permissions` repete a validação de Admin/Master no servidor e não confia na visibilidade da aba.

Admin e Master podem editar a matriz completa de todos os demais perfis, inclusive o próprio perfil Admin e o recurso `access_control`. O perfil Master é imutável pela matriz e conserva todas as permissões ativas. Dev pode receber permissões de Solicitações de Stack pela matriz; Cliente e Suporte permanecem bloqueados no RPC e nas policies.

A exclusão administrativa de usuário exige Admin no servidor, bloqueia autoexclusão e protege o Master. O profile é mantido como registro arquivado para preservar as FKs de auditoria; os vínculos em `user_roles` são removidos e a identidade do Auth recebe exclusão lógica pelo cliente administrativo. Nenhuma chave administrativa é exposta ao navegador.

O RPC `archive_client_with_user_reassignment` usa `SECURITY INVOKER`, exige `private.has_role('master')` e mantém RLS ativa durante a atualização de `profiles` e `clientes`. Admin comum não recebe essa capacidade. O RPC não exclui dados fisicamente e falha integralmente se houver Robôs ativos ou Cliente substituto inválido.

| Área de Configurações | Master | Admin | Operador | Cliente | Suporte |
|---|---:|---:|---:|---:|---:|
| Usuários | Sim | Sim | Não | Não | Não |
| Clientes | Sim | Sim | Não | Não | Não |
| Mapa de permissões | Edita tudo | Edita perfis subordinados | Não | Não | Não |

A permissão `access_control.read` é concedida apenas ao Master. As policies de `user_roles` bloqueiam qualquer nova atribuição ou remoção do papel `master` pela aplicação; o único vínculo é criado de forma rastreável pela migration para `marcos.vinicius@loylegal.com`. Policies adicionais protegem a própria role e o vínculo da permissão reservada. O endpoint de usuários também impede que um Admin comum altere ou arquive o usuário Master.

A RPC transacional `update_role_permission_matrix(jsonb)` executa as inclusões e remoções em `role_permissions` com `SECURITY INVOKER`, portanto mantém a RLS da sessão. Master altera qualquer papel/recurso. Admin não altera os papéis `admin`/`master` nem o recurso `access_control`. Falha em qualquer item desfaz a operação completa.

- A rota de administração valida sessão e papel Admin no servidor.
- A raiz documental exige permissão de leitura e acesso ao cliente do Robô. Fora do Admin, somente registros com status `published` ficam visíveis.
- O rascunho exige papel Admin e permissão de gerenciamento.
- Versões permitem leitura autorizada e inserção somente por Admin; trigger impede atualização ou exclusão.
- A futura visualização publicada utilizará `read`, separada de `manage`, sem ampliar automaticamente o acesso ao rascunho.
- A migration `20260808224500_allow_published_robot_documentation_view.sql` replica `read` somente para papéis que já possuem `robots.read`; ela não concede acesso adicional a Robôs.
## Tarefas pessoais

Todos os perfis autenticados possuem acesso funcional a Minha página, sem permissão RBAC adicional. `personal_tasks` concede `SELECT`, `INSERT`, `UPDATE` e `DELETE` somente a `authenticated`; cada policy exige `auth.uid() = user_id`. O trigger também torna `user_id` imutável após a criação e preenche o proprietário pela sessão. Usuários anônimos e usuários tentando operar tarefas de terceiros permanecem bloqueados pela RLS.

`personal_page_preferences` e `personal_page_flows` repetem o isolamento por `auth.uid()`. A inserção de um atalho também exige que o Fluxo referenciado esteja visível à sessão pelas policies de `flows`. A configuração não concede `robots.read`, `flows.read` ou capacidades de escrita; os widgets continuam subordinados às permissões das entidades originais.

`personal_meetings` e `personal_notes` concedem CRUD somente a `authenticated`, sempre com `auth.uid() = user_id` em cada policy. Updates possuem `USING` e `WITH CHECK`; triggers tornam o proprietário imutável. Não existe policy administrativa, inclusive para Admin e Master. A associação de origem do ToDo é validada pelo mesmo proprietário, impedindo referência cruzada entre workspaces.
