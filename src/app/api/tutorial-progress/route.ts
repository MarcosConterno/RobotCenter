import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_KEY, ONBOARDING_VERSION, type TutorialProgress } from "@/tutorial/types";

const updateSchema = z.object({
  tutorialId: z.string().uuid().nullable().optional(),
  tutorialKey: z.string().trim().min(1).max(160).default(ONBOARDING_KEY),
  tutorialVersion: z.number().int().positive().default(ONBOARDING_VERSION),
  status: z.enum(["in_progress", "completed", "skipped"]),
  currentStep: z.number().int().min(0),
  restart: z.boolean().optional().default(false),
});

function mapProgress(row: {
  tutorial_key: string;
  tutorial_version: number;
  status: string;
  current_step: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
} | null) {
  return {
    tutorialKey: row?.tutorial_key ?? ONBOARDING_KEY,
    tutorialVersion: row?.tutorial_version ?? ONBOARDING_VERSION,
    status: (row?.status as TutorialProgress["status"] | undefined) ?? "not_started",
    currentStep: row?.current_step ?? 0,
    startedAt: row?.started_at ?? null,
    completedAt: row?.completed_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const url = new URL(request.url);
  const tutorialKey = url.searchParams.get("tutorialKey")?.trim() || ONBOARDING_KEY;
  const tutorialVersion = Number(url.searchParams.get("tutorialVersion") || ONBOARDING_VERSION);
  if (!Number.isInteger(tutorialVersion) || tutorialVersion < 1) return NextResponse.json({ error: "Versão inválida." }, { status: 400 });
  const { data, error } = await supabase
    .from("user_tutorial_progress")
    .select("tutorial_key,tutorial_version,status,current_step,started_at,completed_at,updated_at")
    .eq("user_id", user.id)
    .eq("tutorial_key", tutorialKey)
    .eq("tutorial_version", tutorialVersion)
    .maybeSingle();

  if (error) {
    console.error("[tutorial-progress] read failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Não foi possível carregar o tutorial." }, { status: 500 });
  }

  const progress = mapProgress(data);
  return NextResponse.json({ progress: { ...progress, tutorialKey, tutorialVersion } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Progresso inválido." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  if (parsed.data.tutorialId) {
    const { data: allowedTutorial } = await supabase.from("tutorials").select("id").eq("id", parsed.data.tutorialId).eq("status", "published").maybeSingle();
    if (!allowedTutorial) return NextResponse.json({ error: "Tutorial indisponível para este usuário." }, { status: 403 });
  }

  const { data: existing, error: readError } = await supabase
    .from("user_tutorial_progress")
    .select("started_at,completed_at")
    .eq("user_id", user.id)
    .eq("tutorial_key", parsed.data.tutorialKey)
    .eq("tutorial_version", parsed.data.tutorialVersion)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "Não foi possível validar o progresso." }, { status: 500 });

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_tutorial_progress")
    .upsert({
      user_id: user.id,
      tutorial_id: parsed.data.tutorialId ?? null,
      tutorial_key: parsed.data.tutorialKey,
      tutorial_version: parsed.data.tutorialVersion,
      status: parsed.data.status,
      current_step: parsed.data.currentStep,
      started_at: parsed.data.restart || !existing?.started_at ? now : existing.started_at,
      completed_at: parsed.data.status === "completed" ? now : parsed.data.restart || parsed.data.status === "in_progress" ? null : existing?.completed_at ?? null,
      updated_at: now,
    }, { onConflict: "user_id,tutorial_key,tutorial_version" })
    .select("tutorial_key,tutorial_version,status,current_step,started_at,completed_at,updated_at")
    .single();

  if (error) {
    console.error("[tutorial-progress] update failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Não foi possível salvar o progresso." }, { status: 500 });
  }

  return NextResponse.json({ progress: mapProgress(data) });
}
