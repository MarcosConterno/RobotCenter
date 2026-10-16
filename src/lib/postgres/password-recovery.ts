import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { withAdminDatabase } from "./db";

const RESET_TOKEN_TTL_MINUTES = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordRecoveryLink(email: string, origin: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);

  return withAdminDatabase(async (client) => {
    const userResult = await client.query<{ id: string }>(
      `SELECT id::text
       FROM auth.users
       WHERE lower(btrim(email)) = $1
         AND encrypted_password IS NOT NULL
         AND encrypted_password <> ''
       LIMIT 1`,
      [normalizedEmail],
    );
    const user = userResult.rows[0];
    if (!user) return null;

    await client.query(
      `UPDATE public.app_password_reset_tokens
       SET used_at = now()
       WHERE user_id = $1::uuid AND used_at IS NULL`,
      [user.id],
    );
    await client.query(
      `INSERT INTO public.app_password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1::uuid, $2, now() + ($3 * interval '1 minute'))`,
      [user.id, tokenHash, RESET_TOKEN_TTL_MINUTES],
    );

    const link = new URL("/redefinir-senha", origin);
    link.searchParams.set("token", rawToken);
    return link.toString();
  });
}

export async function completePasswordRecovery(token: string, password: string) {
  const tokenHash = hashToken(token);

  return withAdminDatabase(async (client) => {
    const candidateResult = await client.query<{ user_id: string }>(
      `SELECT user_id::text
       FROM public.app_password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > now()
       LIMIT 1`,
      [tokenHash],
    );
    const candidate = candidateResult.rows[0];
    if (!candidate) return false;

    // Lock the account before the token row, matching password-change and
    // account-archive operations to avoid a user/token lock-order deadlock.
    const userResult = await client.query<{ id: string }>(
      `SELECT id::text
       FROM auth.users
       WHERE id = $1::uuid
         AND encrypted_password IS NOT NULL
         AND encrypted_password <> ''
       FOR UPDATE`,
      [candidate.user_id],
    );
    if (!userResult.rows[0]) return false;

    const tokenResult = await client.query<{ id: string }>(
      `SELECT id::text
       FROM public.app_password_reset_tokens
       WHERE token_hash = $1
         AND user_id = $2::uuid
         AND used_at IS NULL
         AND expires_at > now()
       FOR UPDATE`,
      [tokenHash, candidate.user_id],
    );
    if (!tokenResult.rows[0]) return false;

    const encryptedPassword = await bcrypt.hash(password, 12);
    const updateResult = await client.query(
      `UPDATE auth.users
       SET encrypted_password = $2, updated_at = now()
       WHERE id = $1::uuid
         AND encrypted_password IS NOT NULL
         AND encrypted_password <> ''`,
      [candidate.user_id, encryptedPassword],
    );
    if (updateResult.rowCount !== 1) return false;

    await client.query(
      `UPDATE public.app_password_reset_tokens
       SET used_at = COALESCE(used_at, now())
       WHERE user_id = $1::uuid AND used_at IS NULL`,
      [candidate.user_id],
    );
    await client.query(
      `UPDATE public.app_sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE user_id = $1::uuid AND revoked_at IS NULL`,
      [candidate.user_id],
    );
    return true;
  });
}
