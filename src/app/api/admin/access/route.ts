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

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ allowed: false, error: "Sessão inválida." }, { status: 401 });
  }

  const { data: userRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("roles(codigo)")
    .eq("user_id", user.id);

  if (rolesError) {
    console.error("[api/admin/access] role lookup failed", { code: rolesError.code, message: rolesError.message });
    return NextResponse.json({ allowed: false, error: "Não foi possível validar as permissões." }, { status: 500 });
  }

  const roles = [...new Set(userRoles?.flatMap((item) => extractRoleCodes(item.roles)) ?? [])];
  const isMaster = roles.includes("master");
  const { data: profile } = await supabase
    .from("profiles")
    .select("cliente_id,login")
    .eq("id", user.id)
    .single();
  return NextResponse.json(
    { allowed: roles.includes("admin") || isMaster, isMaster, roles, clientId: profile?.cliente_id ?? null, displayName: profile?.login ?? user.email ?? "Usuário" },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
