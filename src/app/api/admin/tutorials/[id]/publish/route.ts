import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTutorialAccess } from "@/server/tutorials/access";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getTutorialAccess();
  if (!access.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.canManage) return NextResponse.json({ error: "Sem permissão para publicar tutoriais." }, { status: 403 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Tutorial inválido." }, { status: 400 });
  const admin = createAdminClient();
  const { data: draft } = await admin.from("tutorial_drafts").select("id").eq("tutorial_id", id).maybeSingle();
  const { count } = draft ? await admin.from("tutorial_steps").select("id", { count: "exact", head: true }).eq("draft_id", draft.id).eq("habilitado", true) : { count: 0 };
  if (!count) return NextResponse.json({ error: "Adicione ao menos um passo habilitado antes de publicar." }, { status: 400 });
  const { data, error } = await access.supabase.rpc("publish_tutorial", { target_tutorial_id: id });
  if (error || !data?.[0]) return NextResponse.json({ error: error?.message ?? "Não foi possível publicar." }, { status: 400 });
  return NextResponse.json({ version: data[0].version_number });
}
