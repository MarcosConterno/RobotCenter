-- Keep account creation behavior when local users are stored in auth.users.
-- The imported users are unchanged; this trigger only applies to new inserts.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'auth.users precisa existir antes de instalar o gatilho de perfil';
  END IF;

  IF to_regprocedure('private.handle_new_auth_user()') IS NULL THEN
    RAISE EXCEPTION 'private.handle_new_auth_user() precisa existir antes de instalar o gatilho de perfil';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'on_auth_user_created'
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user()';
  END IF;
END;
$$;
