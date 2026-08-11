import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const createUserSchema = z.object({
  login: z.string().trim().min(1, "Login é obrigatório."),
  email: z.string().trim().email("Informe um email válido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  tipo: z.string().trim().min(1).max(60),
  clientId: z.string().uuid().nullable().optional(),
  canEditClientRobots: z.boolean().optional().default(false),
}).refine((data) => data.tipo !== "Cliente" || Boolean(data.clientId), {
  message: "O perfil Cliente exige a seleção de um cliente.",
  path: ["clientId"],
}).refine((data) => !data.canEditClientRobots || data.tipo === "Cliente", {
  message: "A edição de robôs só pode ser liberada para usuários Cliente.",
  path: ["canEditClientRobots"],
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  login: z.string().trim().min(1, "Login é obrigatório."),
  email: z.string().trim().email("Informe um email válido."),
  tipo: z.string().trim().min(1).max(60),
  clientId: z.string().uuid().nullable().optional(),
  canEditClientRobots: z.boolean().optional().default(false),
}).refine((data) => data.tipo !== "Cliente" || Boolean(data.clientId), {
  message: "O perfil Cliente exige a seleção de um cliente.",
  path: ["clientId"],
}).refine((data) => !data.canEditClientRobots || data.tipo === "Cliente", {
  message: "A edição de robôs só pode ser liberada para usuários Cliente.",
  path: ["canEditClientRobots"],
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

function roleCodeFromName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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
      .select("id, login, cliente_id, pode_editar_robos_cliente, user_roles:user_roles!user_roles_user_id_fkey(roles(codigo,nome))")
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
    const assignments = profile.user_roles as unknown as Array<{ roles: { codigo?: string; nome?: string } | Array<{ codigo?: string; nome?: string }> | null }>;
    const codes = assignments?.flatMap((assignment) => Array.isArray(assignment.roles) ? assignment.roles : [assignment.roles]).filter(Boolean).flatMap(roleCodes) ?? [];
    const assignedRole = assignments?.flatMap((assignment) => Array.isArray(assignment.roles) ? assignment.roles : [assignment.roles]).find((role) => role && role.codigo !== "master");
    const tipo = assignedRole?.nome ?? "Operador";
    return { id: profile.id, login: profile.login, email: emailById.get(profile.id) ?? "", tipo, clienteId: profile.cliente_id, podeEditarRobosCliente: profile.pode_editar_robos_cliente, isMaster: codes.includes("master") };
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
  const { login, email, password, tipo, clientId = null, canEditClientRobots } = parsed.data;
  const roleCode = roleCodeFromName(tipo);

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
    .update({ login, cliente_id: clientId, pode_editar_robos_cliente: tipo === "Cliente" && canEditClientRobots })
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
    { id: userId, login, email, tipo, clienteId: clientId, podeEditarRobosCliente: tipo === "Cliente" && canEditClientRobots },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const admin = createAdminClient();
  const { id, login, email, tipo, clientId = null, canEditClientRobots } = parsed.data;
  const podeEditarRobosCliente = tipo === "Cliente" && canEditClientRobots;
  const { data: masterRole } = await admin.from("roles").select("id").eq("codigo", "master").maybeSingle();
  const { count: targetMasterRoles } = masterRole
    ? await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("user_id", id).eq("role_id", masterRole.id)
    : { count: 0 };
  const targetIsMaster = Boolean(targetMasterRoles);
  if (targetIsMaster && !access.isMaster) return NextResponse.json({ error: "Somente Master pode alterar o usuário Master." }, { status: 403 });
  if (targetIsMaster && tipo !== "Admin") return NextResponse.json({ error: "O usuário Master deve manter também o perfil Admin." }, { status: 400 });
  const { data: role, error: roleError } = await admin.from("roles").select("id").eq("codigo", roleCodeFromName(tipo)).eq("ativo", true).single();
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
    ({ error: profileError } = await admin.from("profiles").update({ login, cliente_id: clientId, pode_editar_robos_cliente: podeEditarRobosCliente }).eq("id", id).is("deleted_at", null));
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
    if (!removeRoleError && !addRoleError) ({ error: profileError } = await admin.from("profiles").update({ login, cliente_id: clientId, pode_editar_robos_cliente: false }).eq("id", id).is("deleted_at", null));
  }
  if (profileError) return NextResponse.json({ error: "Não foi possível atualizar o perfil e o cliente vinculado." }, { status: 400 });
  if (removeRoleError) return NextResponse.json({ error: "Não foi possível substituir o papel atual do usuário." }, { status: 500 });
  if (addRoleError) return NextResponse.json({ error: "Não foi possível atualizar o papel do usuário." }, { status: 500 });

  return NextResponse.json({ id, login, email, tipo, clienteId: clientId, podeEditarRobosCliente });
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
  const { data: targetProfile, error: targetProfileError } = await admin
    .from("profiles")
    .select("id,deleted_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (targetProfileError) return NextResponse.json({ error: "Não foi possível validar o perfil do usuário." }, { status: 400 });
  if (!targetProfile) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  const now = new Date().toISOString();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ ativo: false, deleted_at: targetProfile.deleted_at ?? now, deleted_by: access.user.id })
    .eq("id", parsed.data.id);
  if (profileError) return NextResponse.json({ error: "Não foi possível excluir o perfil." }, { status: 400 });

  const { error: rolesError } = await admin.from("user_roles").delete().eq("user_id", parsed.data.id);
  if (rolesError) return NextResponse.json({ error: "Perfil arquivado, mas os acessos não puderam ser removidos." }, { status: 500 });

  const { error: authError } = await admin.auth.admin.deleteUser(parsed.data.id, true);
  if (authError) return NextResponse.json({ error: `Perfil arquivado, mas a identidade de acesso não pôde ser removida: ${authError.message}` }, { status: 500 });
  return NextResponse.json({ success: true });
}
