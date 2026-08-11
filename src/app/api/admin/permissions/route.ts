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

const createRoleSchema = z.object({
  name: z.string().trim().min(3).max(60),
  description: z.string().trim().max(240).nullable().optional(),
});

function roleCodeFromName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

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

export async function POST(request: Request) {
  const access = await getAccess();
  if (!access.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.isAdmin) return NextResponse.json({ error: "Acesso exclusivo de administradores." }, { status: 403 });

  const parsed = createRoleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe um nome válido para o perfil." }, { status: 400 });

  const codigo = roleCodeFromName(parsed.data.name);
  if (!codigo || ["master", "admin"].includes(codigo)) {
    return NextResponse.json({ error: "Este nome de perfil é reservado." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("roles").select("id").eq("codigo", codigo).maybeSingle();
  if (existing) return NextResponse.json({ error: "Já existe um perfil com este nome." }, { status: 409 });

  const { data: role, error } = await admin.from("roles").insert({
    codigo,
    nome: parsed.data.name,
    descricao: parsed.data.description ?? null,
    ativo: true,
  }).select("id,codigo,nome,descricao").single();
  if (error || !role) return NextResponse.json({ error: error?.message ?? "Não foi possível criar o perfil." }, { status: 400 });

  return NextResponse.json({ role }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
