import { createPostgresServerClient } from "@/lib/postgres/server-client";

/** Server-side database client backed by the app's PostgreSQL session. */
export async function createClient() {
  return createPostgresServerClient();
}

export const createServerClient = createClient;
