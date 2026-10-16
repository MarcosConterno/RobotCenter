# Retomada da migração para PostgreSQL standalone — 15/10/2026

> Checkpoint substituído em 16/10/2026. Os detalhes abaixo registram o estado antigo de 15/10 e não descrevem a situação atual. Consulte `checkpoint-migracao-postgres-standalone.md`, `auditoria-preparacao-infra-interna.md` e `postgresql-infraestrutura.md` para o estado e procedimento vigentes. Este arquivo permanece como registro histórico.

## Objetivo

Concluir a saída da dependência de Supabase no servidor da empresa, usando PostgreSQL standalone, mantendo os dados e deixando o Robot Center utilizável. A importação exclui documentos/arquivos, conforme alinhado. Preservar todas as migrations, dados e mudanças locais; não apagar nem resetar nada.

## Estado confirmado

- O usuário conseguiu autenticar na aplicação local após aplicar as migrations pendentes, incluindo `20261015100000_grant_auth_user_fields_to_service_role.sql`.
- A consulta local de `marcos.vinicius@loylegal.com` retornou o perfil `marcos.vinicius` e os papéis `admin` e `master`. Os vínculos de papel existem; não corrigir isso atribuindo papéis por email.
- Depois do login, a interface mostrou somente Minha página e Dashboard, sem o nome do usuário e sem vários menus. Isso sugere falha ou resposta incompleta em `/api/admin/access`, mas a causa ainda não foi confirmada.
- `AdminAccessProvider` busca `/api/admin/access`; se a resposta não for OK, limpa nome, papéis e permissões. `Sidebar` depende dessas permissões para exibir os menus e o `Topbar` depende do nome para preencher a identificação.
- A aplicação em `.env.local` estava apontando `DATABASE_URL` para `127.0.0.1:54322`, o PostgreSQL gerenciado pelo Supabase CLI. Isso não prova que o banco standalone na porta 5433 esteja em uso.
- O serviço Docker não estava disponível na última tentativa. O endpoint local `127.0.0.1:54322` também recusou conexão. Não foi possível continuar consultas ou reproduzir o problema com o banco desligado.
- A cópia dos dados de `supabase_db_robot-center` para o PostgreSQL standalone ainda não foi confirmada como concluída. Não considerar a migração de dados terminada.
- O projeto tem alterações locais extensas e migrations existentes modificadas/adicionadas. Preservar integralmente o worktree; não usar reset/clean nem editar migrations já aplicadas.

## Plano canônico da migração (definido pelo usuário em 16/10/2026)

1. **Subir PostgreSQL local — pendente.** `compose.standalone.yaml` existe, mas `.env.standalone` não existe e o daemon do Docker Desktop está desligado/inacessível.
2. **Copiar banco Supabase → PostgreSQL — pendente.** Os dados foram importados para o Postgres local do Supabase CLI (porta 54322), mas não há confirmação de cópia para o destino standalone (porta 5433). Documentos/arquivos ficam fora do escopo. Fazer backup e comparar contagens; nunca resetar ou limpar o destino.
3. **Alterar Robot Center para usar PostgreSQL — em andamento.** Existe adaptador PostgreSQL, e `createClient()` usa esse adaptador. Porém `.env.local` aponta `DATABASE_URL` para `127.0.0.1:54322`, não para o destino standalone. Manter compatibilidade Supabase até a etapa 13.
4. **Rodar localmente — parcial.** `npm run dev` já foi usado em `localhost:3000`, ainda ligado ao banco local do Supabase CLI.
5. **Testar login — parcial.** O login passou, mas a tela não mostrou nome e menus; a causa no fluxo `/api/admin/access` continua por verificar no banco standalone.
6. **Testar clientes — pendente.**
7. **Testar robôs — pendente.**
8. **Testar permissões — pendente.**
9. **Testar documentação — pendente.**
10. **Gerar Dockerfile — existe uma versão inicial.** Revisar permissões da pasta de documentos e retirar configuração Supabase do build standalone, sem remover as integrações Supabase do restante do projeto ainda.
11. **Gerar `docker-stack.yml` — pendente de consolidar.** Existe `compose.standalone.yaml`, ainda não validado. Hoje o app recebe o mesmo usuário/senha do superuser do Postgres em `DATABASE_URL` e `DATABASE_ADMIN_URL`; separar usuário de aplicação e de migração antes da homologação.
12. **Subir em homologação no servidor — pendente.**
13. **Só depois remover dependência do Supabase — pendente por desenho.** Não remover pacotes, compatibilidade nem migrations antes da homologação aprovada.

### Estado operacional desta retomada

- O shell de execução está em WSL; o comando `docker` do WSL não está instalado. O Docker Desktop foi consultado pelo executável do Windows, mas a API do daemon não estava disponível.
- A tentativa de consultar `compose.standalone.yaml` falhou porque `.env.standalone` ainda não existe e `POSTGRES_PASSWORD` é obrigatório. Nenhum container ou volume foi alterado.
- A tentativa inicial de ler a skill Supabase usou o caminho errado; ela foi localizada e lida em `.../skills/supabase/SKILL.md`.
- O usuário autorizou leitura/edição do projeto e estabeleceu que ele próprio executará apenas `npm run build` e `npm run dev`; não pedir que ele rode `cat`, `grep` ou outras leituras rotineiras.

## Arquivos e áreas para revisar

- `src/auth/AdminAccessProvider.tsx`
- `src/app/api/admin/access/route.ts`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Topbar.tsx`
- `src/lib/postgres/` (cliente, executor de consultas e relações)
- `compose.standalone.yaml`, `Dockerfile` e `.env.standalone.example`
- migrations standalone recentes e documentação do banco/permissões

## Restrições do projeto

- Não apagar dados, tabelas, colunas ou migrations.
- Alterações de banco devem usar uma migration nova e atualizar a documentação exigida pelo `AGENTS.md`.
- Esta autorização mais recente do usuário permite ao agente ler e editar arquivos do projeto; o usuário fica responsável por executar `npm run build` e `npm run dev`.
- Não colocar credenciais Supabase no servidor da empresa.
