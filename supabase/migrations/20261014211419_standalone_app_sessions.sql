-- Server-managed sessions for the standalone PostgreSQL deployment.
-- Existing Auth identities and application rows are preserved.
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION auth.uid()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $body$
        SELECT COALESCE(
          NULLIF(current_setting('request.jwt.claim.sub', true), ''),
          NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
        )::uuid
      $body$
    $function$;
  END IF;

  IF to_regprocedure('auth.jwt()') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION auth.jwt()
      RETURNS jsonb
      LANGUAGE sql
      STABLE
      AS $body$
        SELECT COALESCE(
          NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
          '{}'::jsonb
        )
      $body$
    $function$;
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;

CREATE TABLE public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT app_sessions_expiration_after_creation
    CHECK (expires_at > created_at)
);

CREATE INDEX app_sessions_active_token_idx
  ON public.app_sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX app_sessions_user_active_idx
  ON public.app_sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_sessions FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.app_sessions FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.app_sessions FROM authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_sessions TO service_role';
  END IF;
END;
$$;

COMMENT ON TABLE public.app_sessions IS
  'Server-only session registry for the standalone Robot Center application.';
COMMENT ON COLUMN public.app_sessions.token_hash IS
  'SHA-256 hex digest of the random opaque session cookie; the raw token is never stored.';
