import { NextResponse } from "next/server";
import { createPostgresServerClient } from "@/lib/postgres/server-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await createPostgresServerClient();
    const result = await client.auth.getSession();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
      status: result.error ? 401 : 200,
    });
  } catch {
    return NextResponse.json(
      { data: { session: null }, error: { message: "Não foi possível ler a sessão." } },
      { headers: { "Cache-Control": "no-store, max-age=0" }, status: 500 },
    );
  }
}

