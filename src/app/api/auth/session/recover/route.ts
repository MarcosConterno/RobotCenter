import { NextResponse } from "next/server";
import { createPasswordRecoveryLink } from "@/lib/postgres/password-recovery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { data: null, error: { message: "A recuperação por e-mail ainda não está configurada neste servidor." } },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Informe um e-mail válido." } },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { data: null, error: { message: "Informe um e-mail válido." } },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    const developmentResetUrl = await createPasswordRecoveryLink(email, new URL(request.url).origin);
    return NextResponse.json(
      {
        data: {
          message: "Se a conta estiver cadastrada, o link de recuperação ficará disponível neste ambiente local.",
          developmentResetUrl,
        },
        error: null,
      },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Falha ao criar link local de recuperação de senha.", error);
    return NextResponse.json(
      { data: null, error: { message: "Não foi possível preparar a recuperação de senha." } },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
