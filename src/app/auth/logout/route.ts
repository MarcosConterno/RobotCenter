import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { clearSupabaseAuthCookies } from "@/lib/supabase/auth-cookies";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return clearSupabaseAuthCookies(
    request,
    NextResponse.redirect(new URL("/login", request.url), 303),
  );
}
