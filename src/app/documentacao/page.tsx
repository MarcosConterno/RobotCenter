import { redirect } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";

import SystemDocumentation from "@/components/documentation/SystemDocumentation";
import { createClient } from "@/lib/supabase/server";

function roleCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(roleCodes);
  return value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string" ? [value.codigo] : [];
}

export default async function DocumentationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignments } = await supabase.from("user_roles").select("roles(codigo)").eq("user_id", user.id);
  const assignedRoles = new Set(assignments?.flatMap((item) => roleCodes(item.roles)) ?? []);
  const canViewDocumentation = assignedRoles.has("master") || assignedRoles.has("admin");
  if (!canViewDocumentation) redirect("/minha-pagina");

  const files = {
    readme: "README.md",
    architecture: "ARCHITECTURE.md",
    database: "docs/modelagem-banco.md",
    domain: "docs/dominio.md",
    rules: "docs/regras-negocio.md",
    permissions: "docs/permissoes.md",
    usersApi: "docs/api-usuarios.md",
    flowsApi: "docs/api-fluxos.md",
    personalApi: "docs/api-minha-pagina.md",
    versionsApi: "docs/api-versoes-robos.md",
    robotDocumentationApi: "docs/api-documentacao-robot-center.md",
  } as const;
  const entries = await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await readFile(path.join(process.cwd(), file), "utf8")] as const));

  const sources = Object.fromEntries(entries) as Record<keyof typeof files, string>;

  return <SystemDocumentation sources={sources} />;
}
