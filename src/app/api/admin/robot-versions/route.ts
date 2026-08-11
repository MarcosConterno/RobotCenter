import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const packagePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;
const versionPattern = /^[0-9a-z][0-9a-z._+-]*$/i;
const notionApiVersion = "2026-03-11";

interface NotionRichTextItem { plain_text?: unknown }
interface NotionPage {
  properties?: Record<string, { rich_text?: NotionRichTextItem[] }>;
}

let notionDataSourceIdPromise: Promise<string> | undefined;

async function resolveNotionDataSourceId(token: string) {
  const configuredDataSourceId = process.env.NOTION_DATA_SOURCE_ID?.trim();
  if (configuredDataSourceId) return configuredDataSourceId;

  const databaseId = process.env.NOTION_DATABASE_ID?.trim();
  if (!databaseId) throw new Error("notion-not-configured");

  notionDataSourceIdPromise ??= (async () => {
    const response = await fetch(`https://api.notion.com/v1/databases/${encodeURIComponent(databaseId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": notionApiVersion,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error("[api/admin/robot-versions] notion database lookup failed", { status: response.status });
      throw new Error(response.status === 401 || response.status === 403 ? "notion-unauthorized" : "notion-database-unavailable");
    }

    const payload = await response.json() as { data_sources?: Array<{ id?: unknown }> };
    const ids = (payload.data_sources ?? []).flatMap((source) => typeof source.id === "string" && source.id.trim() ? [source.id.trim()] : []);
    const [dataSourceId] = ids;
    if (!dataSourceId) throw new Error("notion-data-source-not-found");
    if (ids.length > 1) throw new Error("notion-multiple-data-sources");
    return dataSourceId;
  })();

  try {
    return await notionDataSourceIdPromise;
  } catch (error) {
    notionDataSourceIdPromise = undefined;
    throw error;
  }
}

async function getNotionPackageVersion(packageName: string) {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) throw new Error("notion-not-configured");
  const dataSourceId = await resolveNotionDataSourceId(token);

  const response = await fetch(`https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": notionApiVersion,
    },
    body: JSON.stringify({
      filter: { property: "Pacote", select: { equals: packageName } },
      page_size: 100,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    console.error("[api/admin/robot-versions] notion query failed", { status: response.status });
    throw new Error(response.status === 401 || response.status === 403 ? "notion-unauthorized" : "notion-unavailable");
  }

  const payload = await response.json() as { results?: NotionPage[] };
  const versions = [...new Set((payload.results ?? []).flatMap((page) => {
    const value = page.properties?.["Ult. Vers"]?.rich_text?.[0]?.plain_text;
    return typeof value === "string" && value.trim() ? [value.trim()] : [];
  }))];

  if (!versions.length) throw new Error("package-not-found");
  if (versions.length > 1) throw new Error("ambiguous-version");
  const version = versions[0];
  if (version.length > 100 || !versionPattern.test(version)) throw new Error("invalid-version");
  return version;
}

function roleCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(roleCodes);
  return value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string"
    ? [value.codigo]
    : [];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: assignments, error: rolesError } = await supabase
    .from("user_roles")
    .select("roles(codigo)")
    .eq("user_id", user.id);
  if (rolesError) {
    console.error("[api/admin/robot-versions] role lookup failed", { code: rolesError.code, message: rolesError.message });
    return NextResponse.json({ error: "Não foi possível validar as permissões." }, { status: 500 });
  }
  const roles = [...new Set(assignments?.flatMap((item) => roleCodes(item.roles)) ?? [])];
  if (!roles.includes("admin") && !roles.includes("master")) {
    return NextResponse.json({ error: "Acesso exclusivo de administradores." }, { status: 403 });
  }

  let packageName = "";
  try {
    const body = await request.json() as { packageName?: unknown };
    packageName = typeof body.packageName === "string" ? body.packageName.trim() : "";
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (!packagePattern.test(packageName)) {
    return NextResponse.json({ error: "Pacote inválido." }, { status: 400 });
  }

  let version: string;
  try {
    version = await getNotionPackageVersion(packageName);
  } catch (error) {
    const code = error instanceof Error ? error.message : "notion-unavailable";
    const messages: Record<string, { message: string; status: number }> = {
      "notion-not-configured": { message: "A integração com o Notion não está configurada no servidor.", status: 503 },
      "notion-unauthorized": { message: "O Notion recusou a integração. Verifique o token e o compartilhamento da base.", status: 502 },
      "notion-database-unavailable": { message: "Não foi possível localizar o database configurado no Notion.", status: 502 },
      "notion-data-source-not-found": { message: "O database do Notion não possui uma fonte de dados acessível.", status: 404 },
      "notion-multiple-data-sources": { message: "O database possui mais de uma fonte de dados. Configure NOTION_DATA_SOURCE_ID.", status: 409 },
      "package-not-found": { message: "Pacote não encontrado no Notion ou sem valor em Ult. Vers.", status: 404 },
      "ambiguous-version": { message: "O pacote possui versões diferentes no Notion.", status: 409 },
      "invalid-version": { message: "A versão cadastrada no Notion é inválida.", status: 422 },
    };
    const failure = messages[code] ?? { message: "Não foi possível consultar o Notion.", status: 502 };
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }

  const { data: robots, error: selectError } = await supabase
    .from("robos")
    .select("id,versao")
    .eq("pacote", packageName)
    .is("deleted_at", null);
  if (selectError) {
    console.error("[api/admin/robot-versions] robot lookup failed", { code: selectError.code, message: selectError.message });
    return NextResponse.json({ error: "Não foi possível localizar os robôs do pacote." }, { status: 500 });
  }
  if (!robots?.length) return NextResponse.json({ error: "Nenhum robô encontrado para este pacote." }, { status: 404 });

  const checkedAt = new Date().toISOString();
  const changedRobots = robots.filter((robot) => robot.versao !== version).length;
  const { error: updateError } = await supabase
    .from("robos")
    .update({ versao: version, version_checked_at: checkedAt })
    .eq("pacote", packageName)
    .is("deleted_at", null);
  if (updateError) {
    console.error("[api/admin/robot-versions] update failed", { code: updateError.code, message: updateError.message });
    return NextResponse.json({ error: "Não foi possível atualizar os robôs deste pacote." }, { status: 500 });
  }

  return NextResponse.json({
    packageName,
    version,
    checkedAt,
    robots: robots.length,
    changedRobots,
    status: changedRobots > 0 ? "updated" : "unchanged",
  }, { headers: { "Cache-Control": "no-store" } });
}
