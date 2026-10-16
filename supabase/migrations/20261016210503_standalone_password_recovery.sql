-- One-time password recovery tokens for the standalone PostgreSQL runtime.
-- Existing accounts and application data are preserved.
CREATE TABLE public.app_password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CONSTRAINT app_password_reset_tokens_expiration_after_creation
    CHECK (expires_at > created_at),
  CONSTRAINT app_password_reset_tokens_used_after_creation
    CHECK (used_at IS NULL OR used_at >= created_at)
);

CREATE INDEX app_password_reset_tokens_user_active_idx
  ON public.app_password_reset_tokens (user_id, created_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX app_password_reset_tokens_expiration_idx
  ON public.app_password_reset_tokens (expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.app_password_reset_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_password_reset_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.app_password_reset_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_password_reset_tokens TO service_role;

COMMENT ON TABLE public.app_password_reset_tokens IS
  'One-time password reset tokens issued by the standalone Robot Center backend.';
COMMENT ON COLUMN public.app_password_reset_tokens.token_hash IS
  'SHA-256 hex digest of the raw random token; the raw token is returned only in the local development flow or sent by the configured mailer.';
