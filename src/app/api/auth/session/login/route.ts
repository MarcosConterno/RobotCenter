import { NextRequest, NextResponse } from "next/server";
import { createPostgresServerClient } from "@/lib/postgres/server-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: { message: "Corpo JSON inválido." } }, { status: 400 });
  }

  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ data: null, error: { message: "Informe e-mail e senha." } }, { status: 400 });
  }

  try {
    const client = await createPostgresServerClient();
    const result = await client.auth.signInWithPassword({
      email: body.email.trim(),
      password: body.password,
    });
    return NextResponse.json(result, {
      status: result.error ? (result.error.status ?? 401) : 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Não foi possível iniciar a sessão." } },
      { status: 500 },
    );
  }
}

