import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function isAdminRole(roleRelation: unknown) {
  if (Array.isArray(roleRelation)) {
    return roleRelation.some(
      (role) => typeof role === "object" && role !== null && "codigo" in role && role.codigo === "admin",
    );
  }

  return Boolean(
    typeof roleRelation === "object"
      && roleRelation !== null
      && "codigo" in roleRelation
      && roleRelation.codigo === "admin",
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

  const allowed = userRoles?.some((item) => isAdminRole(item.roles)) ?? false;
  return NextResponse.json(
    { allowed },
    { status: allowed ? 200 : 403, headers: { "Cache-Control": "no-store" } },
  );
}
