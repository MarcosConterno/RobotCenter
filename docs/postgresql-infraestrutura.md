# PostgreSQL na infraestrutura interna

Atualizado em 16/10/2026. Este guia descreve como preparar e operar o banco do Robot Center na infraestrutura da empresa. O banco corporativo será PostgreSQL standalone; não será usado Supabase Auth, Data API, Storage, Realtime, URL ou token de projeto.

## Arquitetura e estado atual

- O serviço Next.js conecta diretamente ao PostgreSQL. O database fica fora do stack Swarm da aplicação.
- O destino recomendado é PostgreSQL 17, compatível com o PostgreSQL 17.11 usado no banco local. O schema não requer extensão adicional; `gen_random_uuid()` está disponível em PostgreSQL 13 ou superior.
- O banco local de origem confirmado é `robot_center_migrated`, no container `robot-center-standalone-postgres`, exposto localmente em `127.0.0.1:5433`.
- Os schemas `auth` e `storage`, funções como `auth.uid()` e papéis como `authenticated` são objetos PostgreSQL de compatibilidade com as policies e os dados existentes. Eles não chamam serviços Supabase.
- `supabase/migrations` e `supabase_migrations.schema_migrations` permanecem como histórico de migrations PostgreSQL. Não é necessário instalar SDK Supabase, CLI ou serviços Supabase no servidor de aplicação.
- As migrations locais até `20261016210503`, inclusive a tabela de recuperação de senha, estão aplicadas e registradas no banco standalone. O fluxo local de recuperação passou pelo teste funcional.

## Dados que vão para o servidor

O dump de inicialização deve manter usuários e hashes bcrypt, perfis, papéis e permissões, clientes, robôs, fluxos e os demais dados operacionais existentes. Antes do dump, conferir novamente contagens no banco de origem e registrar os resultados junto ao artefato.

O schema das tabelas permanece no destino, mas os dados abaixo não devem ser transferidos:

- sessões locais em `public.app_sessions`;
- tokens de recuperação em `public.app_password_reset_tokens`;
- conteúdo de `public.robot_center_documentations`, `public.robot_center_documentation_sections`, `public.robot_center_documentation_blocks`, `public.robot_center_documentation_drafts`, `public.robot_center_documentation_templates` e `public.robot_center_documentation_versions`;
- metadados de anexos em `public.robot_uploaded_documents`;
- dados de `storage.buckets` e `storage.objects`.

Os documentos e arquivos serão cadastrados manualmente depois que o database corporativo estiver preparado. Excluir dados do dump mantém as tabelas e constraints; não apaga nem modifica o banco local de origem. Sessões e tokens de teste não devem ser restaurados no servidor.

Os bytes de arquivos não ficam no PostgreSQL. O adapter local grava em diretórios sob `DOCUMENT_STORAGE_DIR`, separados pelas áreas lógicas `robot-manuals`, `robot-documentation` e `robot-documentation-templates`. Esses nomes não representam buckets nem serviço Supabase: as rotas autenticadas da aplicação fazem a autorização e acessam o filesystem. Como nenhum arquivo será migrado, o volume corporativo começa vazio e os documentos serão cadastrados manualmente depois. Os campos legados `robos.manual_path` e `robos.manual_nome` podem ser preservados no dump sem que os arquivos correspondentes existam; conferir esses registros ao fazer o cadastro manual.

## Papéis PostgreSQL e credenciais

Os nomes abaixo são exemplos. Como os papéis são globais ao cluster, o DBA deve verificar se já existem e criar somente os ausentes.

| Papel | Uso | Acesso esperado |
| --- | --- | --- |
| `anon` | Compatibilidade de policies | `NOLOGIN`, sem `BYPASSRLS`. |
| `authenticated` | Consultas autorizadas de usuário | `NOLOGIN`, sem `BYPASSRLS`. |
| `service_role` | Operações privilegiadas do backend | `NOLOGIN`, com `BYPASSRLS`; credencial de alta confiança, nunca usada diretamente como login. |
| `rc_restore` | Restore inicial e alterações de schema aprovadas | Login temporário do DBA; proprietário dos objetos restaurados; nunca configurado na aplicação. |
| `rc_runtime` | Conexão normal do servidor | Login sem superuser, membro de `authenticated`, sem propriedade das tabelas. |
| `rc_admin` | Operações privilegiadas server-side | Login sem superuser, membro de `service_role`, sem propriedade das tabelas. |

Como DBA, em um cluster autorizado, criar apenas os papéis compartilhados que estiverem ausentes e provisionar os logins separados:

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

Definir senhas aleatórias no cofre corporativo ou pelo mecanismo seguro do DBA. Não colocar senhas neste arquivo, no GitHub, no YAML ou em mensagens. `service_role` precisa de `BYPASSRLS` para a arquitetura administrativa atual; o PostgreSQL exige privilégio de superusuário para atribuir esse atributo. `rc_admin` não deve ser superuser nem receber `BYPASSRLS` diretamente, mas pode assumir `service_role` nas operações autorizadas pelo backend. Se a política da empresa não aceitar essa capacidade, rever a arquitetura administrativa antes do deploy.

Criar um database vazio, por exemplo:

```sql
CREATE DATABASE robot_center OWNER rc_restore;
GRANT CONNECT ON DATABASE robot_center TO authenticated, service_role;
```

Não restaurar sobre um database que já contenha dados. Se o nome do database ou dos logins for diferente, atualizar as URLs e os nomes dos secrets de forma consistente.

## Dump e restore inicial

O bootstrap corporativo é um dump completo do PostgreSQL standalone atual, restaurado uma vez em um database vazio. Não reaplicar nele, em sequência, todas as migrations históricas: parte dos pré-requisitos de compatibilidade só aparece em migrations posteriores. O dump inclui o schema, os dados selecionados e o histórico de versões; a tabela `supabase_migrations.schema_migrations` deve ser preservada.

Em uma estação aprovada com clientes PostgreSQL, usar URLs fornecidas pelo DBA/cofre e executar o dump em formato custom. O exemplo exclui os dados de sessões, tokens, documentos e arquivos, mantendo a estrutura das tabelas:

```bash
pg_dump --format=custom --file=robot-center.dump \
  --exclude-table-data='public.app_sessions' \
  --exclude-table-data='public.app_password_reset_tokens' \
  --exclude-table-data='public.robot_center_documentations' \
  --exclude-table-data='public.robot_center_documentation_*' \
  --exclude-table-data='public.robot_uploaded_documents' \
  --exclude-table-data='storage.buckets' \
  --exclude-table-data='storage.objects' \
  --dbname="$SOURCE_DATABASE_URL"
```

Verificar o checksum do artefato e transferi-lo por canal corporativo aprovado. O dump contém dados pessoais e hashes de senha; restringir acesso e retenção.

Com o database vazio, restaurar sem reaplicar ownership do ambiente de origem e sem limpar objetos:

```bash
pg_restore --exit-on-error --no-owner \
  --dbname="$TARGET_DATABASE_URL" \
  robot-center.dump
```

Não usar `--clean`. Manter os privilégios do dump e garantir que os papéis referenciados já existam. O login `rc_restore` pode ser o owner dos objetos restaurados; ele nunca deve ser usado pelo processo web. Em caso de erro, parar e revisar o resultado antes de tentar novamente; não restaurar sobre a mesma base parcialmente preenchida sem um plano de recuperação aprovado.

## Configuração do aplicativo

O Swarm/Portainer conecta o serviço aos seguintes secrets, montados no container:

| Secret padrão | Variável de arquivo | Papel da URL |
| --- | --- | --- |
| `robot-center-database-url` | `DATABASE_URL_FILE=/run/secrets/database_url` | Usuário `rc_runtime`, associado a `authenticated`. |
| `robot-center-database-admin-url` | `DATABASE_ADMIN_URL_FILE=/run/secrets/database_admin_url` | Usuário `rc_admin`, associado a `service_role`. |

As duas URLs devem ser diferentes, usar TLS conforme política da empresa, e ter usuário/senha codificados para URL. `DATABASE_ADMIN_URL` é exclusivamente server-side e de alta confiança. Nunca configurar a URL de `rc_restore`, superuser, token Supabase ou credencial de banco em variável `NEXT_PUBLIC_*`.

O app exige as duas conexões em produção. O entrypoint lê os secrets por arquivo. A porta de saída do PostgreSQL, DNS, firewall, rota e certificado TLS devem permitir conexão do serviço Swarm ao host do banco.

## Migrations depois do restore

Após o restore inicial, toda alteração futura deve ser uma nova migration SQL revisada, em ordem crescente, sem editar ou excluir uma versão já aplicada. Aplicar cada migration no database explícito de homologação/produção por uma ferramenta PostgreSQL aprovada pela empresa, em transação quando possível, e registrar `version`, `name` e `statements` em `supabase_migrations.schema_migrations` na mesma operação.

Não usar `supabase migration up --local` para o banco corporativo: `--local` pode apontar para outro container. A pasta e o histórico chamados `supabase` são convenção e compatibilidade do projeto; eles não significam que o backend ou o runtime dependam de um serviço Supabase.

## Verificações antes de liberar

1. Confirmar `current_database()`, `current_user` e a versão do PostgreSQL após o restore.
2. Comparar contagens das tabelas de negócio e verificar integridade das foreign keys.
3. Confirmar que `app_sessions`, `app_password_reset_tokens`, tabelas de conteúdo documental, `robot_uploaded_documents` e `storage.objects` não receberam dados do dump.
4. Conferir os papéis: `rc_runtime` não é superuser, dono das tabelas nem membro de `service_role`; `rc_admin` é distinto e só assume `service_role` pelo backend.
5. Testar login, autorização, menus e as operações de Clientes, Robôs e Fluxos com os dois logins restritos. Não validar RLS usando superuser ou owner.
6. Testar dump e restore em homologação antes de liberar acesso. Planejar backup do database e do volume de arquivos separadamente.
7. Verificar logs, healthcheck, TLS, retenção, política de rollback e acesso ao registry.
8. Implementar, configurar e testar SMTP antes de habilitar recuperação por email em produção. Hoje esse endpoint retorna `503` em produção.

Os documentos e uploads não fazem parte do dump combinado. Depois de cadastrar documentos na infraestrutura, manter backup do volume `DOCUMENT_STORAGE_DIR` junto ao processo operacional do banco, mas como artefatos separados.
