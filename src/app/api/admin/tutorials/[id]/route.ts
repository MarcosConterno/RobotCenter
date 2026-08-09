import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getTutorialAccess } from "@/server/tutorials/access";
import { findTourPage, findTourTarget } from "@/tutorial/targetCatalog";

const stepSchema = z.object({
  pageKey: z.string().min(1), targetKey: z.string().min(1), title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(600), placement: z.enum(["top", "right", "bottom", "left"]),
  conditionKey: z.string().nullable().optional(), enabled: z.boolean(),
});
const saveSchema = z.object({ name: z.string().trim().min(3).max(120), audienceRoleId: z.string().uuid(), steps: z.array(stepSchema).max(30) });
const statusSchema = z.object({ status: z.enum(["published", "inactive"]) });

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getTutorialAccess();
  if (!access.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.canManage) return NextResponse.json({ error: "Sem permissão para gerenciar tutoriais." }, { status: 403 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Tutorial inválido." }, { status: 400 });

  const admin = createAdminClient();
  const { data: tutorial } = await admin.from("tutorials").select("id,tutorial_key,nome,audience_role_id,status,current_version_id").eq("id", id).maybeSingle();
  if (!tutorial) return NextResponse.json({ error: "Tutorial não encontrado." }, { status: 404 });
  const [{ data: role }, { data: draft }, { data: versions }] = await Promise.all([
    admin.from("roles").select("id,codigo,nome").eq("id", tutorial.audience_role_id).single(),
    admin.from("tutorial_drafts").select("id,revision").eq("tutorial_id", tutorial.id).single(),
    admin.from("tutorial_versions").select("id,version,published_at,published_by").eq("tutorial_id", tutorial.id).order("version", { ascending: false }),
  ]);
  if (!draft) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  const { data: steps } = await admin.from("tutorial_steps").select("id,page_key,target_key,titulo,descricao,placement,condition_key,habilitado,ordem").eq("draft_id", draft.id).order("ordem");
  const currentVersion = (versions ?? []).find((version) => version.id === tutorial.current_version_id);

  return NextResponse.json({ tutorial: {
    id: tutorial.id, key: tutorial.tutorial_key, name: tutorial.nome, status: tutorial.status,
    audienceRoleId: tutorial.audience_role_id, audienceRoleCode: role?.codigo ?? "", audienceRoleName: role?.nome ?? "Perfil",
    currentVersion: currentVersion?.version ?? null, draftRevision: draft.revision,
    steps: (steps ?? []).map((step) => ({ id: step.id, pageKey: step.page_key, targetKey: step.target_key, title: step.titulo, description: step.descricao, placement: step.placement, conditionKey: step.condition_key, enabled: step.habilitado })),
    versions: (versions ?? []).map((version) => ({ id: version.id, version: version.version, publishedAt: version.published_at, publishedBy: version.published_by })),
  } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getTutorialAccess();
  if (!access.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.canManage) return NextResponse.json({ error: "Sem permissão para gerenciar tutoriais." }, { status: 403 });
  const { id } = await context.params;
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ error: "Rascunho inválido." }, { status: 400 });
  const invalidTarget = parsed.data.steps.find((step) => !findTourPage(step.pageKey) || !findTourTarget(step.pageKey, step.targetKey));
  if (invalidTarget) return NextResponse.json({ error: `O target “${invalidTarget.targetKey}” não está registrado.` }, { status: 400 });

  const normalizedSteps = parsed.data.steps.map((step) => {
    const target = findTourTarget(step.pageKey, step.targetKey)!;
    return { ...step, conditionKey: target.conditionKey ?? step.conditionKey ?? null };
  });
  const { error } = await access.supabase.rpc("save_tutorial_draft", {
    target_tutorial_id: id, target_name: parsed.data.name, target_audience_role_id: parsed.data.audienceRoleId, target_steps: normalizedSteps,
  });
  if (error) return NextResponse.json({ error: error.message || "Não foi possível salvar o rascunho." }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getTutorialAccess();
  if (!access.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.canManage) return NextResponse.json({ error: "Sem permissão para gerenciar tutoriais." }, { status: 403 });
  const { id } = await context.params;
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  if (parsed.data.status === "published") {
    const { data: tutorial } = await access.supabase.from("tutorials").select("current_version_id").eq("id", id).maybeSingle();
    if (!tutorial?.current_version_id) return NextResponse.json({ error: "Publique uma versão antes de ativar o tutorial." }, { status: 400 });
  }
  const { error } = await access.supabase.from("tutorials").update({ status: parsed.data.status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message || "Não foi possível alterar o estado." }, { status: 400 });
  return NextResponse.json({ success: true });
}
