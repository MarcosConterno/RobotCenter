import { redirect } from "next/navigation";

import SystemDocumentation from "@/components/documentation/SystemDocumentation";
import systemDocumentation from "@/generated/system-documentation";
import { createClient } from "@/lib/database/server";

function roleCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(roleCodes);
  return value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string" ? [value.codigo] : [];
}

export default async function DocumentationPage() {
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignments } = await database.from("user_roles").select("roles(codigo)").eq("user_id", user.id);
  const assignedRoles = new Set(assignments?.flatMap((item) => roleCodes(item.roles)) ?? []);
  const canViewDocumentation = assignedRoles.has("master") || assignedRoles.has("admin");
  if (!canViewDocumentation) redirect("/minha-pagina");

  return <SystemDocumentation sources={systemDocumentation} />;
}
