import { NextResponse } from "next/server";
import { z } from "zod";

import { TIPOS_USUARIO } from "@/domain/entities";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const createUserSchema = z.object({
  login: z.string().trim().min(1, "Login é obrigatório."),
  email: z.string().trim().email("Informe um email válido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  tipo: z.enum(TIPOS_USUARIO),
});

function roleName(roleRelation: unknown) {
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: userRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("roles(codigo)")
    .eq("user_id", user.id);

  const isAdmin = !rolesError && userRoles?.some((item) => roleName(item.roles));

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Somente administradores podem cadastrar usuários." },
      { status: 403 },
    );
  }

  const parsed = createUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { login, email, password, tipo } = parsed.data;
  const roleCode = tipo.toLowerCase();

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("codigo", roleCode)
    .eq("ativo", true)
    .single();

  if (roleError || !role) {
    return NextResponse.json({ error: "Papel de usuário não encontrado." }, { status: 400 });
  }

  if (roleCode === "cliente") {
    return NextResponse.json(
      { error: "O cadastro de usuário Cliente exige a seleção de um cliente." },
      { status: 400 },
    );
  }

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !createdUser.user) {
    const duplicate = createError?.message.toLowerCase().includes("already");
    return NextResponse.json(
      { error: duplicate ? "Já existe um usuário com esse email." : "Não foi possível criar o usuário." },
      { status: 400 },
    );
  }

  const userId = createdUser.user.id;
  const { error: profileError } = await admin
    .from("profiles")
    .update({ login })
    .eq("id", userId);

  const { error: assignmentError } = profileError
    ? { error: profileError }
    : await admin.from("user_roles").insert({ user_id: userId, role_id: role.id });

  if (assignmentError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: "O usuário não pôde ser associado ao perfil selecionado." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { id: userId, login, email, tipo },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
