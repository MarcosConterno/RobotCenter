import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

import { withAdminDatabase } from "./db";

export const SESSION_COOKIE_NAME = "robot_center_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 12;

export interface AppAuthUser {
  id: string;
  email: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  created_at?: string;
}

export interface AppSession {
  id: string;
  userId: string;
  user: AppAuthUser;
  claims: Record<string, unknown>;
  expiresAt: Date;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function buildClaims(user: AppAuthUser, expiresAt: Date) {
  return {
    sub: user.id,
    role: "authenticated",
    email: user.email,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function createAppSession(user: AppAuthUser) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000);
  const tokenHash = hashToken(token);
  const session = await withAdminDatabase(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO public.app_sessions (user_id, token_hash, expires_at)
       VALUES ($1::uuid, $2, $3)
       RETURNING id::text`,
      [user.id, tokenHash, expiresAt],
    );
    return result.rows[0];
  });

  if (!session) throw new Error("Não foi possível criar a sessão.");
  await setSessionCookie(token, expiresAt);

  return {
    id: session.id,
    userId: user.id,
    user,
    claims: buildClaims(user, expiresAt),
    expiresAt,
  } satisfies AppSession;
}

export async function getAppSession(token?: string | null): Promise<AppSession | null> {
  if (!token || token.length > 256) return null;

  const result = await withAdminDatabase(async (client) => client.query<{
    session_id: string;
    user_id: string;
    email: string | null;
    raw_app_user_metadata: unknown;
    raw_user_metadata: unknown;
    user_created_at: Date;
    expires_at: Date;
  }>(
    `SELECT
       s.id::text AS session_id,
       s.user_id::text AS user_id,
       u.email,
       u.raw_app_meta_data AS raw_app_user_metadata,
       u.raw_user_meta_data AS raw_user_metadata,
       u.created_at AS user_created_at,
       s.expires_at
     FROM public.app_sessions AS s
     JOIN auth.users AS u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
     LIMIT 1`,
    [hashToken(token)],
  ));
  const row = result.rows[0];
  if (!row) return null;

  const user: AppAuthUser = {
    id: row.user_id,
    email: row.email,
    app_metadata: toRecord(row.raw_app_user_metadata),
    user_metadata: toRecord(row.raw_user_metadata),
    created_at: row.user_created_at instanceof Date
      ? row.user_created_at.toISOString()
      : String(row.user_created_at),
  };
  const expiresAt = row.expires_at instanceof Date
    ? row.expires_at
    : new Date(row.expires_at);

  return {
    id: row.session_id,
    userId: row.user_id,
    user,
    claims: buildClaims(user, expiresAt),
    expiresAt,
  };
}

export async function getAppSessionFromCookies() {
  const cookieStore = await cookies();
  return getAppSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function getAppSessionFromRequest(request: Request & {
  cookies?: { get(name: string): { value: string } | undefined };
}) {
  const token = request.cookies?.get(SESSION_COOKIE_NAME)?.value;
  return getAppSession(token);
}

export async function revokeAppSession(token?: string | null) {
  const cookieStore = await cookies();
  if (token) {
    await withAdminDatabase(async (client) => client.query(
      `UPDATE public.app_sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE token_hash = $1`,
      [hashToken(token)],
    ));
  }
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function revokeAppSessionsForUser(userId: string, exceptSessionId?: string) {
  await withAdminDatabase(async (client) => client.query(
    `UPDATE public.app_sessions
     SET revoked_at = COALESCE(revoked_at, now())
     WHERE user_id = $1::uuid
       AND revoked_at IS NULL
       AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [userId, exceptSessionId ?? null],
  ));
}

export async function authenticateAppUser(email: string, password: string) {
  const result = await withAdminDatabase(async (client) => client.query<{
    id: string;
    email: string | null;
    encrypted_password: string;
    raw_app_meta_data: unknown;
    raw_user_meta_data: unknown;
    created_at: Date;
  }>(
    `SELECT u.id::text, u.email, u.encrypted_password, u.raw_app_meta_data,
            u.raw_user_meta_data, u.created_at
     FROM auth.users AS u
     LEFT JOIN public.profiles AS p ON p.id = u.id
     WHERE lower(btrim(u.email)) = lower(btrim($1))
        OR lower(btrim(p.login)) = lower(btrim($1))
     ORDER BY CASE WHEN lower(btrim(u.email)) = lower(btrim($1)) THEN 0 ELSE 1 END
     LIMIT 1`,
    [email],
  ));
  const row = result.rows[0];
  if (!row) {
    if (process.env.NODE_ENV !== "production") console.info("[auth-local] conta não encontrada por email/login");
    return null;
  }
  if (!row.encrypted_password) {
    if (process.env.NODE_ENV !== "production") console.info("[auth-local] conta encontrada, mas sem hash de senha");
    return null;
  }

  let validPassword = false;
  try {
    validPassword = await bcrypt.compare(password, row.encrypted_password.trim());
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[auth-local] erro ao validar hash bcrypt", error);
    }
    validPassword = false;
  }
  if (!validPassword) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[auth-local] conta e hash encontrados, mas bcrypt não validou a senha", {
        hashLength: row.encrypted_password.length,
        hashPrefix: row.encrypted_password.slice(0, 4),
      });
    }
    return null;
  }

  const user: AppAuthUser = {
    id: row.id,
    email: row.email,
    app_metadata: toRecord(row.raw_app_meta_data),
    user_metadata: toRecord(row.raw_user_meta_data),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
  const session = await createAppSession(user);
  return { user, session };
}

export async function changeAppPassword(userId: string, password: string, currentSessionId: string) {
  const encryptedPassword = await bcrypt.hash(password, 12);
  await withAdminDatabase(async (client) => {
    await client.query(
      `UPDATE auth.users SET encrypted_password = $2, updated_at = now() WHERE id = $1::uuid`,
      [userId, encryptedPassword],
    );
    await client.query(
      `UPDATE public.app_password_reset_tokens
       SET used_at = COALESCE(used_at, now())
       WHERE user_id = $1::uuid AND used_at IS NULL`,
      [userId],
    );
    await client.query(
      `UPDATE public.app_sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE user_id = $1::uuid AND id <> $2::uuid AND revoked_at IS NULL`,
      [userId, currentSessionId],
    );
  });
}
