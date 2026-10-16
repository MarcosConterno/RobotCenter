import { cookies } from "next/headers";

import { createTableClient, type DataRequest, type DataResponse } from "./client-core";
import { withAdminDatabase, withUserDatabase } from "./db";
import { postgresAuthAdmin } from "./auth-admin";
import { authenticateAppUser, changeAppPassword, getAppSessionFromCookies, revokeAppSession, SESSION_COOKIE_NAME } from "./session";
import { executeDataRequest } from "./query-executor";
import { createServerStorageClient } from "./storage-server";

function normalizeResponse(request: DataRequest, value: unknown): DataResponse {
  if (request.kind === "table" && (!request.action || request.action === "select")) {
    const result = value as { data?: unknown; count?: number };
    return { data: result?.data ?? null, error: null, count: result?.count };
  }
  return { data: value ?? null, error: null };
}

function toDataError(error: unknown) {
  const databaseError = error as Error & { code?: string; detail?: string; hint?: string };
  return {
    message: databaseError.message || "Não foi possível consultar o PostgreSQL.",
    code: databaseError.code,
    details: databaseError.detail,
    hint: databaseError.hint,
  };
}

export async function createPostgresServerClient() {
  const session = await getAppSessionFromCookies();
  const tableClient = createTableClient(async (request) => {
    if (!session) return { data: null, error: { message: "Sessão inválida ou expirada.", code: "401" } };
    try {
      const value = await withUserDatabase(
        { userId: session.userId, claims: session.claims },
        (client) => executeDataRequest(client, request),
      );
      return normalizeResponse(request, value);
    } catch (error) {
      return { data: null, error: toDataError(error) };
    }
  });

  return {
    ...tableClient,
    storage: createServerStorageClient(),
    auth: {
      async getUser() {
        return {
          data: { user: session?.user ?? null },
          error: session ? null : { message: "Sessão inválida ou expirada.", code: "401" },
        };
      },
      async getClaims() {
        return {
          data: { claims: session?.claims ?? null },
          error: session ? null : { message: "Sessão inválida ou expirada.", code: "401" },
        };
      },
      async getSession() {
        return {
          data: {
            session: session ? {
              user: session.user,
              expires_at: Math.floor(session.expiresAt.getTime() / 1000),
              expires_in: Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)),
              token_type: "bearer",
            } : null,
          },
          error: null,
        };
      },
      async signInWithPassword(credentials: { email: string; password: string }) {
        try {
          const result = await authenticateAppUser(credentials.email, credentials.password);
          if (!result) return { data: { user: null, session: null }, error: { message: "Email ou senha inválidos." } };
          return {
            data: {
              user: result.user,
              session: {
                user: result.user,
                expires_at: Math.floor(result.session.expiresAt.getTime() / 1000),
                expires_in: 12 * 60 * 60,
                token_type: "bearer",
              },
            },
            error: null,
          };
        } catch (error) {
          return { data: { user: null, session: null }, error: toDataError(error) };
        }
      },
      async signOut() {
        const cookieStore = await cookies();
        const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
        try {
          await revokeAppSession(token);
          return { error: null };
        } catch (error) {
          return { error: toDataError(error) };
        }
      },
      async updateUser(attributes: { password?: string }) {
        if (!session) return { data: { user: null }, error: { message: "Sessão inválida ou expirada." } };
        if (!attributes.password) return { data: { user: session.user }, error: null };
        try {
          await changeAppPassword(session.userId, attributes.password, session.id);
          return { data: { user: session.user }, error: null };
        } catch (error) {
          return { data: { user: null }, error: toDataError(error) };
        }
      },
    },
  };
}

export function createPostgresAdminClient() {
  const tableClient = createTableClient(async (request) => {
    try {
      const value = await withAdminDatabase((client) => executeDataRequest(client, request));
      return normalizeResponse(request, value);
    } catch (error) {
      return { data: null, error: toDataError(error) };
    }
  });
  return {
    ...tableClient,
    auth: { admin: postgresAuthAdmin },
    storage: createServerStorageClient(),
  };
}
