import { NextRequest, NextResponse } from "next/server";
import { createPostgresServerClient } from "@/lib/postgres/server-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: { message: "Corpo JSON inválido." } }, { status: 400 });
  }

  if (typeof body.password !== "string" || body.password.length < 8) {
    return NextResponse.json(
      { data: null, error: { message: "A senha deve ter pelo menos 8 caracteres." } },
      { status: 400 },
    );
  }

  try {
    const client = await createPostgresServerClient();
    const result = await client.auth.updateUser({ password: body.password });
    return NextResponse.json(result, {
      status: result.error ? (result.error.status ?? 400) : 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Não foi possível atualizar a senha." } },
      { status: 500 },
    );
  }
}

