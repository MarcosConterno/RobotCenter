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

  if (isAuthenticated && (request.nextUrl.pathname.startsWith("/configuracoes") || request.nextUrl.pathname.startsWith("/robos"))) {
    const userId = data?.claims?.sub;
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("roles(codigo)")
      .eq("user_id", userId as string);
    const roleCodes = new Set((userRoles ?? []).flatMap((item) => {
      const relation = item.roles;
      if (Array.isArray(relation)) return relation.map((role) => role.codigo);
      return relation && typeof relation === "object" && "codigo" in relation ? [relation.codigo] : [];
    }));
    const allowed = request.nextUrl.pathname.startsWith("/configuracoes")
      ? roleCodes.has("admin") || roleCodes.has("master")
      : roleCodes.has("admin") || roleCodes.has("master") || roleCodes.has("operador") || roleCodes.has("cliente") || roleCodes.has("suporte");
    if (!allowed) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/minha-pagina";
      dashboardUrl.search = "";
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return response;
}
