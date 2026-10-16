# Autenticação com PostgreSQL standalone

A aplicação valida as credenciais contra auth.users.encrypted_password e mantém sessões próprias em public.app_sessions. O banco armazena SHA-256 do token aleatório; o cookie robot_center_session é HTTP-only, SameSite=Lax e Secure em produção.

## Rotas

| Método e rota | Uso |
| --- | --- |
| GET /api/auth/session | Lê a sessão atual. |
| POST /api/auth/session/login | Valida email/login e senha e cria uma sessão. Corpo JSON: email e password. |
| POST /api/auth/session/logout | Revoga a sessão atual e remove o cookie. |
| POST /api/auth/session/password | Atualiza a senha da sessão autenticada. Corpo JSON: password. |
| POST /api/auth/session/recover | Solicita recuperação pelo email cadastrado. Em desenvolvimento retorna link local somente quando a conta existe; em produção retorna 503 até a integração SMTP ser implementada, configurada e testada. |
| POST /api/auth/session/recover/complete | Recebe token, password e passwordConfirmation; consome o token uma vez, atualiza bcrypt e revoga sessões ativas. |
| POST /api/database | Executa consultas autorizadas pelo adapter PostgreSQL como authenticated, com claims para as policies existentes. |

As rotas não expõem credenciais de banco ao navegador. Todas as consultas do browser passam pelo servidor e usam a sessão local.

## Autorização e conexões

O middleware valida a sessão no PostgreSQL. Cada consulta de usuário inicia uma transação, executa SET LOCAL ROLE authenticated e define request.jwt.claim.sub e request.jwt.claims. RLS e as funções de domínio restringem os registros.

Operações administrativas usam uma segunda conexão server-side (DATABASE_ADMIN_URL) e SET LOCAL ROLE service_role. Em produção as duas URLs são obrigatórias e devem usar logins PostgreSQL distintos, sem superuser, propriedade das tabelas ou BYPASSRLS. O login de runtime precisa poder assumir authenticated; o privilegiado precisa poder assumir service_role. A conta que restaura ou aplica schema não é configurada no app.

## Schema local de compatibilidade

O modo standalone preserva auth.users, auth.identities, auth.uid() e auth.jwt() para manter contas e policies. Não executa GoTrue nem usa Data API. As migrations existentes continuam no repositório, em supabase/migrations, como histórico PostgreSQL.

A cópia não inclui documentos/bytes nem sessões válidas. Arquivos ficam em DOCUMENT_STORAGE_DIR; storage.objects está vazio. Cada usuário deve entrar novamente na base restaurada.

## Recuperação de senha

No modo local, `/recuperar-senha` cria token aleatório com validade de 30 minutos, guarda somente SHA-256 em `public.app_password_reset_tokens` e mostra o link local na tela. `/redefinir-senha` envia o token e a nova senha para a rota de conclusão. Tokens expirados, usados ou substituídos são rejeitados; a redefinição invalida todos os tokens pendentes e revoga as sessões ativas. O endpoint não confirma se a conta existe pela mensagem. Em produção a emissão permanece desabilitada até a integração SMTP ser implementada, configurada e testada; nenhum email é anunciado como enviado.
