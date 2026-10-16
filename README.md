# Robot Center

Workspace corporativo para gestão de robôs, fluxos, clientes, permissões, documentação e atividades pessoais.

## Módulos

- **Robôs:** catálogo operacional, regras, alterações, pacotes, filas e solicitações de stack.
- **Fluxos:** desenho e versionamento de automações.
- **Dashboard:** indicadores e publicações operacionais.
- **Clientes e permissões:** administração de cadastros e papéis.
- **Documentação Robot Center:** conteúdo versionado e documentos enviados.
- **Orçamentos:** estimativas estruturadas de projetos.
- **Minha página:** tarefas, reuniões e notas pessoais.

## Arquitetura atual

A aplicação usa Next.js e React. O runtime conversa com PostgreSQL por meio do pacote pg; o navegador chama rotas locais do Next.js. A autenticação usa hashes bcrypt preservados em auth.users e sessões próprias em public.app_sessions, com cookie HTTP-only. Consultas de usuário são executadas na transação PostgreSQL como authenticated, com claims para as policies RLS. Operações administrativas são server-side e usam service_role.

O runtime não usa Supabase Auth, Data API, Storage ou Realtime, nem exige URL ou token de projeto. A pasta supabase/migrations permanece como histórico SQL. Nenhum SDK ou CLI Supabase é dependência do projeto ou necessário no servidor.

Os arquivos enviados ficam em filesystem, sob DOCUMENT_STORAGE_DIR (padrão local: ~/.robot-center/storage). Em produção a variável precisa apontar para um volume persistente gravável pelo usuário do container. O dump não leva bytes nem registros das tabelas documentais/anexos; campos legados como robos.manual_path podem continuar apontando para arquivos ausentes. Os documentos serão cadastrados manualmente na infraestrutura.

## Configuração local

Para executar diretamente com PostgreSQL local, configure DATABASE_URL; DATABASE_ADMIN_URL pode ser omitida durante desenvolvimento e então usa a mesma conexão. Para um ambiente Docker de teste, compose.yaml cria um PostgreSQL vazio e a aplicação. Esse banco precisa receber o dump/schema aprovado antes do teste funcional; o compose não apaga nem migra dados automaticamente.

| Variável | Uso |
| --- | --- |
| DATABASE_URL | Conexão do runtime para consultas como authenticated. |
| DATABASE_ADMIN_URL | Conexão server-side para sessões e operações privilegiadas; obrigatória em produção. |
| DATABASE_POOL_MAX | Tamanho máximo por pool PostgreSQL. Há pools separados para runtime autenticado e operações privilegiadas. |
| DOCUMENT_STORAGE_DIR | Raiz dos arquivos persistentes. |
| NEXT_PUBLIC_SITE_URL | URL pública incorporada no build para metadados e callbacks. |
| CONVERTAPI_TOKEN | Conversão externa DOCX/PDF, opcional. |
| NOTION_TOKEN, NOTION_DATABASE_ID, NOTION_DATA_SOURCE_ID | Consulta da versão de pacotes pelo Notion, opcional. |

A recuperação local de senha foi testada sem SMTP: em desenvolvimento, a tela mostra um link de uso único, válido por 30 minutos, para uma conta cadastrada. O banco guarda somente o hash do token; a redefinição revoga as sessões ativas. Em produção a emissão por email segue desabilitada até implementar, configurar e testar a integração SMTP.

## Docker, CI e Swarm

- Dockerfile: imagem multi-stage Next.js standalone, Node 22, usuário não-root e diretório de arquivos preparado.
- compose.yaml: ambiente Docker local com PostgreSQL e app; os volumes são persistentes.
- docker-stack.yml: somente a aplicação. A base corporativa é externa, e o stack recebe as URLs PostgreSQL por Docker Secrets.
- .github/workflows/container.yml: build da imagem em pull requests e publicação no branch padrão/tags. Por padrão usa GHCR; variáveis do repositório permitem trocar o registry e o nome da imagem.
- .env.swarm.example: nomes das variáveis não secretas esperadas pelo Portainer.

O stack não usa a opção build: o GitHub Actions cria e publica a imagem; o Portainer/Swarm implanta uma tag imutável. A URL pública NEXT_PUBLIC_SITE_URL precisa estar configurada nas variáveis do GitHub antes de publicar. A implantação usa uma réplica e fixa arquivos persistentes a um nó marcado com robot-center-storage=true; para alta disponibilidade, a infra deve fornecer storage compartilhado e ajustar o stack.

## Migração e operação

A migração acordada trouxe dados operacionais para PostgreSQL standalone e deixou documentos/arquivos fora da cópia. No dump corporativo também devem ficar de fora sessões e tokens de recuperação de desenvolvimento; as tabelas permanecem no schema. Antes de homologação, a infra precisa preparar um banco PostgreSQL compatível, papéis restritos para runtime e administração, restaurar o dump pelo canal aprovado e configurar backup/restore do banco e do volume de arquivos.

A tabela `public.app_sessions` e `public.app_password_reset_tokens` devem iniciar sem dados importados. Login Master, recuperação local de senha, build final, nome do usuário e menus Robôs/Fluxos foram confirmados no PostgreSQL standalone. Ainda faltam os testes funcionais de Clientes, Robôs, Fluxos e autorização com papéis restritos.

Para preparar o database corporativo, siga [o guia PostgreSQL para infraestrutura](docs/postgresql-infraestrutura.md) e o [runbook de homologação](docs/runbook-infra-interna.md). O estado atual e próximos passos estão em [checkpoint da migração](docs/checkpoint-migracao-postgres-standalone.md); a arquitetura está em ARCHITECTURE.md.
