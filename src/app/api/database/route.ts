import { NextResponse, type NextRequest } from "next/server";

import type { DataRequest } from "@/lib/postgres/client-core";
import { withUserDatabase } from "@/lib/postgres/db";
import { executeDataRequest } from "@/lib/postgres/query-executor";
import { getAppSessionFromRequest } from "@/lib/postgres/session";

export const runtime = "nodejs";

function isDataRequest(value: unknown): value is DataRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  if (request.kind === "rpc") {
    return typeof request.name === "string"
      && (request.args === undefined || (Boolean(request.args) && typeof request.args === "object"));
  }
  return request.kind === "table"
    && typeof request.table === "string"
    && ["select", "insert", "update", "delete", "upsert"].includes(String(request.action));
}

export async function POST(request: NextRequest) {
  const session = await getAppSessionFromRequest(request);
  if (!session) return NextResponse.json({ data: null, error: { message: "Sessão inválida ou expirada." } }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: { message: "Corpo JSON inválido." } }, { status: 400 });
  }
  if (!isDataRequest(input)) {
    return NextResponse.json({ data: null, error: { message: "Consulta não reconhecida." } }, { status: 400 });
  }

  try {
    const response = await withUserDatabase(
      { userId: session.userId, claims: session.claims },
      (client) => executeDataRequest(client, input),
    );
    const isSelect = input.kind === "table" && (!input.action || input.action === "select");
    const queryResult = isSelect && response && typeof response === "object"
      ? response as { data?: unknown; count?: number }
      : { data: response };
    return NextResponse.json({ data: queryResult.data ?? null, error: null, count: queryResult.count });
  } catch (error) {
    const databaseError = error as Error & { code?: string; detail?: string; hint?: string };
    const status = databaseError.code === "42501" ? 403 : 400;
    return NextResponse.json({
      data: null,
      error: {
        message: databaseError.message || "Não foi possível consultar o PostgreSQL.",
        code: databaseError.code,
        details: databaseError.detail,
        hint: databaseError.hint,
      },
    }, { status });
  }
}
