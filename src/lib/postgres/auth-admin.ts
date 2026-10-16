import bcrypt from "bcryptjs";

import { withAdminDatabase } from "./db";
import type { AppAuthUser } from "./session";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mapUser(row: {
  id: string;
  email: string | null;
  created_at: Date | string;
  raw_app_meta_data?: unknown;
  raw_user_meta_data?: unknown;
}): AppAuthUser {
  return {
    id: row.id,
    email: row.email,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    app_metadata: asRecord(row.raw_app_meta_data),
    user_metadata: asRecord(row.raw_user_meta_data),
  };
}

export const postgresAuthAdmin = {
  async listUsers(options: { page?: number; perPage?: number } = {}) {
    try {
      const page = Math.max(1, Math.trunc(options.page ?? 1));
      const perPage = Math.min(1000, Math.max(1, Math.trunc(options.perPage ?? 50)));
      const users = await withAdminDatabase(async (client) => client.query<{
        id: string;
        email: string | null;
        created_at: Date;
        raw_app_meta_data: unknown;
        raw_user_meta_data: unknown;
      }>(
        `SELECT id::text, email, created_at, raw_app_meta_data, raw_user_meta_data
         FROM auth.users ORDER BY created_at, id LIMIT $1 OFFSET $2`,
        [perPage, (page - 1) * perPage],
      ));
      return { data: { users: users.rows.map(mapUser) }, error: null };
    } catch (error) {
      return { data: { users: [] }, error: asError(error) };
    }
  },

  async createUser(input: {
    email: string;
    password: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  }) {
    try {
      const encryptedPassword = await bcrypt.hash(input.password, 12);
      const user = await withAdminDatabase(async (client) => {
        const result = await client.query<{
          id: string;
          email: string | null;
          created_at: Date;
          raw_app_meta_data: unknown;
          raw_user_meta_data: unknown;
        }>(
          `INSERT INTO auth.users (
             id, aud, role, email, encrypted_password, email_confirmed_at,
             raw_app_meta_data, raw_user_meta_data, created_at, updated_at
           ) VALUES (
             gen_random_uuid(), 'authenticated', 'authenticated', lower($1), $2,
             CASE WHEN $3::boolean THEN now() ELSE NULL END,
             $4::jsonb, $5::jsonb, now(), now()
           )
           RETURNING id::text, email, created_at, raw_app_meta_data, raw_user_meta_data`,
          [input.email.trim(), encryptedPassword, Boolean(input.email_confirm), JSON.stringify(input.app_metadata ?? { provider: "email", providers: ["email"] }), JSON.stringify(input.user_metadata ?? {})],
        );
        return result.rows[0];
      });
      return { data: { user: user ? mapUser(user) : null }, error: null };
    } catch (error) {
      return { data: { user: null }, error: asError(error) };
    }
  },

  async updateUserById(id: string, attributes: { email?: string; password?: string; user_metadata?: Record<string, unknown> }) {
    try {
      const encryptedPassword = attributes.password ? await bcrypt.hash(attributes.password, 12) : null;
      const user = await withAdminDatabase(async (client) => {
        const result = await client.query<{
          id: string;
          email: string | null;
          created_at: Date;
          raw_app_meta_data: unknown;
          raw_user_meta_data: unknown;
        }>(
          `UPDATE auth.users
           SET email = COALESCE(lower($2), email),
               encrypted_password = COALESCE($3, encrypted_password),
               raw_user_meta_data = CASE WHEN $4::jsonb IS NULL THEN raw_user_meta_data ELSE raw_user_meta_data || $4::jsonb END,
               updated_at = now()
           WHERE id = $1::uuid
           RETURNING id::text, email, created_at, raw_app_meta_data, raw_user_meta_data`,
          [id, attributes.email ?? null, encryptedPassword, attributes.user_metadata ? JSON.stringify(attributes.user_metadata) : null],
        );
        if (attributes.password && result.rows[0]) {
          await client.query(
            `UPDATE public.app_password_reset_tokens
             SET used_at = COALESCE(used_at, now())
             WHERE user_id = $1::uuid AND used_at IS NULL`,
            [id],
          );
          await client.query(
            `UPDATE public.app_sessions
             SET revoked_at = COALESCE(revoked_at, now())
             WHERE user_id = $1::uuid AND revoked_at IS NULL`,
            [id],
          );
        }
        return result.rows[0];
      });
      if (!user) throw new Error("Usuário não encontrado.");
      return { data: { user: mapUser(user) }, error: null };
    } catch (error) {
      return { data: { user: null }, error: asError(error) };
    }
  },

  async deleteUser(id: string, _shouldSoftDelete = false) {
    try {
      await withAdminDatabase(async (client) => {
        await client.query(
          `UPDATE auth.users
           SET encrypted_password = '', updated_at = now()
           WHERE id = $1::uuid`,
          [id],
        );
        await client.query(
          `UPDATE public.app_sessions
           SET revoked_at = COALESCE(revoked_at, now())
           WHERE user_id = $1::uuid AND revoked_at IS NULL`,
          [id],
        );
        await client.query(
          `UPDATE public.app_password_reset_tokens
           SET used_at = COALESCE(used_at, now())
           WHERE user_id = $1::uuid AND used_at IS NULL`,
          [id],
        );
      });
      return { data: { user: { id } }, error: null };
    } catch (error) {
      return { data: { user: null }, error: asError(error) };
    }
  },
};

function asError(error: unknown) {
  return { message: error instanceof Error ? error.message : "Operação administrativa de usuário falhou." };
}
