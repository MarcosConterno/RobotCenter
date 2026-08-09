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
  clientId: z.string().uuid().nullable().optional(),
}).refine((data) => data.tipo !== "Cliente" || Boolean(data.clientId), {
  message: "O perfil Cliente exige a seleção de um cliente.",
  path: ["clientId"],
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  login: z.string().trim().min(1, "Login é obrigatório."),
  email: z.string().trim().email("Informe um email válido."),
  tipo: z.enum(TIPOS_USUARIO),
  clientId: z.string().uuid().nullable().optional(),
}).refine((data) => data.tipo !== "Cliente" || Boolean(data.clientId), {
  message: "O perfil Cliente exige a seleção de um cliente.",
  path: ["clientId"],
});

const deleteUserSchema = z.object({ id: z.string().uuid() });

function roleName(roleRelation: unknown) {
  if (Array.isArray(roleRelation)) {
    return roleRelation.some(
      (role) => typeof role === "object" && role !== null && "codigo" in role && (role.codigo === "admin" || role.codigo === "master"),
    );
  }

  return Boolean(
    typeof roleRelation === "object"
      && roleRelation !== null
      && "codigo" in roleRelation
      && (roleRelation.codigo === "admin" || roleRelation.codigo === "master"),
  );
}

function roleCodes(roleRelation: unknown): string[] {
  if (Array.isArray(roleRelation)) return roleRelation.flatMap(roleCodes);
  if (roleRelation && typeof roleRelation === "object" && "codigo" in roleRelation && typeof roleRelation.codigo === "string") return [roleRelation.codigo];
  return [];
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Sessão inválida.", status: 401 } as const;

  const { data: userRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("roles(codigo)")
    .eq("user_id", user.id);
  const isAdmin = !rolesError && userRoles?.some((item) => roleName(item.roles));
  if (!isAdmin) return { error: "Somente administradores podem gerenciar usuários.", status: 403 } as const;
  const isMaster = userRoles?.some((item) => roleCodes(item.roles).includes("master")) ?? false;
  return { user, isMaster } as const;
}

export async function GET() {
  const access = await requireAdmin();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const [{ data: authData, error: authListError }, { data: profiles, error: profilesError }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("profiles")
      .select("id, login, cliente_id, user_roles:user_roles!user_roles_user_id_fkey(roles(codigo))")
      .is("deleted_at", null)
      .eq("ativo", true),
  ]);

  if (authListError || profilesError) {
    console.error("[api/admin/users] list failed", {
      auth: authListError ? { name: authListError.name, status: authListError.status } : null,
      profiles: profilesError ? { code: profilesError.code, message: profilesError.message } : null,
    });
    return NextResponse.json({ error: "Não foi possível listar os usuários." }, { status: 500 });
  }

  const emailById = new Map<string, string>(
    authData.users.map((user): [string, string] => [user.id, user.email ?? ""]),
  );
  const users = (profiles ?? []).map((profile) => {
    const assignments = profile.user_roles as unknown as Array<{ roles: { codigo?: string } | Array<{ codigo?: string }> | null }>;
    const codes = assignments?.flatMap((assignment) => Array.isArray(assignment.roles) ? assignment.roles : [assignment.roles]).filter(Boolean).flatMap(roleCodes) ?? [];
    const code = codes.find((item) => TIPOS_USUARIO.some((type) => type.toLowerCase() === item));
    const tipo = TIPOS_USUARIO.find((item) => item.toLowerCase() === code) ?? "Operador";
    return { id: profile.id, login: profile.login, email: emailById.get(profile.id) ?? "", tipo, clienteId: profile.cliente_id, isMaster: codes.includes("master") };
  });

  return NextResponse.json({ users, currentUserId: access.user.id }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = createUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { login, email, password, tipo, clientId = null } = parsed.data;
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

  if (clientId) {
    const { data: client, error: clientError } = await admin
      .from("clientes")
      .select("id")
      .eq("id", clientId)
      .is("deleted_at", null)
      .maybeSingle();
    if (clientError || !client) {
      return NextResponse.json({ error: "Cliente não encontrado ou arquivado." }, { status: 400 });
    }
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
    .update({ login, cliente_id: clientId })
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
    { id: userId, login, email, tipo, clienteId: clientId },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const admin = createAdminClient();
  const { id, login, email, tipo, clientId = null } = parsed.data;
  const { data: masterRole } = await admin.from("roles").select("id").eq("codigo", "master").maybeSingle();
  const { count: targetMasterRoles } = masterRole
    ? await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("user_id", id).eq("role_id", masterRole.id)
    : { count: 0 };
  const targetIsMaster = Boolean(targetMasterRoles);
  if (targetIsMaster && !access.isMaster) return NextResponse.json({ error: "Somente Master pode alterar o usuário Master." }, { status: 403 });
  if (targetIsMaster && tipo !== "Admin") return NextResponse.json({ error: "O usuário Master deve manter também o perfil Admin." }, { status: 400 });
  const { data: role, error: roleError } = await admin.from("roles").select("id").eq("codigo", tipo.toLowerCase()).eq("ativo", true).single();
  if (roleError || !role) return NextResponse.json({ error: "Papel de usuário não encontrado." }, { status: 400 });

  if (clientId) {
    const { data: client, error: clientError } = await admin
      .from("clientes")
      .select("id")
      .eq("id", clientId)
      .is("deleted_at", null)
      .maybeSingle();
    if (clientError || !client) return NextResponse.json({ error: "Cliente não encontrado ou arquivado." }, { status: 400 });
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, { email });
  if (authUpdateError) return NextResponse.json({ error: "Não foi possível atualizar o email." }, { status: 400 });
  let profileError: unknown = null;
  let removeRoleError: unknown = null;
  let addRoleError: unknown = null;
  if (tipo === "Cliente") {
    ({ error: profileError } = await admin.from("profiles").update({ login, cliente_id: clientId }).eq("id", id).is("deleted_at", null));
    if (!profileError) {
      let removeQuery = admin.from("user_roles").delete().eq("user_id", id);
      if (masterRole) removeQuery = removeQuery.neq("role_id", masterRole.id);
      ({ error: removeRoleError } = await removeQuery);
    }
    if (!profileError && !removeRoleError) ({ error: addRoleError } = await admin.from("user_roles").insert({ user_id: id, role_id: role.id }));
  } else {
    let removeQuery = admin.from("user_roles").delete().eq("user_id", id);
    if (masterRole) removeQuery = removeQuery.neq("role_id", masterRole.id);
    ({ error: removeRoleError } = await removeQuery);
    if (!removeRoleError) ({ error: addRoleError } = await admin.from("user_roles").insert({ user_id: id, role_id: role.id }));
    if (!removeRoleError && !addRoleError) ({ error: profileError } = await admin.from("profiles").update({ login, cliente_id: clientId }).eq("id", id).is("deleted_at", null));
  }
  if (profileError) return NextResponse.json({ error: "Não foi possível atualizar o perfil e o cliente vinculado." }, { status: 400 });
  if (removeRoleError) return NextResponse.json({ error: "Não foi possível substituir o papel atual do usuário." }, { status: 500 });
  if (addRoleError) return NextResponse.json({ error: "Não foi possível atualizar o papel do usuário." }, { status: 500 });

  return NextResponse.json({ id, login, email, tipo, clienteId: clientId });
}

export async function DELETE(request: Request) {
  const access = await requireAdmin();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = deleteUserSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
  if (parsed.data.id === access.user.id) return NextResponse.json({ error: "Você não pode excluir o próprio usuário." }, { status: 400 });

  const admin = createAdminClient();
  const { data: masterRole } = await admin.from("roles").select("id").eq("codigo", "master").maybeSingle();
  if (masterRole) {
    const { count } = await admin.from("user_roles").select("user_id", { count: "exact", head: true })
      .eq("user_id", parsed.data.id).eq("role_id", masterRole.id);
    if (count) return NextResponse.json({ error: "O usuário Master não pode ser excluído." }, { status: 403 });
  }
  const now = new Date().toISOString();
  const { error: profileError } = await admin.from("profiles").update({ ativo: false, deleted_at: now, deleted_by: access.user.id }).eq("id", parsed.data.id).is("deleted_at", null);
  if (profileError) return NextResponse.json({ error: "Não foi possível excluir o perfil." }, { status: 400 });

  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data.id, { ban_duration: "876000h" });
  if (authError) return NextResponse.json({ error: "Perfil excluído, mas o acesso não pôde ser bloqueado." }, { status: 500 });
  return NextResponse.json({ success: true });
}
