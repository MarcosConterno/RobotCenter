"use client";

import { createPostgresBrowserClient } from "@/lib/postgres/browser-client";

/** Browser-compatible database client backed by the app's PostgreSQL API. */
export function createClient() {
  return createPostgresBrowserClient();
}

export const createBrowserClient = createClient;
