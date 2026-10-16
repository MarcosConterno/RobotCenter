import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/database/server";
import { clearLegacyAuthCookies } from "@/lib/auth/cookies";

function safeRedirectPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/robos";
  }

  return value;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectPath(formData.get("redirectTo"));

  if (!email || !password) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Informe email e senha.");
    loginUrl.searchParams.set("redirectTo", redirectTo);
    return clearLegacyAuthCookies(request, NextResponse.redirect(loginUrl, 303));
  }

  const database = await createClient();
  const { error } = await database.auth.signInWithPassword({ email, password });

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      const authError = error as { code?: unknown; message?: unknown };
      console.error("[auth-local] falha no POST /auth/login", {
        reason: authError.message === "Email ou senha inválidos."
          ? "credentials_rejected"
          : "postgres_or_session_error",
        code: typeof authError.code === "string" ? authError.code : null,
      });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Email ou senha inválidos.");
    loginUrl.searchParams.set("redirectTo", redirectTo);
    return clearLegacyAuthCookies(request, NextResponse.redirect(loginUrl, 303));
  }

  return clearLegacyAuthCookies(request, NextResponse.redirect(new URL(redirectTo, request.url), 303));
}
