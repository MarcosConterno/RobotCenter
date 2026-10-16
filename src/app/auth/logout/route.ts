import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/database/server";
import { clearLegacyAuthCookies } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  const database = await createClient();
  await database.auth.signOut();

  return clearLegacyAuthCookies(
    request,
    NextResponse.redirect(new URL("/login", request.url), 303),
  );
}
