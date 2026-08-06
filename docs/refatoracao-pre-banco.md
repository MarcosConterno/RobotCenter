# Relatório da refatoração pré-banco

## Objetivo e restrições atendidas

A aplicação foi refatorada para alinhar domínio, tipos, interface e fonte de dados antes da modelagem física. Nenhuma tabela ou migration foi criada, nenhum SQL foi executado, nenhuma biblioteca Supabase foi integrada e nenhum banco remoto foi acessado.

## Problemas encontrados

- Cliente era usado como nome de filtro para `Robo.pacote`.
- Dashboard e `/robos` importavam mocks ou estados diferentes.
- Indicadores da Dashboard eram números fixos incompatíveis com os mocks.
- Publicação embutia um objeto Robô completo e misturava campos de domínio com cor de UI.
- Datas de Robô e Publicação usavam formatos textuais incompatíveis.
- `RobotFormData` duplicava manualmente quase toda a interface `Robot`.
- Regra era apenas `string`, sem contrato de entidade.
- Interfaces Usuario e Cliente estavam declaradas dentro da página.
- Senha era campo do formulário sem contrato explícito de entrada.
- Formulário de Robô aceitava campos obrigatórios vazios.
- Zod estava instalado, mas não era usado.
- Havia dois modelos incompatíveis de feed e dois conjuntos de indicadores.
- Existiam componentes antigos, placeholders vazios, imports potenciais e arquivos sem referência.
- Categorias e ambientes estavam repetidos em pontos diferentes.
- O papel da Topbar usava `Administrador`, enquanto o domínio usava `Admin`.

## Alterações realizadas e justificativas

### Domínio e validação

- Criado `src/domain/entities.ts` com `Robo`, `RegraRobo`, `Publicacao`, `Usuario`, `Cliente` e DTOs derivados.
- Criadas constantes únicas para ambientes, tipos de usuário e categorias de publicação.
- `DadosFormularioRobo` passou a derivar de `Robo` com `Omit`, evitando divergência.
- Criado `src/domain/validation.ts` com schemas Zod usados por todos os formulários.
- Criado `src/domain/formatters.ts` para apresentar datas ISO sem contaminar entidades com textos de UI.

### Fonte de dados e mocks

- Criado `src/mocks/app.mock.ts` como único conjunto de mocks.
- Criado `src/data/AppDataProvider.tsx` como fonte compartilhada temporária.
- Layout raiz passou a fornecer o contexto para todas as rotas.
- Leitura de publicações mantém compatibilidade com o formato legado do `localStorage`.
- Novas publicações usam formato versionado e referência `roboId`.

### Robôs

- `/robos` foi simplificada para consumir operações do provedor.
- Filtro “Cliente” foi corrigido para “Pacote”, sem inventar relação com Cliente.
- Props individuais do formulário foram substituídas por `initialValues`.
- Regras passaram a usar `RegraRobo` e continuam numeradas pela posição.
- Campos obrigatórios agora possuem validação HTML e Zod consistente.
- Data de última publicação passou a ISO internamente e continua formatada em pt-BR na UI.

### Dashboard

- Indicadores são calculados a partir da lista compartilhada.
- Tabela recebe os mesmos Robôs usados por `/robos`.
- Feed recebe Publicações separadas e resolve o Robô por ID.
- A inconsistência textual do mock de Cadastro de Documentos foi corrigida para Teste/Tokio Marine.

### Configurações

- Usuario, Cliente e tipos relacionados foram movidos para o domínio.
- Formulários usam os mesmos schemas e tratamento de erro.
- Senha foi explicitada em `DadosCadastroUsuario`, mas continua fora de `Usuario`.
- Valores do tipo de usuário vêm de uma constante única.

### Limpeza

Arquivos removidos por ausência de referência ou substituição:

- `src/types/robot.ts`
- `src/components/robos/robots.mock.ts`
- `src/components/dashboard/FeedCard.tsx`
- `src/components/dashboard/QuickStats.tsx`
- `src/components/dashboard/RightPanel.tsx`
- `src/components/ui/PageHeader.tsx`
- `src/components/ui/SectionCard.tsx`
- `src/components/ui/StatCard.tsx`
- arquivos vazios de `src/components/common`
- `src/styles/theme.css`
- `src/lib/utils.ts`

## Arquivos criados

- `src/domain/entities.ts`
- `src/domain/validation.ts`
- `src/domain/formatters.ts`
- `src/mocks/app.mock.ts`
- `src/data/AppDataProvider.tsx`
- `docs/dominio.md`
- `docs/regras-negocio.md`
- `docs/permissoes.md`
- `docs/refatoracao-pre-banco.md`

## Arquivos alterados

- `src/app/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/robos/page.tsx`
- `src/app/configuracoes/page.tsx`
- `src/components/dashboard/Feed.tsx`
- `src/components/dashboard/RobotsOverviewTable.tsx`
- `src/components/dashboard/StatsCards.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/Topbar.tsx`
- `src/components/robos/RobotCard.tsx`
- `src/components/robos/RobotDetails.tsx`
- `src/components/robos/RobotForm.tsx`
- `src/components/robos/RobotHeader.tsx`
- `src/components/robos/RobotTable.tsx`
- `docs/modelagem-banco.md`

## Problemas resolvidos

- Conceitos Cliente, Sistema e Pacote não são mais usados como sinônimos.
- Usuario e Responsável permanecem entidades/conceitos distintos.
- Publicação e Robô possuem contratos separados e relação explícita por ID.
- Types, formulários e mocks compartilham os mesmos contratos.
- Dashboard não possui totais fixos nem mock próprio.
- Existe uma única origem de mocks e uma única fonte de estado em execução.
- Validações estão centralizadas e preparadas para reutilização futura no servidor.
- Código morto identificado foi removido.

## Pendências restantes

- Decidir relacionamentos de Cliente.
- Definir autenticação, perfis, papéis e autorização.
- Resolver diferença de senha mínima entre UI (4) e configuração local do Auth (6).
- Definir estratégia de IDs, unicidade e constraints.
- Definir integridade de Publicações ao excluir Robôs.
- Definir identidade, ordem persistida e histórico das Regras.
- Decidir se Sistema, Pacote e Responsável continuarão texto.
- Decidir se versão deve seguir SemVer.
- Substituir estado/localStorage por repositórios persistentes somente na próxima etapa autorizada.

## Riscos identificados

- Publicações legadas não permitem recuperar timestamp exato.
- Dados em memória não são fonte migrável após recarga.
- IDs temporários não são seguros para concorrência.
- Relações indefinidas não podem ser convertidas em chaves estrangeiras sem decisão de produto.
- Criar RLS antes de definir isolamento por Cliente pode causar acesso excessivo ou bloqueios incorretos.

## Validação executada

- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado no Next.js 16.2.11.
- Rotas prerenderizadas: `/`, `/dashboard`, `/robos`, `/configuracoes`.
- Busca por referências antigas: nenhum import de types, mocks ou componentes removidos permaneceu em `src`.
- `tsconfig.tsbuildinfo` foi atualizado automaticamente pelo compilador durante essas verificações.

## Recomendações antes de criar o banco

1. Responder às decisões pendentes registradas em `docs/modelagem-banco.md`.
2. Definir o modelo de autenticação e isolamento por Cliente antes de escrever RLS.
3. Definir estratégia de IDs e timestamps.
4. Decidir delete/restrict/set-null para Publicações de Robôs excluídos.
5. Decidir normalização e ordenação das Regras.
6. Somente então desenhar tabelas, constraints, índices, policies e migrations.

## Conclusão

A aplicação está arquiteturalmente preparada para iniciar o desenho definitivo do banco, mas ainda não está pronta para executar migrations sem as decisões de domínio e segurança listadas acima.
