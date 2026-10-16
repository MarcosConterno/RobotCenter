"use client";

import { createTableClient, type DataRequest, type DataResponse } from "./client-core";
import { createBrowserStorageClient } from "./storage-browser";

async function sendQuery(request: DataRequest): Promise<DataResponse> {
  try {
    const response = await fetch("/api/database", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      credentials: "same-origin",
      cache: "no-store",
    });
    const body = await response.json() as DataResponse;
    if (!response.ok && !body.error) {
      return { data: null, error: { message: "Não foi possível consultar o PostgreSQL." } };
    }
    return body;
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : "Falha de conexão com o servidor." } };
  }
}

async function readSession() {
  try {
    const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return { data: { user: null, session: null }, error: body.error ?? { message: "Sessão inválida." } };
    return { data: { user: body.user ?? null, session: body.session ?? null, claims: body.claims ?? null }, error: null };
  } catch (error) {
    return { data: { user: null, session: null }, error: { message: error instanceof Error ? error.message : "Falha de conexão com o servidor." } };
  }
}

type LocalChannelPayload = { new?: unknown; old?: unknown; eventType?: string };

export function createPostgresBrowserClient() {
  const tableClient = createTableClient(sendQuery);
  const channelCallbacks = new Map<string, Set<(payload?: LocalChannelPayload) => void>>();
  const channelTimers = new Map<string, ReturnType<typeof setInterval>>();

  return {
    ...tableClient,
    storage: createBrowserStorageClient(),
    auth: {
      async getUser() {
        const result = await readSession();
        return { data: { user: result.data.user }, error: result.error };
      },
      async getClaims() {
        const result = await readSession();
        return { data: { claims: result.data.claims }, error: result.error };
      },
      async getSession() {
        const result = await readSession();
        return { data: { session: result.data.session }, error: result.error };
      },
      async signInWithPassword(credentials: { email: string; password: string }) {
        try {
          const response = await fetch("/api/auth/session/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(credentials),
            credentials: "same-origin",
          });
          const body = await response.json();
          const authData = body?.data && typeof body.data === "object" ? body.data : body;
          return response.ok && !body?.error
            ? { data: { user: authData?.user ?? null, session: authData?.session ?? null }, error: null }
            : { data: { user: null, session: null }, error: body?.error ?? { message: "Email ou senha inválidos." } };
        } catch (error) {
          return { data: { user: null, session: null }, error: { message: error instanceof Error ? error.message : "Falha de conexão com o servidor." } };
        }
      },
      async signOut() {
        try {
          const response = await fetch("/api/auth/session/logout", { method: "POST", credentials: "same-origin" });
          return response.ok ? { error: null } : { error: { message: "Não foi possível encerrar a sessão." } };
        } catch (error) {
          return { error: { message: error instanceof Error ? error.message : "Falha de conexão com o servidor." } };
        }
      },
      async updateUser(attributes: { password?: string }) {
        try {
          const response = await fetch("/api/auth/session/password", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(attributes),
            credentials: "same-origin",
          });
          const body = await response.json();
          return response.ok
            ? { data: { user: body.user }, error: null }
            : { data: { user: null }, error: body.error ?? { message: "Não foi possível alterar a senha." } };
        } catch (error) {
          return { data: { user: null }, error: { message: error instanceof Error ? error.message : "Falha de conexão com o servidor." } };
        }
      },
      async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
        try {
          const response = await fetch("/api/auth/session/recover", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email }),
            credentials: "same-origin",
          });
          const body = await response.json();
          return response.ok
            ? { data: body.data ?? {}, error: null }
            : { data: {}, error: body.error ?? { message: "Recuperação de senha indisponível." } };
        } catch (error) {
          return { data: {}, error: { message: error instanceof Error ? error.message : "Falha de conexão com o servidor." } };
        }
      },
      onAuthStateChange(callback: (event: string, session: unknown) => void) {
        let active = true;
        void readSession().then((result) => {
          if (active) callback("INITIAL_SESSION", result.data.session);
        });
        return { data: { subscription: { unsubscribe: () => { active = false; } } } };
      },
    },
    channel(name: string) {
      const callbacks = new Set<(payload?: LocalChannelPayload) => void>();
      return {
        on(_event: string, _filter: unknown, callback: (payload?: LocalChannelPayload) => void) {
          callbacks.add(callback);
          return this;
        },
        subscribe() {
          const sharedCallbacks = channelCallbacks.get(name) ?? new Set<(payload?: LocalChannelPayload) => void>();
          callbacks.forEach((callback) => sharedCallbacks.add(callback));
          channelCallbacks.set(name, sharedCallbacks);
          if (!channelTimers.has(name)) {
            channelTimers.set(name, setInterval(() => sharedCallbacks.forEach((callback) => callback()), 30_000));
          }
          return this;
        },
        unsubscribe() {
          const sharedCallbacks = channelCallbacks.get(name);
          callbacks.forEach((callback) => sharedCallbacks?.delete(callback));
          if (sharedCallbacks?.size === 0) {
            const timer = channelTimers.get(name);
            if (timer) clearInterval(timer);
            channelCallbacks.delete(name);
            channelTimers.delete(name);
          }
          return "ok";
        },
      };
    },
    async removeChannel(channel: { unsubscribe?: () => void }) {
      channel.unsubscribe?.();
      return "ok";
    },
  };
}
