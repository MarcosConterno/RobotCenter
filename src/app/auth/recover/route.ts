import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    const destination = new URL("/recuperar-senha", request.url);
    destination.searchParams.set("error", "Informe seu email.");
    return NextResponse.redirect(destination, 303);
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${request.nextUrl.origin}/auth/callback?next=/redefinir-senha`,
  });

  const destination = new URL("/recuperar-senha", request.url);
  destination.searchParams.set("sent", "1");
  return NextResponse.redirect(destination, 303);
}
