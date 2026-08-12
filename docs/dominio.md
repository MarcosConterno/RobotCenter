# Domínio do Robot Center

## Linguagem padronizada

### Robô

Todo Robô pertence a exatamente um produto por `productType`: `INTEGRADOR`, `CONSULTA_PROCESSUAL`, `PETICIONAMENTO` ou `MOVIMENTO`. A classificação não cria entidades ou tabelas independentes; ela segrega as listagens que reutilizam os mesmos componentes e permissões. Robôs Integradores existentes são classificados como `INTEGRADOR`.

O acesso aos produtos pode ser configurado individualmente no Controle de Acesso. A autorização efetiva combina a permissão geral de leitura de Robôs, a permissão do produto e o escopo de Cliente do usuário.

Todos os Robôs possuem `command`, que registra o comando técnico de execução e pode permanecer vazio em registros legados. Consulta Processual, Peticionamento e Movimento podem informar `tribunal` e `tribunalSystem`; esses campos permanecem nulos em Robôs Integradores.

Stack é opcional no cadastro do Robô. Uma Solicitação de Stack pertence obrigatoriamente a um Robô já cadastrado e percorre os estados Solicitada, Em análise, Aguardando informação, Concluída ou Cancelada. A Stack gerada é informação da solicitação e não cria vínculo automático com o catálogo.

Pode ser cadastrado individualmente ou importado em lote por administradores. O modelo Excel representa os mesmos dados do formulário: cliente, sistema, robô, CourtName, fila, stack, Ideal, Max, pacote, versão, descrição, ambiente, status, responsável, alterações e regras.

Na importação, Cliente é identificado pelo nome. Um nome ainda não cadastrado cria um Cliente com tenant técnico único, e todos os Robôs subsequentes com o mesmo nome recebem o mesmo `clienteId`. Assim, o vínculo permanece estável para consultas e filtros por Cliente.

Os identificadores de Cliente, Robô, Alteração e Publicação usados pela aplicação são UUIDs compatíveis com as chaves do PostgreSQL. A listagem de Robôs e Clientes é montada a partir do Supabase, sem registros mock iniciais.

Alterações confirmadas nas entidades operacionais são refletidas nas sessões abertas por meio do Supabase Realtime. Essa sincronização atualiza a representação em memória dos providers e não modifica as entidades, validações ou regras de autoria. Eventos sucessivos são agrupados antes da releitura para evitar consultas redundantes.

Cada Cliente possui a configuração visual `cor`, selecionada entre seis paletas controladas no próprio cadastro do Cliente. Todos os robôs vinculados ao mesmo Cliente exibem essa cor. O Robô mantém apenas `pacoteCor`, compartilhada entre pacotes com o mesmo nome normalizado.

Automação cadastrada e gerenciada pelo sistema. Possui identificação, sistema, pacote, ambiente, estado operacional, configuração técnica, responsável textual, versão, documentação da última alteração e regras funcionais.

O campo `pacote` também identifica a opção correspondente na propriedade `Pacote` da fonte de dados de versões do Notion. `versionCheckedAt` registra a última verificação concluída com sucesso; falhas de integração, pacote não encontrado ou versão ambígua preservam tanto esse instante quanto a versão existente.

### Sistema

Sistema com o qual o robô ou orçamento se relaciona. É administrado no catálogo `robot_systems`; Robôs preservam também o nome textual sincronizado para compatibilidade. Não é sinônimo de Cliente nem de Pacote.

### Pacote

Agrupamento funcional textual do Robô, como Documentos, Pastas ou Sinistros. Possui filtro próprio e não é Cliente.

### Ambiente

Contexto de execução do Robô. Valores aceitos: Produção, Teste e Desenvolvimento.

### Responsável

Pessoa ou equipe responsável pelo Robô, mantida como texto livre. Não representa a entidade Usuário e não cria vínculo de autenticação.

### Regra do Robô

Descrição de uma regra pertencente a um Robô. Cada regra possui o tipo `documentacao` ou `fora_documentacao` e uma ordem independente dentro do seu tipo. Os códigos visuais `RFxxx` e `RFDxxx` são derivados da posição e não são persistidos.

### Alteração de Robô

Registro histórico imutável de uma mudança realizada em um Robô. Possui descrição e data/hora próprias. Novas alterações são acrescentadas à lista; registros anteriores não são substituídos.

### Publicação

Evento histórico relacionado a um Robô por `roboId`. Possui categoria, descrição e data/hora. Não é uma cópia nem uma extensão da entidade Robô.

### Usuário

O perfil de usuário pode possuir vínculo opcional com um Cliente por `profiles.cliente_id`. Para o papel Cliente, o vínculo é obrigatório; para Admin, Operador, Dev e Suporte, é opcional. O vínculo determina o escopo de dados do usuário Cliente e não pode ser inferido pelo email ou pelo papel isoladamente.

Um usuário com papel Cliente pode receber individualmente `profiles.pode_editar_robos_cliente`. A capacidade não é herdada pelos demais usuários da empresa e não amplia o vínculo: permite editar apenas robôs cujo `cliente_id` seja igual ao do profile. Criação, arquivamento, transferência entre Clientes, mudança de produto, catálogos compartilhados e documentação permanecem administrativos.

Identidade cadastrada para futuro acesso à aplicação. Possui login e tipo. A senha existe somente no dado transitório do formulário e não pertence à entidade persistível de perfil.

O tipo **Suporte** representa consulta operacional sem permissões de escrita. Pode acessar Dashboard, listagem e detalhes dos Robôs e Fluxos em modo de visualização. Operador mantém consulta aos detalhes e atualização exclusiva da capacidade `ideal`/`max`; Admin permanece responsável pelo cadastro completo.

O tipo **Dev** nasce com a mesma matriz de permissões e o mesmo escopo de dados do Operador. Ele é um papel independente e editável, preparado para receber capacidades específicas posteriormente sem alterar o perfil Operador.

O papel **Master** é complementar ao papel Admin e representa a administração superior do controle de acesso. Ele é atribuído exclusivamente ao usuário `marcos.vinicius@loylegal.com`, que permanece também como Admin por compatibilidade com as autorizações existentes. O Master pode consultar e editar toda a matriz de permissões e executar ações excepcionais protegidas. Administradores comuns podem editar somente liberações de Operador, Cliente e Suporte; não alteram Admin, Master nem Controle de Acesso.

### Cliente

Organização cadastrada com nome, tenant e cor visual. É independente de Sistema e Pacote. Seu arquivamento é lógico e só é permitido quando não existem usuários ou robôs ativos vinculados.

Na administração, cada Cliente possui um resumo operacional derivado: quantidade de Robôs ativos, Fluxos e Documentos vinculados. Documentos somam separadamente a Documentação Upada e a Documentação Robot Center ativa, permitindo até dois documentos por Robô. A última atualização corresponde à data mais recente entre Cliente, seus Robôs, Fluxos e documentações internas.

## Entidades e contratos

| Entidade | Interface | Relacionamentos implementados |
|---|---|---|
| Robô | `Robo` | Contém Regras; possui Publicações. |
| Regra do Robô | `RegraRobo` | Pertence a um Robô por composição. |
| Publicação | `Publicacao` | `roboId` referencia logicamente um Robô. |
| Usuário | `Usuario` | Nenhum. |
| Cliente | `Cliente` | Nenhum. |

## Organização do código

- `src/domain/entities.ts`: entidades, uniões e constantes de valores aceitos.
- `src/domain/validation.ts`: schemas Zod dos dados de entrada.
- `src/domain/formatters.ts`: apresentação de datas ISO.
- `src/mocks/app.mock.ts`: conjunto único de dados iniciais.
- `src/data/AppDataProvider.tsx`: fonte temporária compartilhada e operações em memória.
- `src/components`: apresentação e interação.
- `src/app`: composição das rotas.

## Limites atuais

- Não existe persistência de Robô, Usuário ou Cliente após recarregar a página.
- Publicações locais são uma adaptação temporária baseada em `localStorage`.
- Não existe autenticação, autorização, API ou acesso ao Supabase.
- Cliente não deve ser inferido a partir de Sistema ou Pacote.
- Usuário não deve ser inferido a partir de Responsável.
# Persistência V1

Sistema e Pacote são catálogos relacionados ao `Robo`; Responsável e Ambiente continuam atributos diretos. Os nomes textuais de Sistema e Pacote permanecem sincronizados para compatibilidade das projeções existentes.

Para persistência, os IDs passam a UUID. Um robô pertence obrigatoriamente a um Cliente. As regras são armazenadas como registros filhos ordenados e categorizados. No domínio da aplicação, regras do documento técnico são expostas em `regras` e regras externas em `regrasForaDocumentacao`. `ultimaPublicacaoEm` é derivado da publicação mais recente e não é gravado no cadastro do robô.

Os dados técnicos operacionais do Robô incluem `courtName`, `fila`, `stack`, `ideal`, `max`, `pacote` e `versao`. `ideal` e `max` são inteiros não negativos, sendo `max` sempre maior ou igual a `ideal`.

Usuário autenticado é representado por `auth.users`; seus dados funcionais ficam em `profiles`, e seu tipo é obtido pelo RBAC. Senha é entrada exclusiva do Supabase Auth e nunca integra uma entidade persistida da aplicação.

## Tutorial do Robot Center

O Tutorial é um onboarding guiado e não obrigatório, resolvido conforme as capacidades reais da interface do usuário. O progresso pertence ao Profile autenticado, suporta versão e permanece disponível entre navegadores. Os estados são não iniciado, em andamento, concluído e pulado; uma conclusão não impede nova execução manual.

O onboarding padrão apresenta primeiro a Minha página e suas áreas pessoais de ToDo, Reuniões e Notas, além da personalização de widgets. Durante esses passos, o tour alterna as abas internas automaticamente sem criar ou alterar dados do usuário.

Tutoriais administrativos possuem um público baseado nos papéis reais do RBAC, rascunho editável e versões publicadas imutáveis. Página e elemento são escolhidos de um catálogo lógico; seletores CSS não integram o conteúdo informado pelo administrador. A execução utiliza a versão publicada adequada ao papel e ainda ignora passos incompatíveis com as capacidades atuais do usuário.
## Identidade visual compartilhada

A cor do Cliente pertence ao seu cadastro. A cor do Pacote é armazenada nos robôs por compatibilidade, mas é compartilhada pelo nome normalizado do pacote. A atribuição inicial usa ciclicamente a paleta `azul`, `violeta`, `verde`, `ambar`, `rosa` e `ciano`.
## Nome do usuário e credencial

O campo apresentado como `Nome` no cadastro de usuários continua persistido em `profiles.login` por compatibilidade com o modelo existente. A senha pertence ao Supabase Auth e pode ser alterada pelo próprio usuário autenticado, sem ser armazenada nas tabelas públicas da aplicação.

## Publicações do Dashboard

O histórico exibido em **Atualizações recentes** é composto por `Publicacao` persistida no banco. Um novo robô publicado recebe a categoria `Novo Robô`; uma edição publicada recebe `Atualização do Robô`.

Alterações de regras são registradas na descrição da publicação com a categoria funcional e o conteúdo da regra, permitindo diferenciar `Documentação` de `Fora da Documentação` sem criar uma entidade histórica paralela.

## Documentação Upada

O Robô pode possuir vários documentos externos em `uploadedDocuments`, incluindo PDF, DOCX e XLSX. Os metadados pertencem a `robot_uploaded_documents` e os objetos permanecem privados no bucket `robot-manuals`. `uploadedDocumentationPath` e `uploadedDocumentationName` continuam como compatibilidade para o PDF legado e são migrados sem apagar o objeto existente. Esses anexos não integram regras, publicações ou o motor DOCX/PDF.

## Orçamentos

O Orçamento representa uma estimativa estruturada de projeto criada manualmente ou importada de TXT. Ele preserva os parâmetros financeiros e os itens usados no momento da finalização. O total calculado é persistido e apresentado internamente como **Valor estimado**. O Dicionário de Orçamentos é a única fonte das ações e termos reconhecidos; editar o dicionário afeta somente cálculos futuros.

Linhas vazias e comentários iniciados por `---` são ignorados. Linhas sem correspondência permanecem visíveis como “Outra ação não catalogada”, com zero hora, para revisão explícita. O vínculo com Robô é opcional e foi preparado para a futura exibição do PDF em Outros documentos.

O vínculo do Orçamento com Cliente também é opcional. Admin e Master podem reabrir qualquer orçamento ativo, alterar Cliente, itens, parâmetros e origem e salvar sobre o mesmo registro; a atualização substitui os itens de forma transacional e recalcula os totais.

O Sistema do projeto é opcional e relacional. A interface seleciona um registro ativo de `robot_systems`, sem obrigar Cliente ou Robô, permitindo índices e vínculos futuros consistentes.

O ciclo do Orçamento possui os status `Novo`, `Enviado ao Comercial`, `Projeto Rejeitado`, `Arquivado` e `Aprovado`. Toda criação começa obrigatoriamente em `Novo`; mudanças de status são permitidas somente ao editar um orçamento já salvo.

O contrato de leitura e escrita do módulo está documentado em `docs/api-orcamentos.md`.

## Documentação Robot Center

A Documentação Robot Center é independente da Documentação Upada. Cada Robô pode possuir no máximo uma documentação interna, com um rascunho corrente e futuras versões publicadas imutáveis. O editor estruturado altera as regras reais do robô e mantém seções, textos complementares e notas exclusivamente no rascunho.

A exclusão da Documentação Robot Center é lógica, exclusiva do papel Master, não altera a Documentação Upada e preserva snapshots e arquivos históricos. Após a exclusão lógica, o robô pode receber uma nova documentação interna ativa.

São válidos os estados: somente Documentação Upada, somente Documentação Robot Center, ambas ou nenhuma. As RFs permanecem em `regras_robo` como fonte de verdade e não são duplicadas no módulo.

Os códigos RF/RNF são calculados por categoria, pai e ordem. O UUID da regra é a identidade estável usada pelos blocos documentais e por snapshots futuros.

Imagens, prints e legendas pertencem apenas ao rascunho documental. Upload, colagem e substituição não alteram a regra real. O preview utiliza URL assinada temporária; alinhamento e tamanho são dados do `DocumentSchema` destinados à futura geração oficial.

Ao publicar, o Robot Center cria um snapshot completo e imutável dos dados do robô, seções, RFs/RNFs, códigos calculados, blocos e imagens. O DOCX é produzido sobre uma cópia do template oficial; o PDF deriva obrigatoriamente desse DOCX por conversão temporária no ConvertAPI e é então preservado no Storage privado. O rascunho continua editável e nunca altera uma versão anterior.

O detalhe do Robô possui rota própria `/robos/{id}` e organiza os dados existentes em Detalhes Gerais, Documentação e Redmine. A área Documentação apresenta requisitos e arquivos separadamente. Redmine permanece apenas como ponto de extensão visual, sem integração ou dados fictícios.

Criação e edição também possuem páginas próprias (`/robos/novo` e `/robos/{id}/editar`) e reutilizam o mesmo formulário e as mesmas operações de persistência anteriormente apresentadas no drawer.

## Disparo e fluxo

O Robô possui uma forma de disparo controlada: Agendado, Manual ou por Gatilho. `gatilhoDeRoboId` identifica o robô anterior que pode iniciar o atual; `gatilhoParaRoboId` identifica o próximo robô que pode ser iniciado. Ambos pertencem obrigatoriamente ao mesmo Cliente.

## Importação segura

## Exclusão de Robô

A exclusão permanente de um Robô é uma operação exclusiva do Master e não equivale ao arquivamento. O cadastro deixa de existir em `robos`; configurações estritamente pertencentes a ele são removidas, enquanto Fluxos, solicitações de Stack e documentação histórica continuam existentes sem referência ao cadastro excluído. Uma cópia de auditoria privada é registrada antes da remoção.

## Importação segura

O UUID é a identidade estável do Robô na planilha. `DadosImportacaoRobo` separa a operação dos campos presentes na linha, permitindo atualização parcial sem transformar células vazias em novos valores.

## Fluxos por Cliente

O Montador de Fluxos documenta Robôs, Sistemas Externos, Decisões/Regras, Grupos/Contextos e Anotações. O Robô continua sendo referenciado por `robot_id`, portanto Nome, Sistema, Stack, Ambiente, Status, Agendamento e Versão refletem o cadastro atual. Grupos são apenas organização visual. Tipo, condição, fila e descrição das conexões pertencem à Edge.

Nodes de estrutura usam `decisionMode` em `flow_nodes.data`: `rule` mantém apresentação em card e `decision` usa apresentação em losango. Ambos aceitam múltiplas conexões de entrada e saída; a quantidade de Edges não é limitada pelo modo visual.

Um Fluxo é a documentação visual de uma automação e pertence obrigatoriamente a um Cliente. O cadastro principal mantém nome, descrição, status, versão atual e viewport. A composição é normalizada em Nodes e Edges; snapshots completos existem apenas no histórico de versões.

- `FlowNode` representa robô, gatilho, sistema, decisão, nota, texto ou grupo.
- Nodes de robô referenciam `robos.id`; nome, ambiente, CourtName, sistema e status são sempre lidos do cadastro atual do Robô.
- `FlowEdge` conecta dois Nodes do mesmo Fluxo e pode registrar tipo, rótulo, condição e descrição de negócio.
- `FlowVersion` é um snapshot imutável produzido na publicação.
- Notas, textos, grupos e decisões documentam o processo, sem alterar Robôs.

O papel Cliente edita apenas Fluxos do seu Cliente. Admin cria, edita, publica e exclui qualquer Fluxo. Operador e Suporte possuem somente visualização.
## Dashboard gráfica

A visão gráfica da Dashboard é uma projeção em memória do cadastro autorizado de Robôs. Ela não cria entidade persistente: agrupa o conjunto visível por Cliente, CourtName, Sistema e Stack. Os filtros são cumulativos e não substituem as policies de acesso do banco. Cada agrupamento pode ser visualizado em Barras, Pizza ou Rosca, com expansão de todas as categorias.

Os quadros são modulares. O conjunto inicial possui quatro exemplos, mas o usuário pode removê-los, criar até 20 quadros e escolher qualquer contexto suportado do cadastro de Robôs. A preferência de estrutura é persistida individualmente no Supabase; os valores agregados continuam calculados em tempo real sobre os registros autorizados.

## Minha página

Uma Tarefa Pessoal pertence a exatamente um usuário e representa uma prioridade diária ou futura. Possui título, nota opcional formatável, data, prioridade urgente/alta/média/baixa e status entre Abrir Tarefa, Orçamento, A Fazer, Aguardando Att Servidores, Aguardando Stack, Testando, Aguardando Dev, Aguardando Cliente, Em andamento e Concluído. Novos ToDos iniciam em A Fazer. A conclusão registra seu instante; qualquer reabertura remove esse registro. O vínculo com Cliente é opcional e não altera o proprietário nem o escopo pessoal do ToDo.

Na experiência de Minha página, o conceito passa a ser **ToDo**: aquilo que o usuário precisa fazer. A palavra Tarefa fica reservada para outro contexto futuro do sistema.

Uma Reunião Pessoal é o registro livre do que foi conversado, com agenda, participantes, resumo e bloco de anotações formatável. Anotações de Reunião e conteúdos de Nota suportam negrito, tópicos, listas numeradas e checkboxes, preservando registros antigos em texto simples. Uma Nota Pessoal é o conteúdo que o usuário deseja guardar sem transformá-lo em ação ou reunião. Reuniões e Notas podem originar um ToDo, mas não são alteradas pelo ToDo criado.

A Visualização Pessoal permite habilitar a tabela consolidada de Robôs e escolher Fluxos como atalhos. A preferência não copia nem altera essas entidades: ela referencia os dados operacionais já autorizados para o usuário.
## Remapeamento de usuários de Cliente

Antes de arquivar um Cliente, o Master pode reatribuir todos os usuários vinculados a outro Cliente ativo ou remover o vínculo. A mudança não altera os papéis dos usuários; um perfil Cliente sem vínculo permanece sem escopo operacional até receber novo Cliente.
# Atualização: Kortex

Todo robô pode ser marcado como usuário de Kortex. A marcação é opcional no cadastro e na edição; quando ativa, o card do robô exibe “Kortex”.
