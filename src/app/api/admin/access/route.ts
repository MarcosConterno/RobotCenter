import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

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

export async function GET() {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (authError || !userId) {
    return NextResponse.json({ allowed: false, error: "Sessão inválida." }, { status: 401 });
  }

  const { data: userRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("roles(id,codigo)")
    .eq("user_id", userId);

  if (rolesError) {
    console.error("[api/admin/access] role lookup failed", { code: rolesError.code, message: rolesError.message });
    return NextResponse.json({ allowed: false, error: "Não foi possível validar as permissões." }, { status: 500 });
  }

  const roles = [...new Set(userRoles?.flatMap((item) => extractRoleCodes(item.roles)) ?? [])];
  const roleIds = [...new Set(userRoles?.flatMap((item) => extractRoleIds(item.roles)) ?? [])];
  const { data: permissionMappings } = roleIds.length
    ? await supabase.from("role_permissions").select("permissions(codigo)").in("role_id", roleIds)
    : { data: [] };
  const permissions = [...new Set(permissionMappings?.flatMap((item) => extractPermissionCodes(item.permissions)) ?? [])];
  const isMaster = roles.includes("master");
  const { data: profile } = await supabase
    .from("profiles")
    .select("cliente_id,login,pode_editar_robos_cliente")
    .eq("id", userId)
    .single();
  const email = typeof claims.email === "string" ? claims.email : null;
  return NextResponse.json(
    {
      allowed: roles.includes("admin") || isMaster,
      userId,
      isMaster,
      roles,
      permissions,
      clientId: profile?.cliente_id ?? null,
      canEditClientRobots: profile?.pode_editar_robos_cliente === true,
      displayName: profile?.login ?? email ?? "Usuário",
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
