import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTutorialAccess } from "@/server/tutorials/access";
import { findTourPage, findTourTarget } from "@/tutorial/targetCatalog";

type SnapshotStep = { id?: string; order?: number; pageKey?: string; targetKey?: string; title?: string; description?: string; placement?: string; conditionKey?: string | null; enabled?: boolean };

export async function GET() {
  const access = await getTutorialAccess();
  if (!access.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.roleIds.length) return NextResponse.json({ tutorial: null });
  const admin = createAdminClient();
  const [{ data: roles }, { data: tutorials }] = await Promise.all([
    admin.from("roles").select("id,codigo").in("id", access.roleIds),
    admin.from("tutorials").select("id,tutorial_key,nome,audience_role_id,current_version_id").eq("status", "published").in("audience_role_id", access.roleIds).not("current_version_id", "is", null).order("updated_at", { ascending: false }),
  ]);
  const roleById = new Map((roles ?? []).map((role) => [role.id, role.codigo]));
  const priority = ["master", "admin", "cliente", "operador", "suporte"];
  const tutorial = [...(tutorials ?? [])].sort((a, b) => priority.indexOf(roleById.get(a.audience_role_id) ?? "") - priority.indexOf(roleById.get(b.audience_role_id) ?? ""))[0];
  if (!tutorial?.current_version_id) return NextResponse.json({ tutorial: null });
  const { data: version } = await admin.from("tutorial_versions").select("version,snapshot").eq("id", tutorial.current_version_id).single();
  if (!version || !version.snapshot || typeof version.snapshot !== "object" || Array.isArray(version.snapshot)) return NextResponse.json({ tutorial: null });
  const snapshot = version.snapshot as Record<string, unknown>;
  const rawSteps = Array.isArray(snapshot.steps) ? snapshot.steps as SnapshotStep[] : [];
  const steps = rawSteps.flatMap((step, index) => {
    if (step.enabled === false || !step.pageKey || !step.targetKey || !step.title) return [];
    const page = findTourPage(step.pageKey);
    const target = findTourTarget(step.pageKey, step.targetKey);
    if (!page || !target) return [];
    return [{
      id: step.id ?? `${tutorial.id}-${index}`,
      route: page.route,
      targets: [target.selector],
      title: step.title,
      description: step.description ?? "",
      side: ["top", "right", "bottom", "left"].includes(step.placement ?? "") ? step.placement : "bottom",
      conditionKey: target.conditionKey ?? step.conditionKey ?? null,
    }];
  });
  return NextResponse.json({ tutorial: { id: tutorial.id, key: tutorial.tutorial_key, name: tutorial.nome, version: version.version, steps } }, { headers: { "Cache-Control": "no-store" } });
}
