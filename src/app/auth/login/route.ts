import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.redirect(loginUrl, 303);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Email ou senha inválidos.");
    loginUrl.searchParams.set("redirectTo", redirectTo);
    return NextResponse.redirect(loginUrl, 303);
  }

  return NextResponse.redirect(new URL(redirectTo, request.url), 303);
}
