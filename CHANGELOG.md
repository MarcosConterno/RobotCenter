# Changelog

## Não publicado

- Runtime do Robot Center migrado para adapter PostgreSQL próprio, sem SDK ou serviço Supabase no servidor.
- Login, sessões próprias e recuperação local de senha com tokens de uso único; envio de email em produção depende de SMTP.
- Dockerfile, stack Swarm, secrets e guia PostgreSQL para restore na infraestrutura interna.
- Migration aditiva de `app_password_reset_tokens`, aplicada e verificada no PostgreSQL standalone local.
