# Permissões e acesso

## Estado atual

A aplicação implementa sessão local em PostgreSQL, papéis RBAC e RLS. A autorização das rotas e operações é verificada no servidor; o estado da Sidebar apenas controla a exibição dos menus e não substitui RLS.

O perfil Cliente tem vínculo explícito com profiles.cliente_id. Os papéis Master/Admin são atribuídos em user_roles; permissions e role_permissions definem acesso a módulos e ações. RLS permanece como limite de leitura/escrita por papel e cliente.

## O que não deve ser inferido

- Robo.responsavel não identifica o usuário autenticado.
- O texto Admin da Topbar, isoladamente, não comprova uma sessão válida.
- A ausência de um menu não comprova que uma policy negou os dados; verificar GET /api/admin/access e as permissões retornadas.

# Policies implementadas para a V1
# Policies implementadas para a V1

As migrations implementam autorização por tabelas RBAC e RLS deny-by-default:

Os providers consultam as rotas locais e o PostgreSQL. O adapter ainda simula canais com callbacks periódicos de 30 segundos; isso não é publicação de eventos e não altera as permissões. As consultas usam sessão local e RLS; usuários Cliente permanecem limitados ao próprio cliente, e service_role nunca é enviado ao browser.

- **Master**: papel complementar e superior ao Admin, atribuído exclusivamente a `marcos.vinicius@loylegal.com`. Consulta e edita toda a matriz de permissões e executa ações excepcionais explicitamente protegidas, mantendo também o papel Admin por compatibilidade.
- **Admin**: gerencia clientes, profiles, robôs, regras e publicações conforme os grants disponíveis. Pode editar e arquivar usuários e clientes, sem excluir fisicamente seus históricos. No painel de permissões, altera somente Operador, Dev, Cliente e Suporte.
- O vínculo entre usuário e Cliente é alterado somente pelo endpoint `/api/admin/users`, após validação server-side do papel Admin. A operação usa o cliente administrativo apenas depois dessa validação; papéis não administrativos recebem `403` e não podem escolher outro `cliente_id` por payload.
- O primeiro administrador é inicializado de forma idempotente para `marcos.vinicius@loylegal.com`; os demais vínculos são gerenciados pela tela administrativa.
- A importação em lote de robôs e o download do modelo são exclusivos do papel Admin. A interface reutiliza a autorização da sessão autenticada, carregada centralmente, evitando validações repetidas a cada ação; operações persistentes continuam protegidas no servidor e pelas policies RLS.
- **Operador**: consulta robôs e detalhes e altera somente `ideal` e `max` pela permissão `robots.capacity.update`; não acessa Configurações nem a manutenção completa de robôs.
- A ação **Criar cópia** exige `robots.duplicate` e vínculo real com o papel Admin ou Master. A permissão aparece na matriz de Configurações, mas é protegida contra atribuição a outros papéis. A cópia reaproveita os dados cadastrais e regras como ponto de partida; IDs, histórico, arquivos, documentação publicada e publicações não são copiados.
- **Dev**: inicia com as mesmas permissões e o mesmo escopo global de dados do Operador. Sua matriz é independente e pode ser editada por Admin ou Master para receber novas capacidades no futuro.
- **Cliente**: lê somente seu próprio cliente, seus robôs, regras e publicações. Pode receber no cadastro do usuário a capacidade individual **Pode editar robôs**; sem ela permanece somente leitura. A capacidade limita a escrita aos robôs da empresa vinculada e não concede criação, exclusão, transferência, catálogos ou documentação.
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

A escrita individual do Cliente consulta `profiles.pode_editar_robos_cliente` diretamente no banco. `robos_update_staff` usa `private.can_update_robot(cliente_id)` em `USING` e `WITH CHECK`, bloqueando IDs de outros Clientes e a transferência da linha. O trigger `robos_protect_client_update` protege campos administrativos mesmo contra consultas diretas ao PostgreSQL feitas por papéis sem autorização.
- Todo usuário autenticado pode alterar exclusivamente a própria senha pelo menu da conta. A operação usa a sessão PostgreSQL local e não concede acesso administrativo a outros usuários.
- O histórico do Dashboard respeita `publicacoes_select`; somente papéis com `publications.create` podem inserir registros por **Salvar e publicar**.
- A área de arquivos `robot-manuals` é servida pelo filesystem persistente do servidor, não pelo Supabase Storage. A rota exige sessão e acesso ao cliente/robô para leitura; escrita, remoção e cópia também verificam `robots.update`. Os metadados em `robot_uploaded_documents` têm proteção RLS própria. Não há acesso anônimo aos arquivos.
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

A sincronização manual de versões exige sessão válida e papel `admin` ou `master` na API. O token do Notion existe apenas no ambiente do servidor e nunca é enviado ao navegador. Somente a API autenticada consulta a fonte de dados e altera `robos.versao` e `robos.version_checked_at`; as policies existentes de `robos` permanecem como defesa adicional.

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

Os bytes de `robot-documentation` ficam no filesystem persistente do servidor e só são servidos pelas rotas autenticadas da aplicação. Na rota genérica atual, leitura exige sessão e acesso ao cliente/robô; gravação, remoção e cópia também verificam `robots.update`. As tabelas de documentação mantêm suas próprias policies RLS e validações de papel nas APIs/RPCs. A proteção dos bytes não é feita por policies de bucket no PostgreSQL.

Versões publicadas permanecem no filesystem, sob `<robo_id>/versions/`, e os registros guardam apenas os caminhos e snapshots. O helper chamado `signedUrl` retorna uma URL da API autenticada, não uma URL assinada de serviço externo. A rota genérica de arquivos não expõe `robot-documentation-templates`; publicação e alteração de estado continuam protegidas nas APIs/RPCs de documentação. O volume deve ter acesso restrito ao usuário do container e backup próprio.

| Permissão | Admin | Operador | Cliente | Suporte |
|---|---:|---:|---:|---:|
| `robot_center_documentation.read` | Sim | Conforme `robots.read` | Próprio cliente | Conforme `robots.read` |
| `robot_center_documentation.manage` | Sim | Não | Não | Não |

## Orçamentos

O módulo `/orcamentos` exige papel real `master` ou `admin` na navegação e na validação de rota. A ocultação do item não substitui a proteção no servidor e no banco. As tabelas `budgets`, `budget_items`, `budget_action_catalog` e `budget_action_aliases` possuem RLS e grants somente para `authenticated`, com policies que repetem a exigência de Master/Admin.

As permissões cadastradas são `budgets.read`, `budgets.create`, `budgets.update` e `budgets.dictionary.manage`, inicialmente atribuídas somente a Master e Admin. Nenhuma policy usa `user_metadata`, e usuários anônimos ou demais papéis não consultam nem alteram orçamentos por acesso direto ao PostgreSQL.

O catálogo `robot_systems` segue `robot_catalog.read` e `robot_catalog.manage`: os mesmos papéis que consultam os demais catálogos podem lê-lo, enquanto somente Master e Admin podem cadastrar, editar ou inativar Sistemas.

A RPC `public.save_budget` usa `SECURITY INVOKER`, valida novamente os papéis Master/Admin e permanece sujeita às policies das tabelas. A substituição dos itens recebe policy de `DELETE` restrita aos mesmos papéis e somente para orçamento ativo. Informar um Cliente não amplia acesso: a função aceita apenas Cliente ativo e o módulo continua exclusivamente administrativo.

## Painel administrativo de permissões

O **Controle de Acesso** apresenta recursos em cards e níveis Sem acesso, Somente leitura, Personalizado e Acesso total. A edição detalhada ocorre em drawer: fechar descarta, “Aplicar alterações” atualiza apenas o rascunho e somente “Salvar alterações” persiste a matriz. Os produtos de Robôs possuem permissões `robots.product.*.read`; menu, rota direta e `robos_select` exigem o produto correspondente, mantendo também `robots.read` e o escopo por Cliente.

O painel **Configurações → Permissões** agrupa o catálogo de `permissions` pelo campo `recurso` e mostra quais registros ativos de `roles` estão relacionados por `role_permissions`. A descrição funcional é o título e o código técnico aparece como informação secundária. A API `/api/admin/permissions` repete a validação de Admin/Master no servidor e não confia na visibilidade da aba.

A matriz não permite atribuir ao papel Cliente permissões administrativas de criação, edição global, arquivamento ou capacidade de Robôs, criação de Publicações, gerenciamento de catálogos/documentação/clientes/usuários ou Controle de Acesso. A interface desabilita essas combinações, a RPC as rejeita e a policy de `role_permissions` impede inserção direta. A edição de Robôs por Cliente é sempre individual no cadastro do usuário.

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

## Exclusão permanente de Robôs

Somente o papel Master pode executar `DELETE` em `public.robos`. A interface apresenta a ação apenas ao Master, aguarda a confirmação do banco e não remove o item localmente quando a operação falha. Admin, Cliente, Operador, Dev e Suporte permanecem bloqueados pela policy `robos_delete_master`.

O trigger `robos_audit_master_delete` repete a validação de Master e grava uma cópia integral do registro em `private.robot_deletion_audit` antes da exclusão. A tabela de auditoria não possui acesso para `anon` ou `authenticated`.

## Dashboard para todos os perfis

Todos os papéis ativos recebem `dashboard.read`, `robots.read` e leitura dos quatro produtos para consultar a Dashboard. Master, Admin, Head de Setor, Operador, Dev e Suporte possuem escopo interno global. O papel Cliente continua condicionado a `private.can_access_cliente`, que exige `profiles.cliente_id` ativo e igual ao `robos.cliente_id`. Filtros da interface nunca ampliam esse conjunto.

## Documentação técnica do sistema

Master e Admin podem acessar a central em `/documentacao` pelo menu da conta. A rota valida a sessão e os vínculos reais em `user_roles` no servidor antes de ler e renderizar os documentos versionados do repositório. Operador, Head de Setor, Dev, Cliente e Suporte são redirecionados para `/minha-pagina`; ocultar a opção no menu não é a única barreira de acesso.

As preferências modulares dos gráficos pertencem ao próprio usuário. `dashboard_chart_preferences` aplica RLS por `auth.uid()` em todas as operações; o papel administrativo não recebe exceção para ler layouts de terceiros.

- A rota de administração valida sessão e papel Admin no servidor.
- A raiz documental exige permissão de leitura e acesso ao cliente do Robô. Fora do Admin, somente registros com status `published` ficam visíveis.
- O rascunho exige papel Admin e permissão de gerenciamento.
- Versões permitem leitura autorizada e inserção somente por Admin; trigger impede atualização ou exclusão.
- A futura visualização publicada utilizará `read`, separada de `manage`, sem ampliar automaticamente o acesso ao rascunho.
- A migration `20260808224500_allow_published_robot_documentation_view.sql` replica `read` somente para papéis que já possuem `robots.read`; ela não concede acesso adicional a Robôs.
## Tarefas pessoais

Todos os perfis autenticados possuem acesso funcional a Minha página, sem permissão RBAC adicional. `personal_tasks` concede `SELECT`, `INSERT`, `UPDATE` e `DELETE` somente a `authenticated`; cada policy exige `auth.uid() = user_id`. O trigger também torna `user_id` imutável após a criação e preenche o proprietário pela sessão. `client_id` é apenas uma referência opcional: a lista e o relacionamento continuam sujeitos às policies de `clientes` e não concedem acesso adicional nem tornam o ToDo compartilhado. Usuários anônimos e usuários tentando operar ToDos de terceiros permanecem bloqueados pela RLS.

`personal_page_preferences` e `personal_page_flows` repetem o isolamento por `auth.uid()`. A inserção de um atalho também exige que o Fluxo referenciado esteja visível à sessão pelas policies de `flows`. A configuração não concede `robots.read`, `flows.read` ou capacidades de escrita; os widgets continuam subordinados às permissões das entidades originais.

`personal_meetings` e `personal_notes` concedem CRUD somente a `authenticated`, sempre com `auth.uid() = user_id` em cada policy. Updates possuem `USING` e `WITH CHECK`; triggers tornam o proprietário imutável. Não existe policy administrativa, inclusive para Admin e Master. A associação de origem do ToDo é validada pelo mesmo proprietário, impedindo referência cruzada entre workspaces.
# Atualização: permissão da flag Kortex

A leitura e alteração de `robos.kortex` seguem as mesmas policies RLS e permissões já aplicadas à linha do robô; nenhuma permissão adicional é concedida.

O criador do fluxo pode atualizar sua descrição pela função controlada `update_flow_metadata`. Apenas Admin e Master podem alterar o cliente associado ao fluxo.

## Sessões próprias da aplicação

`app_sessions` mantém RLS habilitada e não possui policies para clientes do banco. `PUBLIC`, `anon` e `authenticated` não recebem grants; apenas o processo de backend com credencial privilegiada valida, cria ou revoga sessões. As APIs continuam validando papel e permissões antes de operações administrativas. O cookie HttpOnly não concede acesso direto ao PostgreSQL.
## Papéis SQL no PostgreSQL standalone

O papel `authenticated` recebe operações de leitura e escrita apenas nas tabelas públicas que têm RLS habilitado. As policies existentes continuam limitando as linhas por usuário, papel de negócio e escopo de cliente. Tabelas sem RLS não recebem privilégios diretos para esse papel.

O papel `service_role` é restrito ao servidor e recebe privilégios administrativos nas tabelas e sequences operacionais dos schemas `public`, `private` e `storage`. Em `auth.users`, a migration standalone restringe o acesso às colunas necessárias para login e administração de contas. `auth.identities` não é consultável pelo papel da aplicação. O papel não é usado pelo navegador.

## Login local com PostgreSQL

O papel `service_role`, usado exclusivamente pelo backend, pode consultar em
`auth.users` `id`, `email`, `encrypted_password`, `email_confirmed_at`,
`raw_app_meta_data`, `raw_user_meta_data` e `created_at`. Ele pode inserir os
campos de conta usados pela criação administrativa e atualizar somente e-mail,
senha, metadados de usuário e `updated_at`. A migration final revoga a concessão
ampla introduzida pelo histórico standalone antes de reaplicar essas permissões
por coluna. `anon` e `authenticated` não consultam diretamente as tabelas de
contas ou identidades.

No PostgreSQL standalone, `auth.uid()` e `auth.jwt()` leem as claims da
transação iniciada pelo servidor. RLS e as policies de domínio continuam
decidindo quais linhas o papel `authenticated` pode consultar ou alterar. A
conexão administrativa permanece exclusiva do servidor; o navegador não recebe
credenciais PostgreSQL.



## Grants locais verificados em 16/10/2026

A migration 20261016183651_standalone_private_function_grants.sql concede EXECUTE ao papel authenticated nas funções privadas can_update_robot(uuid), get_flow_creator_name(uuid), has_role(text), is_active_user(), publish_flow(uuid,jsonb) e update_flow_metadata(uuid,text,uuid). Ela completa os grants já registrados para has_permission(text) e can_access_cliente(uuid), sem alterar as policies. As seis permissões correspondem às funções que o banco de origem autoriza para consultas autenticadas.

service_role é usado somente no servidor. A migration de compatibilidade revoga o acesso amplo a auth.users restaurado para reproduzir os privilégios e reaplica somente os grants por coluna; auth.identities permanece inacessível à aplicação. anon e authenticated não consultam as tabelas de contas.

Na verificação local, marcos.vinicius manteve admin e master, leu 62 robôs e 25 clientes, e recebeu 42 mapeamentos de permissão. Um usuário com papel Cliente leu somente 1 cliente e 22 robôs, não acessou access_control, não viu o profile Master e não teve acesso a auth.users.

## Recuperação de senha

As rotas de recuperação são públicas apenas para solicitar e consumir um token. A aplicação não concede sessão ao solicitar o link. A tabela `app_password_reset_tokens` tem RLS habilitada, nenhuma policy ou grant para `PUBLIC`, `anon` ou `authenticated`, e acesso exclusivo ao backend com `service_role`. No PostgreSQL standalone local, a verificação confirmou RLS ativo, sem `SELECT` para `anon`/`authenticated` e com `SELECT`/`INSERT`/`UPDATE` para `service_role`; esse papel tem `BYPASSRLS`. O endpoint nunca retorna hash ou dados do usuário; o token bruto aparece somente no link local de desenvolvimento. Ao redefinir a senha, o servidor consome os tokens e revoga as sessões existentes. A operação não atribui papéis ou permissões.
