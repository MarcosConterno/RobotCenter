# Domínio do Robot Center

## Linguagem padronizada

### Robô

Pode ser cadastrado individualmente ou importado em lote por administradores. O modelo Excel representa os mesmos dados do formulário: cliente, sistema, robô, CourtName, fila, stack, Ideal, Max, pacote, versão, descrição, ambiente, status, responsável, alterações e regras.

Na importação, Cliente é identificado pelo nome. Um nome ainda não cadastrado cria um Cliente com tenant técnico único, e todos os Robôs subsequentes com o mesmo nome recebem o mesmo `clienteId`. Assim, o vínculo permanece estável para consultas e filtros por Cliente.

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

Identidade cadastrada para futuro acesso à aplicação. Possui login e tipo. A senha existe somente no dado transitório do formulário e não pertence à entidade persistível de perfil.

### Cliente

Organização cadastrada com nome e tenant. É independente de Sistema e Pacote. Seu arquivamento é lógico e só é permitido quando não existem usuários ou robôs ativos vinculados.

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
