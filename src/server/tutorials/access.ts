import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function relationObjects(value: unknown): Array<{ id: string; codigo: string }> {
  if (Array.isArray(value)) return value.flatMap(relationObjects);
  if (value && typeof value === "object" && "id" in value && "codigo" in value && typeof value.id === "string" && typeof value.codigo === "string") {
    return [{ id: value.id, codigo: value.codigo }];
  }
  return [];
}

function permissionCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(permissionCodes);
  if (value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string") return [value.codigo];
  return [];
}

export async function getTutorialAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, roles: [] as string[], roleIds: [] as string[], permissions: [] as string[], canManage: false, isMaster: false };

  const admin = createAdminClient();
  const { data: assignments } = await admin.from("user_roles").select("roles(id,codigo)").eq("user_id", user.id);
  const roleItems = assignments?.flatMap((item) => relationObjects(item.roles)) ?? [];
  const roleIds = [...new Set(roleItems.map((role) => role.id))];
  const roles = [...new Set(roleItems.map((role) => role.codigo))];
  const { data: mappings } = roleIds.length
    ? await admin.from("role_permissions").select("permissions(codigo)").in("role_id", roleIds)
    : { data: [] };
  const permissions = [...new Set(mappings?.flatMap((item) => permissionCodes(item.permissions)) ?? [])];
  const isMaster = roles.includes("master");
  return { supabase, user, roles, roleIds, permissions, isMaster, canManage: isMaster || permissions.includes("tutorials.manage") };
}
