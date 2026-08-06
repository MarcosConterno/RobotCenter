import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

import { getSupabaseConfig } from "./config";

const PUBLIC_PATHS = [
  "/login",
  "/recuperar-senha",
  "/redefinir-senha",
  "/auth/login",
  "/auth/recover",
  "/auth/callback",
  "/auth/update-password",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && Boolean(data?.claims?.sub);
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "redirectTo",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && request.nextUrl.pathname === "/login") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/robos";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  return response;
}
