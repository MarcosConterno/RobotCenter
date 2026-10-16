# Auditoria para migração à infraestrutura interna

Atualizado em 16/10/2026. Esta revisão cobre código, configuração de container e documentação do Robot Center. As migrations `20261016180000`, `20261016183651`, `20261016183652` e `20261016210503` estão registradas no PostgreSQL standalone local. A recuperação de senha foi testada com sucesso nessa base, incluindo redefinição e login com a nova senha. Nenhum banco corporativo foi acessado ou alterado, e nenhum projeto Supabase remoto foi acessado.

## Escopo e evidência

O alvo é PostgreSQL standalone na infraestrutura da empresa. O banco revisado nas etapas anteriores é somente o PostgreSQL local robot_center_migrated; o projeto Supabase remoto LumeProspect e outros projetos não foram acessados. Documentos/objetos e sessões de desenvolvimento ficaram fora da cópia conforme o escopo previamente combinado.

A revisão de código e deploy é estática e precisa ser complementada pelos testes funcionais pendentes. O usuário confirmou que `npm run build` concluiu com sucesso. Migrations aplicadas não foram editadas ou removidas. A migration aditiva `20261016210503_standalone_password_recovery.sql` foi aplicada ao PostgreSQL local correto; tabela, histórico, RLS e grants foram confirmados.

## Resumo

- O runtime atual usa adapter próprio PostgreSQL com o pacote pg; consultas do browser passam por rotas locais. Não há necessidade de Auth, Data API, Storage, Realtime, URL ou token de projeto Supabase.
- @supabase/ssr, @supabase/supabase-js e o CLI supabase foram removidos do manifest e do lockfile. A pasta supabase/migrations permanece apenas como histórico SQL; o projeto não exige SDK ou CLI Supabase.
- O bootstrap administrativo foi substituído por script PostgreSQL local com bcrypt. Ele recusa host fora da lista local e não altera senha de conta existente.
- Dockerfile/Compose, stack Swarm, secrets, workflow de imagem e documentação foram alinhados para runtime PostgreSQL.
- O build local passou conforme retorno do usuário. O deploy ainda não está pronto para aceite: faltam validações funcionais de Clientes, Robôs, Fluxos e papéis restritos, além de registry/domínio/segredos/rede/backup da infraestrutura.

## 1. Runtime e autenticação

Os módulos importam @/lib/database, implementados sobre src/lib/postgres. A sessão usa cookie próprio robot_center_session, token aleatório e linha em public.app_sessions; o banco mantém apenas o hash SHA-256 do token. A senha é verificada por bcrypt contra auth.users.encrypted_password. Esses nomes de schema são compatibilidade PostgreSQL e não demonstram uso de um serviço Supabase.

A conexão normal usa DATABASE_URL e executa consultas como authenticated; operações server-side privilegiadas usam DATABASE_ADMIN_URL e service_role. Em produção o entrypoint exige as duas URLs. Nenhuma conta de conexão do app deve ser superuser ou dona das tabelas. O role service_role tem BYPASSRLS e grants amplos em tabelas/funções para os fluxos administrativos; não é superuser, mas é uma credencial de alta confiança. DATABASE_ADMIN_URL fica exclusivamente como Docker Secret server-side. As rotas que usam esse cliente fazem checagens de papel/permissão no servidor; a homologação ainda precisa confirmar os cenários autorizados e negados. O usuário de restore/migrations fica separado do processo web. Se a política corporativa não aceitar BYPASSRLS no backend, refatorar as operações administrativas antes do deploy.

A recuperação local por token próprio foi implementada: tokens são armazenados como hash, expiram, têm uso único e revogam sessões após a redefinição. A migration foi aplicada ao PostgreSQL standalone correto; RLS está ativo, `anon` e `authenticated` não têm acesso e `service_role` tem as permissões concedidas pela migration. O fluxo local foi testado com sucesso. O link aparece somente em desenvolvimento. A emissão em produção continua bloqueada até a integração SMTP ser implementada, configurada e testada.

## 2. Login, papéis e menus

A conta marcos.vinicius@loylegal.com foi confirmada no banco local com login marcos.vinicius e papéis admin e master. Após os últimos ajustes, o usuário confirmou que o nome Master e os menus Robôs e Fluxos aparecem na aplicação em execução.

A Sidebar usa robots.read e flows.read para outros papéis; para Master, os menus e produtos também são reconhecidos pelo próprio papel, sem alterar a API nem contornar RLS. A consulta local read-only confirmou 42 permissões, todas as permissões de produto, flows.read e robots.read para marcos.vinicius@loylegal.com; private.has_permission confirmou as duas permissões sob authenticated. O usuário confirmou a renderização do nome e dos menus após atualizar e executar a aplicação. O aceite funcional dos módulos e de papéis limitados continua pendente.

## 3. Pré-requisitos do PostgreSQL corporativo

A revisão estática dos 74 arquivos de migration encontrou referências aos roles anon, authenticated e service_role, funções de compatibilidade auth.uid()/auth.jwt()/storage.foldername() e uma publication inativa chamada supabase_realtime. Não há CREATE EXTENSION; gen_random_uuid() requer PostgreSQL 13+, e o alvo documentado é PostgreSQL 17. Para o restore inicial, o DBA precisa criar os roles no cluster antes de restaurar policies e grants; a criação de service_role com BYPASSRLS exige superusuário no PostgreSQL 17. A carga inicial deve usar um dump completo do PostgreSQL local atual em database vazio; reaplicar toda a sequência histórica desde a primeira migration não é um procedimento válido para PostgreSQL vanilla, porque os pré-requisitos de compatibilidade só aparecem nas migrations recentes. A publication não é consumida pelo runtime. O runbook registra a ordem e os requisitos.

## 4. Build e entrega Docker

- Dockerfile: Node 22 Alpine, build multi-stage Next standalone, usuário não-root, storage preparado e entrada que carrega secrets por arquivo.
- Compose local: PostgreSQL 17 e app sem variáveis/chaves Supabase; volume persistente. O database começa vazio e precisa receber dump/schema aprovado antes do teste funcional.
- Stack: não contém serviço PostgreSQL nem opção build; aponta para imagem CI publicada, banco externo, Docker Secrets e volume de documentos. Mantém uma réplica no nó marcado robot-center-storage=true.
- GitHub Actions: constrói em pull requests; publica no branch padrão e tags de release. Padrão GHCR, configurável para registry interno. O build de imagem falha na publicação se NEXT_PUBLIC_SITE_URL não estiver configurada.
- Uploads ficam em volume filesystem, que requer UID/GID 1001, backup e estratégia de nó. No npm run dev, sem DOCUMENT_STORAGE_DIR, o diretório fica em ~/.robot-center/storage; em produção o caminho precisa estar configurado no volume. Dump PostgreSQL não inclui bytes dos documentos.
- O usuário confirmou que o build de produção passou após os ajustes de documentação gerada e tracing de arquivos. O log completo não foi registrado neste checkpoint; conferir warnings na execução de CI antes de publicar a imagem.

## 5. Importação de dados e permissões

O checkpoint anterior registra 14 contas, roles e permissões importadas, 25 clientes e 62 robôs. Os logins corporativos ainda não foram provisionados; a validação de segurança precisa ser repetida depois que o DBA criar `rc_runtime` e `rc_admin`. Não usar owner ou superuser para validar RLS.

A cópia inicial excluiu conteúdo e objetos de documentação, documentos enviados e storage.objects; existe referência legada a PDF sem bytes copiados. Sessões app_sessions devem iniciar vazias na empresa e ser recriadas pelo login. O restore deve validar FKs, grants, RLS, contagem de linhas e estado de migrations.

## 6. Integrações e disponibilidade

- Notion: consulta de versão de pacote; depende de token e saída de rede.
- ConvertAPI: conversão DOCX/PDF; depende de token e saída de rede.
- SMTP: não integrado; recuperação local está implementada, mas o envio de email e a ativação da recuperação em produção continuam pendentes.
- Realtime: o adapter não recebe eventos do banco. No browser, canais legados funcionam como callback periódico de 30 segundos. Não assumir atualização instantânea entre usuários; validar Robôs, Fluxos e solicitações de stack.

## 7. Arquivos preparados

- Dockerfile, docker-entrypoint.sh, .dockerignore
- compose.yaml, compose.standalone.yaml, .env.docker.example, .env.standalone.example
- docker-stack.yml, .env.swarm.example
- docs/postgresql-infraestrutura.md (preparação do PostgreSQL corporativo, dump e restore)
- .github/workflows/container.yml
- scripts/bootstrap-local-admin.mjs, scripts/generate-system-documentation.mjs, package.json, package-lock.json
- src/app/documentacao/page.tsx e src/lib/postgres/storage.ts (tracing do build)
- Rotas de login/logout, adapter PostgreSQL, README, arquitetura, API de autenticação, auditoria e runbook

## 8. O que falta para homologar

**Concluído localmente:** migrations e RLS/grants conferidos; login e recuperação de senha testados; build passou; usuário Master e menus Robôs/Fluxos confirmados.

**Pendente para homologação:**

1. Testar Clientes, Robôs, Fluxos, tarefas/reuniões/notas e autorização com papéis distintos.
2. Publicar o código no GitHub e validar o workflow e a imagem imutável no registry.
3. Com o líder/DBA, definir host/porta PostgreSQL, domínio, registry, secrets, rede, backup e logins separados.
4. Preparar PostgreSQL 17 vazio, gerar e restaurar o dump sem sessões, tokens e dados documentais; ensaiar restore e rollback em homologação.
5. Cadastrar documentos/arquivos manualmente depois de preparar o ambiente corporativo.
6. Confirmar revogação das sessões antigas e implementar/configurar/testar SMTP antes de habilitar recuperação por email em produção. Aprovar Notion/ConvertAPI se forem usadas.

O usuário cuidará do push Git e confirmou que o build final passou. O agente não executou comandos locais; o usuário confirmou a migration, as permissões RLS e o teste funcional local. Nenhuma publicação ou implantação foi realizada.
