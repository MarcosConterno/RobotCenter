import { NextResponse, type NextRequest } from "next/server";

import { withUserDatabase } from "@/lib/postgres/db";
import { getAppSessionFromRequest } from "@/lib/postgres/session";
import {
  contentTypeForPath,
  downloadStorageObject,
  removeStorageObjects,
  uploadStorageObject,
  copyStorageObject,
  STORAGE_BUCKETS,
} from "@/lib/postgres/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ bucket: string }> };

function storagePathFromRequest(request: NextRequest) {
  return request.nextUrl.searchParams.get("path") ?? "";
}

async function authorizeRobotFile(session: NonNullable<Awaited<ReturnType<typeof getAppSessionFromRequest>>>, storagePath: string, write = false) {
  const robotId = storagePath.split("/")[0];
  if (!/^[0-9a-f-]{36}$/i.test(robotId)) return false;
  return withUserDatabase({ userId: session.userId, claims: session.claims }, async (client) => {
    const result = await client.query<{ allowed: boolean }>(
      write
        ? `SELECT EXISTS (
             SELECT 1 FROM public.robos AS r
             WHERE r.id = $1::uuid
               AND r.deleted_at IS NULL
               AND (SELECT private.has_permission('robots.update'))
               AND (SELECT private.can_access_cliente(r.cliente_id))
           ) AS allowed`
        : `SELECT EXISTS (
             SELECT 1 FROM public.robos AS r
             WHERE r.id = $1::uuid
               AND r.deleted_at IS NULL
               AND (SELECT private.can_access_cliente(r.cliente_id))
           ) AS allowed`,
      [robotId],
    );
    return Boolean(result.rows[0]?.allowed);
  });
}

async function errorResponse(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Operação de arquivo falhou.";
  return NextResponse.json({ data: null, error: { message } }, { status });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { bucket } = await context.params;
  const storagePath = storagePathFromRequest(request);
  if (!STORAGE_BUCKETS.has(bucket) || bucket === "robot-documentation-templates") {
    return errorResponse(new Error("Área de arquivos não disponível."), 404);
  }
  const session = await getAppSessionFromRequest(request);
  if (!session) return errorResponse(new Error("Sessão inválida ou expirada."), 401);
  try {
    if (!await authorizeRobotFile(session, storagePath)) return errorResponse(new Error("Sem permissão para este arquivo."), 403);
    const blob = await downloadStorageObject(bucket, storagePath);
    const filename = request.nextUrl.searchParams.get("download");
    const headers = new Headers({
      "content-type": blob.type || contentTypeForPath(storagePath),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });
    if (filename) headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return new Response(blob, { headers });
  } catch (error) {
    return errorResponse(error, 403);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { bucket } = await context.params;
  const storagePath = storagePathFromRequest(request);
  if (!STORAGE_BUCKETS.has(bucket) || bucket === "robot-documentation-templates") {
    return errorResponse(new Error("Área de arquivos não disponível."), 404);
  }
  const session = await getAppSessionFromRequest(request);
  if (!session) return errorResponse(new Error("Sessão inválida ou expirada."), 401);
  try {
    if (!await authorizeRobotFile(session, storagePath, true)) return errorResponse(new Error("Sem permissão para enviar arquivo."), 403);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return errorResponse(new Error("Arquivo não informado."), 400);
    if (file.size > 20 * 1024 * 1024) return errorResponse(new Error("O arquivo ultrapassa 20 MB."), 413);
    await uploadStorageObject(bucket, storagePath, new Uint8Array(await file.arrayBuffer()), {
      contentType: String(formData.get("contentType") ?? file.type),
      upsert: formData.get("upsert") === "true",
    });
    return NextResponse.json({ data: { path: storagePath }, error: null });
  } catch (error) {
    return errorResponse(error, 403);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { bucket } = await context.params;
  if (!STORAGE_BUCKETS.has(bucket) || bucket === "robot-documentation-templates") {
    return errorResponse(new Error("Área de arquivos não disponível."), 404);
  }
  const session = await getAppSessionFromRequest(request);
  if (!session) return errorResponse(new Error("Sessão inválida ou expirada."), 401);
  try {
    const body = await request.json() as { paths?: unknown };
    const paths = Array.isArray(body.paths) ? body.paths.filter((value): value is string => typeof value === "string") : [];
    if (!paths.length || paths.length > 50) return errorResponse(new Error("Lista de arquivos inválida."), 400);
    for (const storagePath of paths) {
      if (!await authorizeRobotFile(session, storagePath, true)) return errorResponse(new Error("Sem permissão para remover arquivo."), 403);
    }
    const data = await removeStorageObjects(bucket, paths);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return errorResponse(error, 403);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { bucket } = await context.params;
  if (!STORAGE_BUCKETS.has(bucket) || bucket === "robot-documentation-templates") {
    return errorResponse(new Error("Área de arquivos não disponível."), 404);
  }
  const session = await getAppSessionFromRequest(request);
  if (!session) return errorResponse(new Error("Sessão inválida ou expirada."), 401);
  try {
    const body = await request.json() as { from?: unknown; to?: unknown };
    if (typeof body.from !== "string" || typeof body.to !== "string") return errorResponse(new Error("Origem ou destino inválido."), 400);
    if (!await authorizeRobotFile(session, body.from, true) || !await authorizeRobotFile(session, body.to, true)) {
      return errorResponse(new Error("Sem permissão para copiar este arquivo."), 403);
    }
    const data = await copyStorageObject(bucket, body.from, body.to);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return errorResponse(error, 403);
  }
}
