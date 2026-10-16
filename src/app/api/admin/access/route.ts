import { NextResponse } from "next/server";

import { createClient } from "@/lib/database/server";

function extractRoleCodes(roleRelation: unknown) {
  if (Array.isArray(roleRelation)) {
    return roleRelation.flatMap((role) => (
      typeof role === "object" && role !== null && "codigo" in role && typeof role.codigo === "string"
        ? [role.codigo]
        : []
    ));
  }

  return (
    typeof roleRelation === "object"
      && roleRelation !== null
      && "codigo" in roleRelation
      && typeof roleRelation.codigo === "string"
      ? [roleRelation.codigo]
      : []
  );
}

function extractRoleIds(roleRelation: unknown): string[] {
  if (Array.isArray(roleRelation)) return roleRelation.flatMap(extractRoleIds);
  return typeof roleRelation === "object" && roleRelation !== null && "id" in roleRelation && typeof roleRelation.id === "string" ? [roleRelation.id] : [];
}

function extractPermissionCodes(permissionRelation: unknown): string[] {
  if (Array.isArray(permissionRelation)) return permissionRelation.flatMap(extractPermissionCodes);
  return typeof permissionRelation === "object" && permissionRelation !== null && "codigo" in permissionRelation && typeof permissionRelation.codigo === "string" ? [permissionRelation.codigo] : [];
}

function asRows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function relationValue(row: unknown, property: string): unknown {
  if (typeof row !== "object" || row === null || !(property in row)) return undefined;
  return (row as Record<string, unknown>)[property];
}

export async function GET() {
  const database = await createClient();
  const { data, error: authError } = await database.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (authError || !userId) {
    return NextResponse.json({ allowed: false, error: "Sessão inválida." }, { status: 401 });
  }

  const { data: userRoles, error: rolesError } = await database
    .from("user_roles")
    .select("roles(id,codigo)")
    .eq("user_id", userId);

  if (rolesError) {
    console.error("[api/admin/access] role lookup failed", { code: rolesError.code, message: rolesError.message });
    return NextResponse.json({ allowed: false, error: "Não foi possível validar as permissões." }, { status: 500 });
  }

  const roleRows = asRows(userRoles);
  const roles = [...new Set(roleRows.flatMap((item) => extractRoleCodes(relationValue(item, "roles"))))];
  const roleIds = [...new Set(roleRows.flatMap((item) => extractRoleIds(relationValue(item, "roles"))))];
  const { data: permissionMappings, error: permissionsError } = roleIds.length
    ? await database.from("role_permissions").select("permissions(codigo)").in("role_id", roleIds)
    : { data: [], error: null };

  if (permissionsError) {
    console.error("[api/admin/access] permission lookup failed", { code: permissionsError.code, message: permissionsError.message });
    return NextResponse.json({ allowed: false, error: "Não foi possível validar as permissões." }, { status: 500 });
  }

  const permissions = [...new Set(asRows(permissionMappings).flatMap((item) => extractPermissionCodes(relationValue(item, "permissions"))))];
  const isMaster = roles.includes("master");
  const { data: profile } = await database
    .from("profiles")
    .select("cliente_id,login,pode_editar_robos_cliente")
    .eq("id", userId)
    .single();
  const profileClientId = relationValue(profile, "cliente_id");
  const profileCanEditRobots = relationValue(profile, "pode_editar_robos_cliente");
  const profileLogin = relationValue(profile, "login");
  const email = typeof claims.email === "string" ? claims.email : null;
  return NextResponse.json(
    {
      allowed: roles.includes("admin") || isMaster,
      userId,
      isMaster,
      roles,
      permissions,
      clientId: typeof profileClientId === "string" ? profileClientId : null,
      canEditClientRobots: profileCanEditRobots === true,
      displayName: typeof profileLogin === "string" ? profileLogin : email ?? "Usuário",
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
