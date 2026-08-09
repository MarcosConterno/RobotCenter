import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function roleCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(roleCodes);
  if (value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string") return [value.codigo];
  return [];
}

interface ClientMetric {
  clientId: string;
  robots: number;
  flows: number;
  documents: number;
  updatedAt: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: assignments, error: rolesError } = await supabase.from("user_roles")
    .select("roles(codigo)")
    .eq("user_id", user.id);
  const roles = rolesError ? [] : [...new Set(assignments?.flatMap((item) => roleCodes(item.roles)) ?? [])];
  if (!roles.includes("admin") && !roles.includes("master")) {
    return NextResponse.json({ error: "Acesso exclusivo de administradores." }, { status: 403 });
  }

  const admin = createAdminClient();
  const [clientsResult, robotsResult, flowsResult, documentsResult] = await Promise.all([
    admin.from("clientes").select("id,updated_at").is("deleted_at", null),
    admin.from("robos").select("id,cliente_id,manual_path,updated_at").is("deleted_at", null),
    admin.from("flows").select("id,client_id,updated_at"),
    admin.from("robot_center_documentations").select("id,robo_id,updated_at").is("deleted_at", null),
  ]);

  const queryError = clientsResult.error || robotsResult.error || flowsResult.error || documentsResult.error;
  if (queryError) {
    console.error("[api/admin/client-metrics] query failed", { code: queryError.code, message: queryError.message });
    return NextResponse.json({ error: "Não foi possível calcular os indicadores dos clientes." }, { status: 500 });
  }

  const metrics = new Map<string, ClientMetric>();
  const robotClient = new Map<string, string>();
  const updateTimestamp = (metric: ClientMetric, timestamp: string) => {
    if (new Date(timestamp).getTime() > new Date(metric.updatedAt).getTime()) metric.updatedAt = timestamp;
  };

  for (const client of clientsResult.data ?? []) {
    metrics.set(client.id, { clientId: client.id, robots: 0, flows: 0, documents: 0, updatedAt: client.updated_at });
  }
  for (const robot of robotsResult.data ?? []) {
    const metric = metrics.get(robot.cliente_id);
    if (!metric) continue;
    robotClient.set(robot.id, robot.cliente_id);
    metric.robots += 1;
    if (robot.manual_path) metric.documents += 1;
    updateTimestamp(metric, robot.updated_at);
  }
  for (const flow of flowsResult.data ?? []) {
    const metric = metrics.get(flow.client_id);
    if (!metric) continue;
    metric.flows += 1;
    updateTimestamp(metric, flow.updated_at);
  }
  for (const documentation of documentsResult.data ?? []) {
    const clientId = robotClient.get(documentation.robo_id);
    const metric = clientId ? metrics.get(clientId) : undefined;
    if (!metric) continue;
    metric.documents += 1;
    updateTimestamp(metric, documentation.updated_at);
  }

  return NextResponse.json({ metrics: [...metrics.values()] }, { headers: { "Cache-Control": "no-store" } });
}
