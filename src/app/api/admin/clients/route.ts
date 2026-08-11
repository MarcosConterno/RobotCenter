import { NextResponse } from "next/server";
import { z } from "zod";

import { CORES_BADGE_ROBO } from "@/domain/entities";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const createClientSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório."),
  tenant: z.string().trim().min(1, "Tenant é obrigatório."),
  cor: z.enum(CORES_BADGE_ROBO),
});

function extractRoleCodes(roleRelation: unknown): string[] {
  if (Array.isArray(roleRelation)) return roleRelation.flatMap(extractRoleCodes);
  return roleRelation
    && typeof roleRelation === "object"
    && "codigo" in roleRelation
    && typeof roleRelation.codigo === "string"
    ? [roleRelation.codigo]
    : [];
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Sessão inválida.", status: 401 } as const;

  const { data: userRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("roles(codigo)")
    .eq("user_id", user.id);
  const roles = userRoles?.flatMap((item) => extractRoleCodes(item.roles)) ?? [];

  if (rolesError || (!roles.includes("admin") && !roles.includes("master"))) {
    return { error: "Somente administradores podem cadastrar clientes.", status: 403 } as const;
  }

  return { user } as const;
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const parsed = createClientSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { nome, tenant, cor } = parsed.data;
  const { data, error } = await admin
    .from("clientes")
    .insert({ nome, tenant, cor, created_by: access.user.id, updated_by: access.user.id })
    .select("id,nome,tenant,cor")
    .single();

  if (error) {
    console.error("[api/admin/clients] create failed", { code: error.code, message: error.message });
    const message = error.code === "23505"
      ? "Já existe um cliente ativo com esse tenant."
      : "Não foi possível cadastrar o cliente.";
    return NextResponse.json({ error: message }, { status: error.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json(data, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
