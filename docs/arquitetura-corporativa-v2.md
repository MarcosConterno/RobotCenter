# Arquitetura de Banco V1 — Robot Center

> Status: arquitetura concluída para implementação, ainda sem migrations, SQL, integração ou alteração no Supabase.

## 1. Escopo consolidado

Este documento conclui somente as decisões necessárias para iniciar a primeira versão do banco. São consideradas aprovadas as definições de:

- `AGENTS.md`;
- `docs/refatoracao-pre-banco.md`;
- `docs/modelagem-banco.md`;
- `docs/dominio.md`;
- `docs/regras-negocio.md`;
- `docs/permissoes.md`.

A V1 preserva o domínio e os fluxos atuais. Não transforma Sistema, Pacote, Responsável ou Ambiente em novas entidades. Também não inclui execução de robôs, logs, versionamento avançado, equipes, auditoria completa ou outras funcionalidades ainda inexistentes na aplicação.

As únicas ampliações estruturais são as indispensáveis para persistência segura:

1. Supabase Auth e perfil de aplicação separados;
2. RBAC normalizado;
3. Cliente como limite de acesso aos dados;
4. Regras de robô como linhas filhas ordenadas;
5. metadados técnicos de criação, alteração e exclusão lógica.

---

## 2. Decisões arquiteturais resolvidas

### 2.1 Cliente e isolamento

`Cliente` continua sendo a entidade já existente no domínio. Na V1, seu identificador passa a representar também a fronteira de dados usada pelo RLS.

Cada robô pertence obrigatoriamente a um cliente por `cliente_id`. Essa relação não aparece hoje no type `Robo`, mas é indispensável para que usuários do tipo Cliente não visualizem robôs de outras empresas. Não será criada uma entidade paralela chamada Tenant.

Perfis administrativos e operacionais podem não pertencer a um cliente específico. Perfis com papel Cliente devem possuir `cliente_id`.

### 2.2 Sistema, Pacote, Responsável e Ambiente

Na V1, permanecem campos do robô:

- `sistema`: texto obrigatório;
- `pacote`: texto obrigatório;
- `responsavel`: texto obrigatório;
- `ambiente`: valor controlado entre Produção, Teste e Desenvolvimento.

Essa decisão mantém compatibilidade integral com os formulários, filtros, mocks e types atuais. A eventual normalização desses conceitos fica registrada apenas como recomendação futura.

### 2.3 Regras

As regras deixam de ser armazenadas como array dentro do registro do robô e passam a linhas de `regras_robo`. Isso é necessário porque PostgreSQL relacional precisa preservar ordem, identidade e integridade de cada regra.

A interface continua recebendo `regras: RegraRobo[]`; a camada de acesso recompõe o array ordenando pelo campo `ordem`.

### 2.4 Publicações

`Publicacao` continua representando o feed funcional atual. Cada publicação pertence a um robô, tem categoria, descrição e data de publicação. Não haverá, na V1, workflow de aprovação, snapshot, rollback ou entidade de release.

Publicações serão imutáveis depois de criadas. Correções futuras serão feitas por novo registro, preservando o histórico do feed.

### 2.5 Usuário e responsável

Usuário autenticado e responsável textual pelo robô continuam conceitos diferentes:

- usuário autenticado: `auth.users` + `profiles` + RBAC;
- responsável pelo robô: campo textual `robos.responsavel`.

Não será criada relação entre responsável e usuário nesta versão.

---

## 3. Estratégia definitiva de UUID

### Decisão

- Todas as tabelas de aplicação usarão chave primária `uuid`.
- Os UUIDs serão gerados no banco com a função padrão disponível no PostgreSQL/Supabase.
- `profiles.id` será simultaneamente chave primária e foreign key para `auth.users.id`.
- IDs numéricos atuais dos mocks não serão persistidos como chave primária definitiva.

### Justificativa

UUID evita coordenação de sequências entre ambientes, é apropriado para referências expostas pela API e coincide com o identificador usado pelo Supabase Auth.

### Compatibilidade

Antes da integração, os types TypeScript de `id`, `roboId` e demais referências deverão mudar de `number` para `string`. Como os dados atuais são mocks, não existe migração de chaves remotas. Se houver dados locais relevantes em `localStorage`, a importação deverá gerar UUIDs e manter um mapa temporário entre ID antigo e novo.

---

## 4. Estratégia definitiva de timestamps

### Padrão

- Instantes serão armazenados como `timestamptz` em UTC.
- Entidades mutáveis terão `created_at` e `updated_at` obrigatórios.
- `updated_at` será atualizado automaticamente pelo banco.
- `created_by` e `updated_by` serão UUIDs opcionais relacionados a `profiles`, permitindo também operações técnicas ou importações.
- Datas devolvidas à aplicação serão strings ISO 8601, compatíveis com os formatadores atuais.

### Aplicação por tabela

| Tabela | Timestamps |
|---|---|
| `clientes` | `created_at`, `updated_at`, `deleted_at` |
| `profiles` | `created_at`, `updated_at`, `deleted_at` |
| `roles` | `created_at`, `updated_at` |
| `permissions` | `created_at`, `updated_at` |
| `user_roles` | `created_at` |
| `role_permissions` | `created_at` |
| `robos` | `created_at`, `updated_at`, `deleted_at` |
| `regras_robo` | `created_at`, `updated_at`, `deleted_at` |
| `publicacoes` | `publicada_em`, `created_at` |

`ultima_publicacao_em` permanece no modelo de leitura da aplicação, mas não será armazenado em `robos`: será calculado a partir da publicação mais recente.

---

## 5. Estratégia definitiva de soft delete

### Usar soft delete

- `clientes`;
- `profiles`;
- `robos`;
- `regras_robo`.

Essas tabelas recebem `deleted_at` e `deleted_by`. Registros excluídos ficam ocultos das consultas normais e das policies de uso da aplicação.

### Não usar soft delete

- `roles` e `permissions`: usam campo `ativo`, pois são catálogo de autorização;
- `user_roles` e `role_permissions`: vínculos podem ser removidos ou, se for necessário preservar vigência posteriormente, evoluídos por migration;
- `publicacoes`: são registros históricos imutáveis e não devem ser alterados ou excluídos pelo fluxo normal.

### Regras

- Exclusão de cliente com robôs ativos deve ser impedida pelo caso de uso.
- Exclusão de robô não remove regras nem publicações em cascata.
- Restauração deve validar novamente as constraints de unicidade.
- Exclusão física ficará restrita a rotinas administrativas futuras de retenção, fora do CRUD comum.

---

## 6. Modelo definitivo de Supabase Auth e profiles

### `auth.users`

É a única fonte de credenciais, sessões e identidade de login. Nenhuma tabela da aplicação terá coluna de senha.

### `profiles`

| Campo | Obrigatório | Finalidade |
|---|---:|---|
| `id` | sim | UUID igual a `auth.users.id` |
| `login` | sim | nome de login/exibição preservado do domínio atual |
| `cliente_id` | condicional | cliente associado ao usuário com acesso de Cliente |
| `ativo` | sim | habilitação funcional do perfil |
| `created_at` | sim | criação |
| `updated_at` | sim | última alteração |
| `deleted_at` | não | exclusão lógica |
| `deleted_by` | não | ator da exclusão |

O email permanece no Supabase Auth e não precisa ser duplicado em `profiles` na V1. A tela de cadastro deverá, na etapa de integração, tratar senha apenas como entrada transitória para o Auth.

### Regras de consistência

- todo profile deve corresponder a um usuário Auth;
- `login` deve ser único entre profiles não excluídos;
- profile com papel Cliente precisa possuir `cliente_id` ativo;
- Admin e Operador podem ter `cliente_id` nulo;
- desativar profile impede acesso funcional sem apagar o usuário Auth automaticamente;
- criação de usuário, profile e papel deverá ser orquestrada por operação administrativa de servidor, com compensação se uma etapa falhar.

---

## 7. Modelo definitivo de RBAC

A propriedade atual `Usuario.tipo` deixa de ser coluna do profile e passa a ser resultado do RBAC.

### `roles`

| Campo | Obrigatório | Observação |
|---|---:|---|
| `id` | sim | UUID |
| `codigo` | sim | identificador estável e único |
| `nome` | sim | nome exibido |
| `descricao` | não | finalidade do papel |
| `ativo` | sim | habilitação |
| timestamps | sim | criação e alteração |

Papéis iniciais: `admin`, `operador` e `cliente`, equivalentes aos valores atuais Admin, Operador e Cliente.

### `permissions`

| Campo | Obrigatório | Observação |
|---|---:|---|
| `id` | sim | UUID |
| `codigo` | sim | identificador estável e único |
| `recurso` | sim | dashboard, robôs, usuários ou configurações |
| `acao` | sim | ação permitida |
| `descricao` | não | descrição funcional |
| `ativo` | sim | habilitação |
| timestamps | sim | criação e alteração |

### `user_roles`

| Campo | Obrigatório | Observação |
|---|---:|---|
| `id` | sim | UUID |
| `user_id` | sim | FK para `profiles.id` |
| `role_id` | sim | FK para `roles.id` |
| `created_at` | sim | atribuição |
| `created_by` | não | ator da atribuição |

A combinação `user_id + role_id` será única. A aplicação atual usa um papel principal por usuário; o modelo N:N permite evolução sem alteração de schema. Na V1, o caso de uso de cadastro atribuirá exatamente um dos três papéis iniciais.

### `role_permissions`

| Campo | Obrigatório | Observação |
|---|---:|---|
| `id` | sim | UUID |
| `role_id` | sim | FK para `roles.id` |
| `permission_id` | sim | FK para `permissions.id` |
| `created_at` | sim | concessão |

A combinação `role_id + permission_id` será única.

### Matriz inicial aprovada

| Área | Admin | Operador | Cliente |
|---|:---:|:---:|:---:|
| Dashboard | acesso | acesso | acesso |
| Robôs | acesso completo | acesso completo | acesso aos robôs do próprio cliente |
| Usuários | acesso completo | sem acesso | sem acesso |
| Configurações | acesso | acesso | acesso limitado ao que a interface atual disponibiliza |

As permissões serão semeadas por migration, mas a definição física dos códigos será feita na etapa de implementação sem ampliar funcionalidades.

---

## 8. Estratégia definitiva de RLS

RLS será habilitada em todas as tabelas da aplicação expostas pela Data API. A ausência de policy significa ausência de acesso.

### Princípios

1. requisição deve possuir usuário autenticado e profile ativo;
2. Admin possui acesso global às tabelas funcionais previstas em `docs/permissoes.md`;
3. Operador possui acesso funcional a Dashboard, Robôs e Configurações, sem administrar usuários;
4. Cliente acessa somente robôs associados ao seu `profiles.cliente_id` e publicações/regras desses robôs;
5. somente Admin gerencia `profiles`, `user_roles`, clientes e vínculos de autorização;
6. `roles`, `permissions` e `role_permissions` são legíveis conforme necessidade da interface, mas mutáveis apenas por operação administrativa controlada;
7. publicações podem ser inseridas pelos papéis autorizados, mas não atualizadas nem excluídas;
8. a chave service role nunca será exposta no navegador;
9. `user_metadata` do JWT não será fonte de autorização;
10. policies validarão a linha existente e a nova linha nas operações de update.

### Estratégia de avaliação

O banco terá funções auxiliares privadas para verificar perfil ativo, papel e permissão. Essas funções ficarão fora do schema exposto, terão privilégios mínimos e serão testadas. Claims customizadas podem ser adicionadas futuramente como otimização, mas a fonte definitiva da V1 serão as tabelas de RBAC.

### Proteção contra acesso cruzado

O cliente de um robô não pode ser trocado por usuário Cliente. Inserção ou alteração de `cliente_id` fica limitada aos papéis administrativos autorizados. Regras e publicações herdam o escopo por meio da FK para o robô.

---

## 9. Estratégia definitiva de constraints

### Gerais

- toda PK é não nula e imutável;
- textos obrigatórios são validados contra vazio após remoção de espaços;
- timestamps possuem coerência temporal;
- `deleted_by` só pode existir com `deleted_at`;
- códigos de catálogo são únicos;
- enums funcionais usam check constraints compatíveis com os unions TypeScript atuais.

### Por entidade

| Tabela | Constraints principais |
|---|---|
| `clientes` | `tenant` único entre ativos; nome e tenant não vazios |
| `profiles` | login único entre ativos; FK para Auth; cliente válido quando informado |
| `roles` | código único e não vazio |
| `permissions` | código único; combinação recurso + ação única |
| `user_roles` | combinação usuário + papel única |
| `role_permissions` | combinação papel + permissão única |
| `robos` | nome, sistema, pacote, descrição, stack, fila, versão e responsável não vazios; ambiente limitado aos três valores atuais; cliente obrigatório |
| `regras_robo` | descrição não vazia; ordem inteira não negativa; ordem única por robô entre regras ativas |
| `publicacoes` | categoria limitada aos quatro valores atuais; descrição não vazia; data obrigatória |

### Regras que permanecem na aplicação

Validações de tamanho e mensagens amigáveis continuam no Zod/formulários. Regras que dependem de várias tabelas ou de fluxo, como profile Cliente exigir cliente e impedir exclusão de cliente com robôs ativos, serão aplicadas no caso de uso e, quando apropriado, reforçadas por função/trigger transacional na implementação.

---

## 10. Estratégia definitiva de foreign keys

| Origem | Destino | Ao excluir o destino |
|---|---|---|
| `profiles.id` | `auth.users.id` | restringir/gerir pelo fluxo de Auth; não apagar histórico automaticamente |
| `profiles.cliente_id` | `clientes.id` | restringir |
| `user_roles.user_id` | `profiles.id` | cascade apenas para vínculo técnico se houver exclusão física administrativa |
| `user_roles.role_id` | `roles.id` | restringir |
| `role_permissions.role_id` | `roles.id` | cascade apenas para vínculo técnico |
| `role_permissions.permission_id` | `permissions.id` | restringir |
| `robos.cliente_id` | `clientes.id` | restringir |
| `regras_robo.robo_id` | `robos.id` | restringir |
| `publicacoes.robo_id` | `robos.id` | restringir |
| campos `created_by`, `updated_by`, `deleted_by` | `profiles.id` | manter nulo ou restringir conforme campo; nunca apagar fatos históricos em cascata |

Como cliente, robô e profile usam soft delete, o fluxo normal não aciona exclusões físicas. Cascades ficam limitados a tabelas de junção sem significado histórico.

---

## 11. Estratégia definitiva de índices

Serão criados apenas índices ligados a constraints, RLS, filtros e ordenações atuais.

### Índices obrigatórios

- PK de todas as tabelas;
- unicidade de `clientes.tenant` entre registros ativos;
- unicidade de `profiles.login` entre registros ativos;
- unicidade de `roles.codigo` e `permissions.codigo`;
- unicidades de `user_roles` e `role_permissions`;
- `profiles(cliente_id)` para isolamento;
- `user_roles(user_id, role_id)` e índice inverso por `role_id`;
- `role_permissions(role_id, permission_id)` e índice inverso por `permission_id`;
- `robos(cliente_id, deleted_at)` para RLS e listagem;
- `robos(cliente_id, ativo, ambiente)` para filtros atuais;
- índices de busca/filtro em sistema, pacote e responsável somente após validar o padrão real de pesquisa;
- `regras_robo(robo_id, ordem)` entre regras ativas;
- `publicacoes(robo_id, publicada_em desc)`;
- `publicacoes(publicada_em desc)` para o feed permitido ao papel;
- índices nas foreign keys de auditoria técnica (`created_by`, etc.) apenas quando usados por consulta ou necessários ao volume.

### Critérios

- comparações textuais case-insensitive usadas em unicidade terão normalização consistente;
- índices parciais excluirão registros com soft delete quando a consulta normal fizer o mesmo;
- não haverá GIN, full-text, índices vetoriais ou particionamento na V1;
- índices adicionais dependerão de plano de execução e métricas, não de hipótese.

---

## 12. Tabelas confirmadas para a versão 1

### Gerida pelo Supabase

1. `auth.users` — usuários e credenciais.

### Tabelas da aplicação

1. `clientes`;
2. `profiles`;
3. `roles`;
4. `permissions`;
5. `user_roles`;
6. `role_permissions`;
7. `robos`;
8. `regras_robo`;
9. `publicacoes`.

São nove tabelas de aplicação. Não serão adicionadas tabelas de ambientes, sistemas, pacotes, responsáveis, equipes, versões, execuções, logs, documentos, auditoria ou IA na V1.

---

## 13. Campos definitivos das tabelas de domínio

### `clientes`

`id`, `nome`, `tenant`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `deleted_by`.

### `robos`

`id`, `cliente_id`, `nome`, `sistema`, `pacote`, `descricao`, `ambiente`, `ativo`, `stack`, `fila`, `versao`, `responsavel`, `alteracao_realizada`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `deleted_by`.

`ultima_publicacao_em` não é coluna persistida: será derivada de `publicacoes`.

### `regras_robo`

`id`, `robo_id`, `descricao`, `ordem`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `deleted_by`.

### `publicacoes`

`id`, `robo_id`, `categoria`, `descricao`, `publicada_em`, `created_at`, `created_by`.

### Valores controlados preservados

- ambiente: Produção, Teste, Desenvolvimento;
- categoria de publicação: feature, bugfix, update, hotfix;
- papéis iniciais: Admin, Operador, Cliente, persistidos por códigos estáveis normalizados.

---

## 14. Relacionamentos confirmados

```text
auth.users 1 ─── 1 profiles

clientes 1 ─── N profiles
clientes 1 ─── N robos

profiles N ─── N roles
          por user_roles

roles N ─── N permissions
      por role_permissions

robos 1 ─── N regras_robo
robos 1 ─── N publicacoes

profiles 1 ─── N registros criados/alterados/excluídos
          por created_by/updated_by/deleted_by
```

Não há relação entre `responsavel` e `profiles`, nem entre `sistema`/`pacote` e qualquer tabela na V1.

---

## 15. Contratos de leitura compatíveis com a aplicação

O banco normalizado não exige alteração visual. A futura camada de dados deverá entregar DTOs equivalentes aos types atuais:

- `Robo.regras` será montado a partir de `regras_robo` ordenadas;
- `Robo.ultimaPublicacaoEm` será calculado pela última `publicacoes.publicada_em` do robô;
- `Usuario.tipo` será apresentado a partir do papel principal atribuído;
- IDs serão strings UUID;
- datas continuarão como ISO string;
- Dashboard e telas usarão a mesma fonte persistida, como já ocorre com o provider em memória.

Formulários continuarão com Zod. Os schemas de formulário não devem ser usados como tipos de linha do banco, especialmente porque senha é transitória e campos derivados não são persistidos.

---

## 16. Evolução futura por migrations

A estrutura suporta crescimento sem antecipar funcionalidades:

- Sistema, Pacote, Responsável e Ambiente podem ser normalizados depois por estratégia expand–migrate–contract;
- múltiplos clientes por usuário podem ser introduzidos substituindo `profiles.cliente_id` por membership, mantendo período de compatibilidade;
- histórico completo pode ganhar tabela de auditoria sem mudar as PKs atuais;
- versões, execuções e logs podem ser adicionados como novos aggregates relacionados a `robos`;
- publicações podem evoluir para release/snapshot por novas colunas e tabelas;
- pesquisa full-text, particionamento e IA podem ser adicionados quando houver volume e caso de uso.

### Método obrigatório para evoluções

1. adicionar nova estrutura sem remover a antiga;
2. preencher e validar dados em lotes;
3. adaptar leituras e escritas;
4. monitorar e reconciliar;
5. remover o legado em migration posterior.

Migrations aplicadas serão imutáveis e forward-only. Toda alteração incluirá constraints, índices, grants e RLS correspondentes, além de atualização dos tipos gerados e da documentação.

---

## 17. Recomendações futuras fora do escopo

Estas recomendações não alteram a V1:

- substituir `profiles.cliente_id` por `tenant_memberships` se usuários precisarem atuar em vários clientes;
- transformar Sistema e Pacote em entidades se ganharem cadastro, metadados ou relacionamentos próprios;
- relacionar Responsável a usuário/equipe quando ownership precisar de identidade e histórico;
- transformar Ambiente em entidade quando um robô puder existir simultaneamente em DEV, HML e PRD;
- introduzir versões imutáveis, snapshots e aprovações quando publicação se tornar implantação real;
- adicionar auditoria append-only para requisitos regulatórios;
- separar logs e execuções em estruturas de alto volume quando essa funcionalidade existir.

Cada item exige nova decisão de domínio e migration própria. Nenhum deles é pré-requisito para persistir os fluxos atuais.

---

## 18. Pendências encerradas e decisões de implementação

| Pendência anterior | Decisão V1 |
|---|---|
| IDs numéricos ou UUID | UUID em todas as entidades persistidas |
| usuário versus Auth | `auth.users` + `profiles`, sem senha própria |
| perfil e tipo | tipo substituído por RBAC |
| Cliente versus tenant | `clientes` é a fronteira de acesso na V1 |
| vínculo robô/cliente | `robos.cliente_id` obrigatório |
| Sistema/Pacote/Responsável | texto no robô |
| Ambiente | campo controlado no robô |
| regras em array | tabela filha ordenada |
| última publicação | campo derivado |
| exclusão | soft delete em cadastros; publicação imutável |
| timestamps | `timestamptz` UTC e ISO na aplicação |
| autorização | roles, permissions e RLS |
| escopo de tabelas | nove tabelas de aplicação confirmadas |

---

## 19. Critérios de aceite antes das migrations

A etapa de migrations deverá preservar estes critérios:

- nenhuma senha em tabela pública;
- RLS ativa antes de qualquer acesso pela aplicação;
- nenhuma tabela exposta sem policies explícitas;
- cliente não acessa outro cliente mesmo manipulando filtros ou IDs;
- Admin, Operador e Cliente respeitam `docs/permissoes.md`;
- constraints impedem valores fora dos unions atuais;
- regras mantêm ordem estável;
- publicações preservam ordem cronológica e imutabilidade;
- soft delete não aparece em consultas normais;
- foreign keys impedem órfãos;
- índices sustentam RLS, filtros e feed;
- tipos TypeScript gerados refletem UUID e nulabilidade;
- mocks só serão removidos depois de migração e validação funcional.

---

# Conclusão

**A arquitetura está pronta para iniciar a criação das migrations.**

O escopo da versão 1 está fechado em `auth.users` e nove tabelas de aplicação: `clientes`, `profiles`, `roles`, `permissions`, `user_roles`, `role_permissions`, `robos`, `regras_robo` e `publicacoes`.

Estão definidos UUID, timestamps, soft delete, Supabase Auth, profiles, RBAC, RLS, constraints, índices, foreign keys e relacionamentos. A estrutura preserva o domínio atual e permite evolução por migrations futuras sem antecipar novas funcionalidades.

A próxima etapa pode ser exclusivamente:

1. criar as migrations;
2. configurar o Supabase Auth;
3. configurar o RLS;
4. gerar os tipos TypeScript;
5. integrar a aplicação ao banco;
6. substituir os mocks pela persistência real.

Nenhuma dessas etapas foi executada neste momento.
