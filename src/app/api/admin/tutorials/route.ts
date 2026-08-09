import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getTutorialAccess } from "@/server/tutorials/access";

const createSchema = z.object({ name: z.string().trim().min(3).max(120), audienceRoleId: z.string().uuid() });

export async function GET() {
  const access = await getTutorialAccess();
  if (!access.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.canManage) return NextResponse.json({ error: "Sem permissão para gerenciar tutoriais." }, { status: 403 });

  const admin = createAdminClient();
  const [{ data: roles, error: rolesError }, { data: tutorials, error: tutorialsError }] = await Promise.all([
    admin.from("roles").select("id,codigo,nome").eq("ativo", true).order("nome"),
    admin.from("tutorials").select("id,tutorial_key,nome,audience_role_id,status,current_version_id,updated_at").order("updated_at", { ascending: false }),
  ]);
  if (rolesError || tutorialsError) return NextResponse.json({ error: "Não foi possível carregar os tutoriais." }, { status: 500 });

  const tutorialIds = (tutorials ?? []).map((tutorial) => tutorial.id);
  const [{ data: drafts }, { data: versions }] = tutorialIds.length ? await Promise.all([
    admin.from("tutorial_drafts").select("id,tutorial_id").in("tutorial_id", tutorialIds),
    admin.from("tutorial_versions").select("id,tutorial_id,version,published_at").in("tutorial_id", tutorialIds).order("version", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }];
  const draftIds = (drafts ?? []).map((draft) => draft.id);
  const { data: steps } = draftIds.length
    ? await admin.from("tutorial_steps").select("draft_id").in("draft_id", draftIds)
    : { data: [] };
  const rolesById = new Map((roles ?? []).map((role) => [role.id, role]));
  const draftByTutorial = new Map((drafts ?? []).map((draft) => [draft.tutorial_id, draft.id]));

  return NextResponse.json({
    roles: roles ?? [],
    tutorials: (tutorials ?? []).map((tutorial) => {
      const role = rolesById.get(tutorial.audience_role_id);
      const currentVersion = (versions ?? []).find((version) => version.id === tutorial.current_version_id);
      const draftId = draftByTutorial.get(tutorial.id);
      return {
        id: tutorial.id,
        key: tutorial.tutorial_key,
        name: tutorial.nome,
        audienceRoleId: tutorial.audience_role_id,
        audienceRoleCode: role?.codigo ?? "",
        audienceRoleName: role?.nome ?? "Perfil",
        status: tutorial.status,
        currentVersion: currentVersion?.version ?? null,
        stepCount: (steps ?? []).filter((step) => step.draft_id === draftId).length,
        updatedAt: tutorial.updated_at,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await getTutorialAccess();
  if (!access.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.canManage) return NextResponse.json({ error: "Sem permissão para gerenciar tutoriais." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados do tutorial inválidos." }, { status: 400 });

  const { data, error } = await access.supabase.rpc("create_tutorial", {
    target_name: parsed.data.name,
    target_audience_role_id: parsed.data.audienceRoleId,
  });
  if (error || !data?.[0]) return NextResponse.json({ error: error?.message ?? "Não foi possível criar o tutorial." }, { status: 400 });
  return NextResponse.json({ id: data[0].tutorial_id }, { status: 201 });
}
