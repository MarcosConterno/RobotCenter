import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const packagePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;
const versionPattern = /^[0-9a-z][0-9a-z._+-]*$/i;

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
  let version = "";
  try {
    const body = await request.json() as { packageName?: unknown; version?: unknown };
    packageName = typeof body.packageName === "string" ? body.packageName.trim() : "";
    version = typeof body.version === "string" ? body.version.trim() : "";
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (!packagePattern.test(packageName) || version.length > 100 || !versionPattern.test(version)) {
    return NextResponse.json({ error: "Pacote ou versão inválidos." }, { status: 400 });
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
