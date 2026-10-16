import "server-only";
import { createPostgresAdminClient } from "@/lib/postgres/server-client";

/** Privileged server-only client for trusted application workflows. */
export function createAdminClient() {
  return createPostgresAdminClient();
}

export const createClient = createAdminClient;
export const getAdminClient = createAdminClient;
