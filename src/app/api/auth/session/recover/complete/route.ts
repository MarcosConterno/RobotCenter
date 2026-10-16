import { NextRequest, NextResponse } from "next/server";

import { completePasswordRecovery } from "@/lib/postgres/password-recovery";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { token?: unknown; password?: unknown; passwordConfirmation?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Corpo JSON inválido." } },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  if (typeof body.token !== "string" || body.token.length < 32 || body.token.length > 128) {
    return NextResponse.json(
      { data: null, error: { message: "O link de recuperação é inválido ou expirou." } },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  if (
    typeof body.password !== "string"
    || body.password.length < 8
    || Buffer.byteLength(body.password, "utf8") > 72
  ) {
    return NextResponse.json(
      { data: null, error: { message: "A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes." } },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  if (body.password !== body.passwordConfirmation) {
    return NextResponse.json(
      { data: null, error: { message: "As senhas não coincidem." } },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    const updated = await completePasswordRecovery(body.token, body.password);
    if (!updated) {
      return NextResponse.json(
        { data: null, error: { message: "O link de recuperação é inválido, expirou ou já foi usado." } },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    return NextResponse.json(
      { data: { message: "Senha atualizada. Entre novamente com a nova senha." }, error: null },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Falha ao concluir recuperação de senha.", error);
    return NextResponse.json(
      { data: null, error: { message: "Não foi possível atualizar a senha." } },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
