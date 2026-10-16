-- Compatibility objects needed to replay the existing Robot Center migrations
-- and preserve local auth identities on standalone PostgreSQL. This is not a
-- GoTrue deployment: the application validates passwords and manages sessions
-- in its own server-side code.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

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

-- The original shared audit trigger is attached to both soft-delete and
-- non-soft-delete tables. Access optional deleted_at/deleted_by fields through
-- the trigger row's JSON representation so updates to permissions/catalogs
-- without those columns remain valid.
CREATE OR REPLACE FUNCTION private.set_row_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());

    IF current_user_id IS NOT NULL THEN
      NEW.created_by := current_user_id;
    ELSIF NEW.created_by IS NULL THEN
      NEW.created_by := current_user_id;
    END IF;

    NEW.updated_at := COALESCE(NEW.updated_at, NEW.created_at);

    IF NEW.updated_by IS NULL THEN
      NEW.updated_by := NEW.created_by;
    END IF;

    RETURN NEW;
  END IF;

  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.updated_at := now();

  IF current_user_id IS NOT NULL THEN
    NEW.updated_by := current_user_id;
  END IF;

  IF (to_jsonb(NEW) ->> 'deleted_at') IS NOT NULL
     AND (to_jsonb(OLD) ->> 'deleted_at') IS NULL
     AND (to_jsonb(NEW) ->> 'deleted_by') IS NULL THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('deleted_by', current_user_id));
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION private.set_row_audit_fields() IS
  'Preenche auditoria comum e trata deleted_at/deleted_by apenas em tabelas que possuem esses campos.';

CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id uuid PRIMARY KEY,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text,
  phone_confirmed_at timestamptz,
  phone_change text DEFAULT ''::varchar,
  phone_change_token varchar(255) DEFAULT ''::varchar,
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz,
  email_change_token_current varchar(255) DEFAULT ''::varchar,
  email_change_confirm_status smallint DEFAULT 0,
  banned_until timestamptz,
  reauthentication_token varchar(255) DEFAULT ''::varchar,
  reauthentication_sent_at timestamptz,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  is_anonymous boolean NOT NULL DEFAULT false,
  CONSTRAINT users_email_change_confirm_status_check
    CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2),
  CONSTRAINT users_phone_key UNIQUE (phone)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_partial_key
  ON auth.users (email)
  WHERE is_sso_user = false;

CREATE INDEX IF NOT EXISTS users_instance_id_email_idx
  ON auth.users (instance_id, lower(email));

CREATE INDEX IF NOT EXISTS users_instance_id_idx
  ON auth.users (instance_id);

CREATE INDEX IF NOT EXISTS users_is_anonymous_idx
  ON auth.users (is_anonymous);

CREATE UNIQUE INDEX IF NOT EXISTS confirmation_token_idx
  ON auth.users (confirmation_token)
  WHERE confirmation_token !~ '^[0-9 ]*$';

CREATE UNIQUE INDEX IF NOT EXISTS recovery_token_idx
  ON auth.users (recovery_token)
  WHERE recovery_token !~ '^[0-9 ]*$';

CREATE UNIQUE INDEX IF NOT EXISTS email_change_token_new_idx
  ON auth.users (email_change_token_new)
  WHERE email_change_token_new !~ '^[0-9 ]*$';

CREATE UNIQUE INDEX IF NOT EXISTS email_change_token_current_idx
  ON auth.users (email_change_token_current)
  WHERE email_change_token_current !~ '^[0-9 ]*$';

CREATE UNIQUE INDEX IF NOT EXISTS reauthentication_token_idx
  ON auth.users (reauthentication_token)
  WHERE reauthentication_token !~ '^[0-9 ]*$';

CREATE TABLE IF NOT EXISTS auth.identities (
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_data jsonb NOT NULL,
  provider text NOT NULL,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  email text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider)
);

CREATE INDEX IF NOT EXISTS identities_email_idx
  ON auth.identities (email text_pattern_ops);

CREATE INDEX IF NOT EXISTS identities_user_id_idx
  ON auth.identities (user_id);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;

-- The earlier standalone privilege migration grants service_role access to
-- every auth table. Narrow that access after the historical migrations run:
-- app code only needs these account fields for login and user administration.
REVOKE ALL PRIVILEGES ON TABLE auth.users FROM service_role;
REVOKE SELECT (id, email, encrypted_password, email_confirmed_at)
  ON TABLE auth.users FROM service_role;
REVOKE ALL PRIVILEGES ON TABLE auth.identities FROM service_role;

GRANT SELECT (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at
) ON TABLE auth.users TO service_role;

GRANT INSERT (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) ON TABLE auth.users TO service_role;

GRANT UPDATE (
  email, encrypted_password, raw_user_meta_data, updated_at
) ON TABLE auth.users TO service_role;

-- Minimal storage metadata objects keep historical RLS migrations applicable.
-- Uploaded files themselves remain on the application's local filesystem.
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT objects_bucket_name_key UNIQUE (bucket_id, name)
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA storage FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA storage FROM PUBLIC;

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT string_to_array(name, '/')
$$;

GRANT USAGE ON SCHEMA storage TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO authenticated, service_role;

-- Historical migrations add tables to this publication. Without a Realtime
-- server/subscriber it is metadata only and does not stream data by itself.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;
END;
$$;

COMMENT ON SCHEMA auth IS
  'Compatibility schema for Robot Center local accounts; not managed by GoTrue.';
COMMENT ON TABLE auth.users IS
  'Preserved local account records used by Robot Center standalone login.';
COMMENT ON TABLE auth.identities IS
  'Preserved account identity rows; auth sessions are not imported.';
COMMENT ON TABLE storage.objects IS
  'Storage metadata compatibility only; uploaded file contents live in DOCUMENT_STORAGE_DIR.';
