import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BudgetsPage from "@/components/budgets/BudgetsPage";

function roleCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(roleCodes);
  return value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string" ? [value.codigo] : [];
}

export default async function BudgetsRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/orcamentos");
  const { data: assignments } = await supabase.from("user_roles").select("roles(codigo)").eq("user_id", user.id);
  const roles = new Set(assignments?.flatMap((item) => roleCodes(item.roles)) ?? []);
  if (!roles.has("master") && !roles.has("admin")) redirect("/minha-pagina");
  return <BudgetsPage />;
}
