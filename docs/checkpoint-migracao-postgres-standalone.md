# Ponto de retomada: migração PostgreSQL standalone

Atualizado em 16/10/2026. Este checkpoint mantém o plano e registra o estado da preparação para infra interna.

## Plano definido pelo usuário

1. Subir PostgreSQL local.
2. Copiar banco de origem para PostgreSQL standalone.
3. Alterar Robot Center para usar PostgreSQL.
4. Rodar localmente.
5. Testar login.
6. Testar clientes.
7. Testar robôs.
8. Testar permissões.
9. Testar documentação.
10. Gerar Dockerfile.
11. Gerar docker-stack.yml.
12. Subir em homologação no servidor.
13. Só depois encerrar dependências de serviço Supabase, preservando o histórico de migrations.

## Estado confirmado nas etapas anteriores

- O destino local é robot_center_migrated, PostgreSQL 17.11 no container robot-center-standalone-postgres, em 127.0.0.1:5433. A origem local do Supabase CLI não foi alterada; nenhum projeto remoto, incluindo LumeProspect, foi acessado.
- A cópia contém dados operacionais e permissões. A última contagem informada foi 14 contas/perfis, 25 clientes, 62 robôs e 1 fluxo sem nodes, edges ou versões.
- Usuário Master local: marcos.vinicius@loylegal.com, login marcos.vinicius, papéis admin e master.
- Documentos, objetos de storage e linhas de sessão ficaram fora da cópia. Há referência legada a PDF sem arquivo; ela não foi apagada.
- O login local entrou na aplicação; o usuário confirmou depois do build que nome Master e menus Robôs/Fluxos aparecem. A consulta read-only confirmou grants do Master no PostgreSQL, e a Sidebar foi ajustada para reconhecer esse papel. Clientes, Robôs, Fluxos e autorização com papéis limitados ainda precisam de aceite funcional.
- Os logins corporativos ainda não foram provisionados. A infraestrutura deve usar credenciais distintas para runtime, administração e restore, sem configurar owner ou superuser na aplicação.
- Nenhuma migration aplicada foi alterada ou removida. A migration aditiva `20261016210503_standalone_password_recovery.sql` foi aplicada ao PostgreSQL standalone `robot_center_migrated` e registrada em `supabase_migrations.schema_migrations`. A tabela `public.app_password_reset_tokens` foi confirmada; RLS/grants foram validados e o fluxo local de recuperação foi testado com sucesso.

## Trabalho feito nesta etapa

- Os wrappers de runtime foram renomeados de src/lib/supabase para src/lib/database e os imports da aplicação foram atualizados. O runtime usa adapter PostgreSQL próprio.
- @supabase/ssr, @supabase/supabase-js e o CLI supabase foram removidos do manifest e lockfile; o histórico SQL supabase/migrations foi mantido.
- O bootstrap local de administrador foi substituído por operação PostgreSQL/bcrypt com checagem de host local.
- Corrigida a rota de logout para usar o helper compartilhado que remove cookies antigos. O papel Master agora reconhece os menus Robôs/Fluxos e produtos independentemente de uma resposta incompleta de permissões; a API/RLS continua protegendo os dados.
- Compose, Dockerfile, entrada do container, stack Swarm, exemplos de ambiente e workflow GitHub foram alinhados para PostgreSQL. O stack da empresa recebe banco externo e secrets, não contém build.
- A entrada de produção exige DATABASE_ADMIN_URL. O adapter também encerra inscrições e timers periódicos quando os componentes desmontam; ainda não recebe eventos reais do PostgreSQL.
- Recuperação local foi implementada com tokens próprios no PostgreSQL. A migration está aplicada e registrada; RLS/grants foram validados e o fluxo foi testado com redefinição e novo login. SMTP para envio em produção continua pendente.
- O usuário confirmou que `npm run build` passou e que nome Master e menus Robôs/Fluxos aparecem com `npm run dev`. Faltam os testes funcionais de módulos e papéis.

## Próximos passos

1. Testar Clientes, Robôs, Fluxos, tarefas/reuniões/notas e autorização com um papel limitado.
2. Obter do líder os dados de host PostgreSQL, domínio, registry, rede, secrets, estratégia de arquivos e política de backup.
3. Publicar o código no GitHub e validar o workflow/artefato imutável no registry.
4. Seguir `docs/postgresql-infraestrutura.md`: preparar database corporativo vazio, roles e logins; fazer dump sem sessões, tokens e dados documentais; restaurar e ensaiar o aceite.
5. Implantar a imagem no Swarm. Implementar e testar SMTP antes de habilitar recuperação por email em produção.

## Limites e decisões de infra

- A tela local gera e mostra link de redefinição sem SMTP. Em produção a emissão segue bloqueada até a integração SMTP ser implementada, configurada e testada.
- Os dados de documentos e os bytes dos arquivos não foram copiados; no dump corporativo devem ser excluídos também sessões locais e tokens de recuperação. PostgreSQL e volume de arquivos têm backups independentes.
- Swarm usa uma réplica e volume local preso ao nó robot-center-storage=true; isso não oferece failover.
- Git push será feito pelo usuário. Nenhuma publicação ou deploy foi realizada.
- Não excluir migrations, recriar volumes, alterar dados ou conectar projetos remotos durante a continuidade.
