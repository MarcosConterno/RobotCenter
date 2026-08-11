import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

import { clearSupabaseAuthCookies, copyResponseCookies, isInvalidRefreshTokenError } from "./auth-cookies";
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

function relationValues(value: unknown, key: "id" | "codigo"): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => relationValues(item, key));
  if (!value || typeof value !== "object") return [];
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? [field] : [];
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && Boolean(data?.claims?.sub);
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (isInvalidRefreshTokenError(error)) {
    if (isPublicPath) return clearSupabaseAuthCookies(request, response);
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return clearSupabaseAuthCookies(
        request,
        NextResponse.json({ error: "Sessão expirada." }, { status: 401 }),
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return clearSupabaseAuthCookies(request, NextResponse.redirect(loginUrl));
  }

  if (!isAuthenticated && !isPublicPath) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return copyResponseCookies(response, NextResponse.json({ error: "Sessão inválida." }, { status: 401 }));
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "redirectTo",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return copyResponseCookies(response, NextResponse.redirect(loginUrl));
  }

  if (isAuthenticated && (request.nextUrl.pathname.startsWith("/configuracoes") || request.nextUrl.pathname.startsWith("/robos"))) {
    const userId = data?.claims?.sub;
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("roles(id,codigo)")
      .eq("user_id", userId as string);
    const roleCodes = new Set((userRoles ?? []).flatMap((item) => {
      const relation = item.roles;
      if (Array.isArray(relation)) return relation.map((role) => role.codigo);
      return relation && typeof relation === "object" && "codigo" in relation ? [relation.codigo] : [];
    }));
    const roleIds = [...new Set((userRoles ?? []).flatMap((item) => relationValues(item.roles, "id")))];
    const { data: permissionMappings } = roleIds.length
      ? await supabase.from("role_permissions").select("permissions(codigo)").in("role_id", roleIds)
      : { data: [] };
    const permissionCodes = new Set((permissionMappings ?? []).flatMap((item) => relationValues(item.permissions, "codigo")));
    const productPermissionByPath: Record<string, string> = {
      "/robos/integradores": "robots.product.integrador.read",
      "/robos/consulta-processual": "robots.product.consulta_processual.read",
      "/robos/peticionamento": "robots.product.peticionamento.read",
      "/robos/movimento": "robots.product.movimento.read",
    };
    const requiredProductPermission = productPermissionByPath[request.nextUrl.pathname];
    const allowed = request.nextUrl.pathname.startsWith("/configuracoes")
      ? roleCodes.has("admin") || roleCodes.has("master")
      : permissionCodes.has("robots.read") && (!requiredProductPermission || permissionCodes.has(requiredProductPermission));
    if (!allowed) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/minha-pagina";
      dashboardUrl.search = "";
      return copyResponseCookies(response, NextResponse.redirect(dashboardUrl));
    }
  }

  return response;
}
