import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");

  const errorDestination = new URL("/redefinir-senha", request.url);

  if (password.length < 6) {
    errorDestination.searchParams.set("error", "A senha deve ter pelo menos 6 caracteres.");
    return NextResponse.redirect(errorDestination, 303);
  }

  if (password !== confirmation) {
    errorDestination.searchParams.set("error", "As senhas não coincidem.");
    return NextResponse.redirect(errorDestination, 303);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const destination = new URL("/recuperar-senha", request.url);
    destination.searchParams.set("error", "Sua sessão de recuperação expirou.");
    return NextResponse.redirect(destination, 303);
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    errorDestination.searchParams.set("error", "Não foi possível atualizar a senha.");
    return NextResponse.redirect(errorDestination, 303);
  }

  await supabase.auth.signOut();
  const loginDestination = new URL("/login", request.url);
  loginDestination.searchParams.set("message", "Senha atualizada. Entre novamente.");
  return NextResponse.redirect(loginDestination, 303);
}
