# Arquitetura do Robot Center

## Visão geral

O Robot Center é uma aplicação Next.js/React cuja persistência e autenticação de runtime são executadas diretamente em PostgreSQL. O container contém o servidor Next.js standalone e as dependências de runtime. Não existe chamada de runtime para serviços Supabase.

supabase/migrations é o caminho histórico das migrations e permanece intacto. Nenhum SDK ou CLI Supabase é dependência de runtime/build; futuras migrations devem ser aplicadas como SQL PostgreSQL pela ferramenta aprovada pela empresa.

## Componentes

| Camada | Implementação |
| --- | --- |
| Interface | Next.js App Router, React e providers de domínio. |
| Rotas protegidas | Middleware local valida robot_center_session usando PostgreSQL. |
| Sessão | public.app_sessions guarda SHA-256 do token aleatório; o cookie HTTP-only contém o token original. |
| Credenciais | Hash bcrypt em auth.users.encrypted_password; email/login são aceitos no login. |
| Consultas do browser | POST /api/database valida a sessão e executa o adapter PostgreSQL como authenticated. |
| Operações administrativas | Conexão separada DATABASE_ADMIN_URL, server-only, com SET LOCAL ROLE service_role. |
| Arquivos | Filesystem sob DOCUMENT_STORAGE_DIR, persistido em volume Docker. |
| Build/deploy | GitHub Actions publica imagem Next standalone; Portainer/Swarm executa a imagem publicada com PostgreSQL externo. |

Os schemas auth e storage, as funções auth.uid()/auth.jwt() e algumas interfaces compatíveis pertencem ao banco e ao código da aplicação. Eles não estabelecem dependência de um serviço Supabase. O adapter implementa chamadas locais e não encaminha pedidos a uma Data API externa.

## Autenticação e autorização

1. O login verifica bcrypt em auth.users, procurando email ou profiles.login.
2. Uma sessão aleatória é criada em public.app_sessions; o banco armazena somente seu hash SHA-256.
3. O cookie robot_center_session é HTTP-only, SameSite=Lax, expira após 12 horas e recebe Secure em produção.
4. O servidor lê a sessão em cada pedido. Consultas de usuário iniciam transação, executam SET LOCAL ROLE authenticated e definem request.jwt.claim.sub e request.jwt.claims.
5. RLS e as funções de autorização PostgreSQL limitam leitura e escrita ao usuário, papel e cliente.
6. Fluxos administrativos usam DATABASE_ADMIN_URL e service_role, somente no servidor.

Em produção, configure credenciais separadas em DATABASE_URL e DATABASE_ADMIN_URL. O usuário normal precisa poder assumir authenticated; a credencial administrativa precisa poder assumir service_role. Nenhum login do app pode ser superuser, dono das tabelas ou ter BYPASSRLS diretamente. O papel herdado `service_role` tem BYPASSRLS para operações administrativas e é de alta confiança. A conta de migração/restore pertence ao DBA e não deve ser usada pelo app.

A recuperação standalone usa tokens aleatórios de uso único: o PostgreSQL guarda somente o hash SHA-256, o token expira em 30 minutos e a troca de senha revoga as sessões ativas. Em desenvolvimento, a tela mostra o link local para permitir testes sem SMTP. Em produção, a emissão fica indisponível até a integração de envio SMTP ser implementada, configurada e testada; a aplicação não finge que enviou um email.

## Persistência e sincronização

O adapter expõe operações de tabelas e RPCs permitidas em src/lib/postgres/query-executor.ts. O nome das tabelas e operadores é validado antes da montagem das consultas; os valores são enviados como parâmetros. O cliente de browser não recebe URLs PostgreSQL ou credenciais.

O adapter mantém compatibilidade com os providers que esperam uma interface de canais de eventos. No modo atual, essa compatibilidade funciona como atualização periódica, não como publicação real de eventos PostgreSQL. Mudanças feitas por outro cliente podem demorar até 30 segundos para aparecer; os módulos Robôs, Fluxos e solicitações de stack devem ser validados com essa limitação. A limpeza das inscrições remove os timers quando os componentes desmontam.

Os arquivos são gravados no filesystem. O volume deve ser gravável pelo UID/GID 1001 do container, ter backup próprio e ser preservado durante atualizações. O dump de banco não inclui documentos ou objetos; a cópia local acordada também excluiu esses dados.

## Docker e Swarm

- A imagem usa build multi-stage do Next.js com saída standalone e usuário não-root.
- NEXT_PUBLIC_SITE_URL é argumento de build porque o Next incorpora variáveis públicas no bundle.
- docker-stack.yml não constrói a imagem e não executa PostgreSQL. O CI publica uma tag; o Portainer implanta essa tag contra o PostgreSQL externo.
- O stack usa Docker Secrets para duas URLs de conexão, um volume persistente e uma réplica fixada ao nó com robot-center-storage=true.
- A porta 3000 é ajustável por variável. Proxy, TLS e DNS ficam na infraestrutura.
- O volume local do Swarm não replica arquivos entre nós. Para alta disponibilidade, substituir por storage compartilhado e revisar a política de scheduling.
- ConvertAPI e Notion são integrações externas opcionais e dependem de secrets e saída de rede.

## Diretórios importantes

- src/app: páginas e endpoints.
- src/auth: autorização compartilhada no cliente.
- src/data: providers dos módulos e operações de dados.
- src/lib/database: entradas de adapter server/browser e compatibilidade de cliente.
- src/lib/postgres: sessão, pools, consultas, autenticação local e storage.
- supabase/migrations: histórico rastreável do schema PostgreSQL; não editar versões aplicadas.
- docs: regras de domínio, permissões, APIs, auditoria e runbook infra.
- docs/postgresql-infraestrutura.md: preparação, dump/restore, credenciais e operação do PostgreSQL corporativo.

## Verificações antes de produção

- Build em CI e build local concluídos sem erros.
- Restore do dump de homologação testado e versão PostgreSQL compatível confirmada.
- Login Master e recuperação local testados. Confirmar a renderização dos menus Robôs/Fluxos após o build e a atualização da aplicação.
- Isolamento RLS conferido com os papéis de runtime reais, sem superuser/BYPASSRLS.
- Clientes, Robôs, Fluxos, permissões, documentos e uploads testados.
- Integração SMTP implementada, configurada e testada para habilitar recuperação por email em produção.
- Volumes, backup de banco/arquivos, rollback e permissão de pull do registry confirmados.

O procedimento do DBA e o formato do dump inicial estão em `docs/postgresql-infraestrutura.md`.
