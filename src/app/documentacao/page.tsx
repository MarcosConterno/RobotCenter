import { redirect } from "next/navigation";

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
  const isMaster = assignments?.some((item) => roleCodes(item.roles).includes("master")) ?? false;
  if (!isMaster) redirect("/minha-pagina");

  return <SystemDocumentation />;
}
