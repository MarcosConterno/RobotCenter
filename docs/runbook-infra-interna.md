# Runbook de homologação na infraestrutura interna

O procedimento detalhado para criar o database, preparar papéis, gerar o dump sem dados documentais e restaurar em PostgreSQL está em [PostgreSQL na infraestrutura interna](postgresql-infraestrutura.md).

## Desenho do deploy

O CI constrói a imagem do Robot Center; o Portainer/Swarm apenas implanta a imagem publicada. O PostgreSQL é externo ao stack da aplicação. Não colocar serviço, URL, chave ou token Supabase no ambiente corporativo.

## Configuração no GitHub

O workflow .github/workflows/container.yml faz build em pull requests e publica no branch padrão e em tags v*.

Variáveis de repositório:

- NEXT_PUBLIC_SITE_URL: endereço HTTPS público da aplicação, incorporado durante o build.
- CONTAINER_REGISTRY: opcional; padrão ghcr.io.
- CONTAINER_IMAGE: opcional; padrão <owner>/<repo> dentro do registry.

Para GHCR, o workflow usa GITHUB_TOKEN. Para um registry interno, cadastrar os secrets CONTAINER_REGISTRY_USERNAME e CONTAINER_REGISTRY_PASSWORD, e configurar as duas variáveis de registry/imagem. O Swarm/Portainer também precisa de permissão para baixar a imagem privada. Usar tags sha-<commit> ou release para deploy e rollback; evitar depender apenas de latest.

## PostgreSQL corporativo

A infraestrutura cria/prepara PostgreSQL 17 e um database vazio. A revisão dos 74 arquivos SQL não encontrou CREATE EXTENSION; o schema usa gen_random_uuid(), disponível no PostgreSQL 13 ou superior. A aplicação não depende de GoTrue, Storage ou Realtime. As funções auth.uid(), auth.jwt() e storage.foldername() e os schemas auth/storage são objetos de compatibilidade PostgreSQL para preservar políticas e metadados existentes.

Antes do restore, o DBA deve provisionar no cluster os roles sem login anon, authenticated e service_role, pois roles são globais e não vêm no dump; confirme que os dois primeiros não têm BYPASSRLS. O role service_role precisa de BYPASSRLS para o fluxo administrativo atual, e o PostgreSQL exige superusuário para conceder esse atributo; o DBA deve executar essa preparação. Se a política da empresa não permitir esse role, a arquitetura de operações administrativas precisa ser revista antes do deploy. Eles são alvos das policies e grants. As migrations antigas referenciam esses roles e funções antes da migration recente de compatibilidade, portanto não se deve reaplicar a sequência histórica inteira desde o início em um database vazio. Para a carga inicial, restaurar um dump completo do PostgreSQL local já migrado em um database vazio, após conferir versão e contagens; manter o proprietário de restore/migration separado das contas runtime. Aplicar migrations futuras individualmente, em ordem, depois de revisão do DBA.

O dump contém dados pessoais e hashes de senha; transferir por canal aprovado, com controle de acesso e checksum. O conteúdo e os arquivos de documentos ficam fora da migração e serão cadastrados manualmente depois. A publication supabase_realtime que aparece no histórico é metadata inativa sem subscriber; a aplicação não a usa para eventos. A migration que a cria precisa de privilégio CREATE no database se ela ainda não existir.

Para alterações após a carga inicial, conferir o histórico `supabase_migrations.schema_migrations` no database de destino e aplicar cada migration nova, revisada e em ordem, com a ferramenta PostgreSQL aprovada pela empresa. A execução e o registro de `version`, `name` e `statements` devem fazer parte do mesmo procedimento de release. Não usar `--local`: essa opção pode apontar para outro database. O nome histórico da pasta `supabase/migrations` não exige serviço Supabase no servidor.

Credenciais distintas:

- **migração/restore:** proprietário temporário usado pelo DBA para restaurar schema/dados e aplicar mudanças futuras; nunca configurar na aplicação.
- **runtime (DATABASE_URL):** login sem superuser/BYPASSRLS, não proprietário das tabelas, com associação ao papel PostgreSQL authenticated.
- **operações privilegiadas (DATABASE_ADMIN_URL):** login server-side separado, sem superuser/BYPASSRLS, com associação ao papel service_role. Obrigatório no modo produção.

O app executa SET LOCAL ROLE authenticated para consultas do usuário e SET LOCAL ROLE service_role para operações administrativas como sessão/gestão de contas. service_role tem BYPASSRLS e grants amplos; DATABASE_ADMIN_URL é credencial de alta confiança, usada somente pelo backend como Docker Secret, nunca pelo browser. Confirmar grants, papel e autorização das rotas privilegiadas e testar RLS com esses logins antes de homologar. Não usar usuário proprietário ou superuser do database em nenhum dos dois secrets. O login de runtime e o login privilegiado devem ser distintos.

A carga existente foi trazida para o PostgreSQL local sem documentos/arquivos e sem sessões válidas. Conferir versão e contagens do dump antes de restaurar. Não usar opções de limpeza em uma base que possa conter dados. O restore deve ser ensaiado em um database vazio e validado antes de qualquer corte.

### Criar o database corporativo vazio

O DBA deve confirmar que o cluster aceita PostgreSQL 17 e executar a preparação abaixo antes do restore. Os nomes `rc_restore`, `rc_runtime`, `rc_admin` e `robot_center` são exemplos; a empresa pode substituí-los. Em cluster compartilhado, verificar se `anon`, `authenticated` e `service_role` já existem e criar somente os que estiverem ausentes.

No cluster, como DBA:

```sql
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE ROLE rc_restore LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE rc_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
CREATE ROLE rc_admin LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;

GRANT authenticated TO rc_runtime;
GRANT service_role TO rc_admin;
```

Definir as senhas de login no cofre corporativo ou por um mecanismo seguro do DBA; não gravá-las neste SQL, no GitHub ou no YAML. `service_role` precisa de `BYPASSRLS`, mas as contas `rc_runtime` e `rc_admin` não recebem esse atributo diretamente. Se a política da empresa proibir `BYPASSRLS` no papel de serviço, interromper aqui e revisar o desenho de autorização antes de importar o banco.

Em seguida, ainda como DBA, criar o database vazio:

```sql
CREATE DATABASE robot_center OWNER rc_restore;
GRANT CONNECT ON DATABASE robot_center TO authenticated, service_role;
```

Restaurar o dump validado nesse database vazio, conectando como `rc_restore` e usando `pg_restore --no-owner` para um arquivo em formato custom; para dump SQL texto, usar `psql` como `rc_restore`. Não usar `--clean` nem restaurar sobre um database com dados. A cópia local atual tem as tabelas de documentação/arquivos vazias; o schema pode ser restaurado, mas nenhum conteúdo ou arquivo de documento será levado. Se a origem mudar e essas tabelas tiverem conteúdo, excluir apenas os dados dessas tabelas no dump, preservando o schema. Validar contagens, foreign keys, grants, RLS e login com os dois usuários de runtime antes de liberar a aplicação.

Depois do restore, cadastrar as URLs de `rc_runtime` em `DATABASE_URL` e de `rc_admin` em `DATABASE_ADMIN_URL`, como Docker Secrets no Portainer. Não usar a URL de `rc_restore` no container. Cada usuário deverá entrar novamente; sessões locais não são importadas.

## Secrets do Portainer/Swarm

Criar os Docker Secrets cujos nomes padrão estão em .env.swarm.example:

- robot-center-database-url: URI PostgreSQL do login de runtime.
- robot-center-database-admin-url: URI PostgreSQL do login privilegiado server-side.

As URLs precisam ser completas e ter usuário/senha percent-encoded. Se o hostname do PostgreSQL for serviço de outro stack, conectar os serviços pela mesma overlay network; se for servidor externo, liberar DNS, rota, firewall e TLS conforme a política da empresa.

Não guardar segredos em .env.swarm.example, GitHub variables ou no YAML. Tokens opcionais Notion/ConvertAPI, se a empresa aprovar as integrações, devem ser provisionados como secrets e montados como arquivos usando as variáveis *_FILE aceitas pelo entrypoint. O fluxo local de recuperação existe; antes de produção, implementar e testar envio SMTP e guardar as credenciais como Docker Secrets.

## Swarm e Portainer

Antes de implantar:

1. Publicar uma imagem imutável no registry e permitir que o Swarm faça pull.
2. Criar o volume externo indicado por DOCUMENT_STORAGE_VOLUME_NAME e garantir que UID/GID 1001 consiga gravar nele.
3. Marcar com robot-center-storage=true somente o nó que contém esse volume local. O stack inicia uma réplica e usa atualização stop-first para evitar dois processos gravando simultaneamente.
4. Configurar no Portainer ROBOT_CENTER_IMAGE com caminho e tag da imagem, porta publicada e nomes dos secrets/volume.
5. Implantar o stack e verificar healthcheck, logs sem credenciais e conectividade com PostgreSQL.

No desenvolvimento com npm run dev, sem DOCUMENT_STORAGE_DIR, os arquivos ficam em ~/.robot-center/storage. Em produção, definir DOCUMENT_STORAGE_DIR para o volume montado. Esse volume local não tem failover entre nós. Para mover o serviço, copiar/restaurar arquivos e volume no nó de destino antes de alterar a constraint. Para alta disponibilidade, a infra precisa oferecer filesystem compartilhado e a arquitetura precisa ser validada com mais réplicas.

## Aceite de homologação

- Login do Master, nome e menus corretos.
- A API /api/admin/access retorna roles e permissões esperadas; confirmar no navegador a renderização do nome Master e dos menus Robôs/Fluxos após atualização do Next.
- Fluxos de Clientes, Robôs, Fluxos, permissões e documentação.
- Acesso negado a papéis/escopos não autorizados por RLS.
- Upload/download após reinício do container.
- Dump e restauração de banco e volume testados.
- Testar recuperação de senha; implementar e validar SMTP com credenciais em Docker Secrets antes de habilitar envio em produção, além de confirmar registry privado, TLS, backups, retenção e rollback.

## Sequência de teste antes da homologação

1. Confirmar que o app aponta para o PostgreSQL standalone local correto e conferir o histórico de migrations nesse mesmo banco. As migrations atuais até `20261016210503` já foram aplicadas e conferidas no ambiente local; migrations futuras devem ser revisadas e aplicadas no destino explícito, sem usar `--local` se isso apontar para outro container.
2. Rodar `npm run build`; corrigir todos os erros e revisar o aviso de tracing/NFT, se ainda aparecer.
3. Rodar `npm run dev`, entrar com Master e confirmar nome, papéis, `/api/admin/access` e menus Robôs/Fluxos.
4. Criar registros de teste identificados e conferir leitura, criação e edição de Clientes, Robôs e Fluxos após recarregar a página.
5. Testar permissões com uma conta de teste de papel limitado: menus e endpoints devem negar operações fora do escopo; validar RLS com as contas restritas, não com superuser.
6. Testar tarefas, reuniões e notas da Minha página e confirmar persistência após novo login.
7. Recuperação local testada: pedir link para uma conta de teste, redefinir a senha e entrar com a nova senha. A antiga sessão deve ser revogada. O link local não é enviado por email; SMTP continua pendente para produção.
8. Confirmar que as tabelas de documentação começam vazias; os documentos e arquivos serão cadastrados manualmente depois que o database corporativo estiver preparado. Verificar upload/download e persistência do volume apenas quando o módulo for configurado.
9. Em homologação, repetir o aceite com `rc_runtime` e `rc_admin`, validar backup e restauração do banco e do volume, HTTPS/TLS, healthcheck, logs sem credenciais, rollback e limites de rede.

Nenhum banco corporativo foi conectado/restaurado nesta etapa. Não foram alteradas migrations existentes nem arquivos de dados.
