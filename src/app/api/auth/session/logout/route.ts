import { NextResponse } from "next/server";
import { createPostgresServerClient } from "@/lib/postgres/server-client";

export const runtime = "nodejs";

export async function POST() {
  try {
    const client = await createPostgresServerClient();
    const result = await client.auth.signOut();
    return NextResponse.json(result, {
      status: result.error ? 500 : 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Não foi possível encerrar a sessão." } },
      { status: 500 },
    );
  }
}

