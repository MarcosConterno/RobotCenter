# Domínio do Robot Center

## Linguagem padronizada

### Robô

Pode ser cadastrado individualmente ou importado em lote por administradores. O modelo Excel representa os mesmos dados do formulário: cliente, sistema, robô, CourtName, fila, stack, Ideal, Max, pacote, versão, descrição, ambiente, status, responsável, alterações e regras.

Na importação, Cliente é identificado pelo nome. Um nome ainda não cadastrado cria um Cliente com tenant técnico único, e todos os Robôs subsequentes com o mesmo nome recebem o mesmo `clienteId`. Assim, o vínculo permanece estável para consultas e filtros por Cliente.

Os identificadores de Cliente, Robô, Alteração e Publicação usados pela aplicação são UUIDs compatíveis com as chaves do PostgreSQL. A listagem de Robôs e Clientes é montada a partir do Supabase, sem registros mock iniciais.

Cada Cliente possui a configuração visual `cor`, selecionada entre seis paletas controladas no próprio cadastro do Cliente. Todos os robôs vinculados ao mesmo Cliente exibem essa cor. O Robô mantém apenas `pacoteCor`, compartilhada entre pacotes com o mesmo nome normalizado.

Automação cadastrada e gerenciada pelo sistema. Possui identificação, sistema, pacote, ambiente, estado operacional, configuração técnica, responsável textual, versão, documentação da última alteração e regras funcionais.

### Sistema

Sistema com o qual o robô se relaciona. É um valor textual do Robô. Não é sinônimo de Cliente nem de Pacote.

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

O perfil de usuário pode possuir vínculo opcional com um Cliente por `profiles.cliente_id`. Para o papel Cliente, o vínculo é obrigatório; para Admin, Operador e Suporte, é opcional. O vínculo determina o escopo de dados do usuário Cliente e não pode ser inferido pelo email ou pelo papel isoladamente.

Identidade cadastrada para futuro acesso à aplicação. Possui login e tipo. A senha existe somente no dado transitório do formulário e não pertence à entidade persistível de perfil.

O tipo **Suporte** representa consulta operacional restrita às Dashboards e não recebe permissões de escrita. Operador mantém consulta aos detalhes e atualização exclusiva da capacidade `ideal`/`max`; Admin permanece responsável pelo cadastro completo.

### Cliente

Organização cadastrada com nome, tenant e cor visual. É independente de Sistema e Pacote. Seu arquivamento é lógico e só é permitido quando não existem usuários ou robôs ativos vinculados.

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

A V1 mantém os conceitos e comportamentos atuais. Sistema, Pacote, Responsável e Ambiente continuam atributos de `Robo`.

Para persistência, os IDs passam a UUID. Um robô pertence obrigatoriamente a um Cliente. As regras são armazenadas como registros filhos ordenados e categorizados. No domínio da aplicação, regras do documento técnico são expostas em `regras` e regras externas em `regrasForaDocumentacao`. `ultimaPublicacaoEm` é derivado da publicação mais recente e não é gravado no cadastro do robô.

Os dados técnicos operacionais do Robô incluem `courtName`, `fila`, `stack`, `ideal`, `max`, `pacote` e `versao`. `ideal` e `max` são inteiros não negativos, sendo `max` sempre maior ou igual a `ideal`.

Usuário autenticado é representado por `auth.users`; seus dados funcionais ficam em `profiles`, e seu tipo é obtido pelo RBAC. Senha é entrada exclusiva do Supabase Auth e nunca integra uma entidade persistida da aplicação.
## Identidade visual compartilhada

A cor do Cliente pertence ao seu cadastro. A cor do Pacote é armazenada nos robôs por compatibilidade, mas é compartilhada pelo nome normalizado do pacote. A atribuição inicial usa ciclicamente a paleta `azul`, `violeta`, `verde`, `ambar`, `rosa` e `ciano`.
## Nome do usuário e credencial

O campo apresentado como `Nome` no cadastro de usuários continua persistido em `profiles.login` por compatibilidade com o modelo existente. A senha pertence ao Supabase Auth e pode ser alterada pelo próprio usuário autenticado, sem ser armazenada nas tabelas públicas da aplicação.

## Publicações do Dashboard

O histórico exibido em **Atualizações recentes** é composto por `Publicacao` persistida no banco. Um novo robô publicado recebe a categoria `Novo Robô`; uma edição publicada recebe `Atualização do Robô`.

Alterações de regras são registradas na descrição da publicação com a categoria funcional e o conteúdo da regra, permitindo diferenciar `Documentação` de `Fora da Documentação` sem criar uma entidade histórica paralela.

## Documentação Upada

O Robô pode possuir um PDF externo opcional, denominado Documentação Upada. No domínio, `uploadedDocumentationPath` e `uploadedDocumentationName` mapeiam os campos físicos legados `robos.manual_path` e `robos.manual_nome`. O objeto permanece privado no bucket `robot-manuals`. O arquivo não integra regras, publicações ou o motor DOCX/PDF e pode ser substituído durante a edição sem afetar outros documentos.

## Documentação Robot Center

A Documentação Robot Center é independente da Documentação Upada. Cada Robô pode possuir no máximo uma documentação interna, com um rascunho corrente e futuras versões publicadas imutáveis. O editor estruturado altera as regras reais do robô e mantém seções, textos complementares e notas exclusivamente no rascunho.

São válidos os estados: somente Documentação Upada, somente Documentação Robot Center, ambas ou nenhuma. As RFs permanecem em `regras_robo` como fonte de verdade e não são duplicadas no módulo.

Os códigos RF/RNF são calculados por categoria, pai e ordem. O UUID da regra é a identidade estável usada pelos blocos documentais e por snapshots futuros.

Imagens, prints e legendas pertencem apenas ao rascunho documental. Upload, colagem e substituição não alteram a regra real. O preview utiliza URL assinada temporária; alinhamento e tamanho são dados do `DocumentSchema` destinados à futura geração oficial.

Ao publicar, o Robot Center cria um snapshot completo e imutável dos dados do robô, seções, RFs/RNFs, códigos calculados, blocos e imagens. O DOCX é produzido sobre uma cópia do template oficial; o PDF deriva obrigatoriamente desse DOCX por conversão temporária no ConvertAPI e é então preservado no Storage privado. O rascunho continua editável e nunca altera uma versão anterior.

O detalhe do Robô possui rota própria `/robos/{id}` e organiza os dados existentes em Detalhes Gerais, Documentação e Redmine. A área Documentação apresenta requisitos e arquivos separadamente. Redmine permanece apenas como ponto de extensão visual, sem integração ou dados fictícios.

Criação e edição também possuem páginas próprias (`/robos/novo` e `/robos/{id}/editar`) e reutilizam o mesmo formulário e as mesmas operações de persistência anteriormente apresentadas no drawer.

## Disparo e fluxo

O Robô possui uma forma de disparo controlada: Agendado, Manual ou por Gatilho. `gatilhoDeRoboId` identifica o robô anterior que pode iniciar o atual; `gatilhoParaRoboId` identifica o próximo robô que pode ser iniciado. Ambos pertencem obrigatoriamente ao mesmo Cliente.

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
