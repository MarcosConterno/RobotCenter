-- Permite que o backend PostgreSQL valide credenciais locais sem expor
-- os demais campos de autenticação ao papel da aplicação.
GRANT SELECT (id, email, encrypted_password, email_confirmed_at)
ON TABLE auth.users
TO service_role;
