import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function roleCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(roleCodes);
  if (value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string") return [value.codigo];
  return [];
}

const permissionChangesSchema = z.object({
  changes: z.array(z.object({
    roleId: z.string().uuid(),
    permissionId: z.string().uuid(),
    enabled: z.boolean(),
  })).max(500),
});

async function getAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false, isMaster: false };

  const { data: assignments, error } = await supabase.from("user_roles")
    .select("roles(codigo)").eq("user_id", user.id);
  const codes = error ? [] : [...new Set(assignments?.flatMap((item) => roleCodes(item.roles)) ?? [])];
  return { supabase, user, isAdmin: codes.includes("admin") || codes.includes("master"), isMaster: codes.includes("master") };
}

export async function GET() {
  const { user, isAdmin, isMaster } = await getAccess();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Acesso exclusivo de administradores." }, { status: 403 });

  const admin = createAdminClient();
  const [{ data: roles, error: rolesError }, { data: permissions, error: permissionsError }, { data: mappings, error: mappingsError }] = await Promise.all([
    admin.from("roles").select("id,codigo,nome,descricao").eq("ativo", true).order("nome"),
    admin.from("permissions").select("id,codigo,recurso,acao,descricao").eq("ativo", true).order("recurso").order("acao"),
    admin.from("role_permissions").select("role_id,permission_id"),
  ]);
  if (rolesError || permissionsError || mappingsError) {
    return NextResponse.json({ error: "Não foi possível mapear papéis e permissões." }, { status: 500 });
  }

  const roleById = new Map((roles ?? []).map((role) => [role.id, role]));
  const roleCodesByPermission = new Map<string, string[]>();
  for (const mapping of mappings ?? []) {
    const role = roleById.get(mapping.role_id);
    if (!role) continue;
    const current = roleCodesByPermission.get(mapping.permission_id) ?? [];
    current.push(role.codigo);
    roleCodesByPermission.set(mapping.permission_id, current);
  }

  return NextResponse.json({
    isMaster,
    roles: roles ?? [],
    permissions: (permissions ?? []).map((permission) => ({
      ...permission,
      roles: roleCodesByPermission.get(permission.id) ?? [],
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const access = await getAccess();
  if (!access.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.isAdmin) return NextResponse.json({ error: "Acesso exclusivo de administradores." }, { status: 403 });

  const parsed = permissionChangesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Alterações de permissões inválidas." }, { status: 400 });
  if (!parsed.data.changes.length) return NextResponse.json({ success: true });

  const { error } = await access.supabase.rpc("update_role_permission_matrix", { change_set: parsed.data.changes });
  if (error) return NextResponse.json({ error: error.message || "Não foi possível salvar as permissões." }, { status: 400 });

  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
