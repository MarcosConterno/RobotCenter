"use client";

import { Layers3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import type { Robo } from "@/domain/entities";
import { createClient } from "@/lib/supabase/client";

type Status = "SOLICITADA" | "EM_ANALISE" | "AGUARDANDO_INFORMACAO" | "CONCLUIDA" | "CANCELADA";
interface Item { id: string; robot_id: string; suggested_stack_name: string; status: Status; generated_stack: string | null; requested_at: string; completed_at: string | null }
const LABELS: Record<Status, string> = { SOLICITADA: "Solicitadas", EM_ANALISE: "Em análise", AGUARDANDO_INFORMACAO: "Aguardando informação", CONCLUIDA: "Concluídas", CANCELADA: "Canceladas" };
const RESULT_OPTIONS = [3, 5, 10, 20, 50] as const;

export default function StackRequestsDashboard({ robots, onOpenRobot }: { robots: Robo[]; onOpenRobot: (robot: Robo, tab?: "stackRequests") => void }) {
  const { canViewStackRequests } = useAdminAccess();
  const [items, setItems] = useState<Item[]>([]);
  const [resultLimit, setResultLimit] = useState<number>(3);
  const [statusFilter, setStatusFilter] = useState<Status>("SOLICITADA");
  const robotMap = useMemo(() => new Map(robots.map((robot) => [robot.id, robot])), [robots]);

  useEffect(() => {
    if (!canViewStackRequests) return;
    const supabase = createClient();
    const load = async () => { const { data } = await supabase.from("stack_requests").select("id,robot_id,suggested_stack_name,status,generated_stack,requested_at,completed_at").order("requested_at", { ascending: false }).limit(50); setItems((data ?? []) as Item[]); };
    void load();
    const channel = supabase.channel("dashboard-stack-requests").on("postgres_changes", { event: "*", schema: "public", table: "stack_requests" }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [canViewStackRequests]);

  if (!canViewStackRequests) return null;
  const openItems = items.filter((item) => !["CONCLUIDA", "CANCELADA"].includes(item.status));
  const filteredItems = items.filter((item) => item.status === statusFilter);
  const renderItem = (item: Item) => {
    const robot = robotMap.get(item.robot_id);
    return <button type="button" key={item.id} disabled={!robot} onClick={() => robot && onOpenRobot(robot, "stackRequests")}><span><strong>{item.suggested_stack_name}</strong><small>{robot?.nome ?? "Robô não disponível"}</small></span><em>{LABELS[item.status]}</em><time>{new Date(item.requested_at).toLocaleDateString("pt-BR")}</time></button>;
  };
  return <section className="stack-requests-dashboard">
    <header><div><span><Layers3 size={16} /></span><div><h2>Solicitações de Stack</h2><p>Acompanhamento das demandas operacionais.</p></div></div><strong>{openItems.length} abertas</strong></header>
    <div className="stack-requests-dashboard__stats">{(["SOLICITADA", "EM_ANALISE", "AGUARDANDO_INFORMACAO", "CONCLUIDA", "CANCELADA"] as Status[]).map((status) => <button type="button" key={status} className={statusFilter === status ? "is-active" : undefined} aria-pressed={statusFilter === status} onClick={() => { setStatusFilter(status); setResultLimit(3); }}><span>{LABELS[status]}</span><strong>{items.filter((item) => item.status === status).length}</strong></button>)}</div>
    <div className="stack-requests-dashboard__list">{filteredItems.slice(0, resultLimit).map(renderItem)}{filteredItems.length === 0 && <p>Nenhuma solicitação encontrada neste filtro.</p>}</div>
    {filteredItems.length > 0 && <footer className="stack-requests-dashboard__footer"><span>Exibindo {Math.min(filteredItems.length, resultLimit)} de {filteredItems.length} solicitações.</span>{filteredItems.length > 3 && <label><span>Mostrar</span><select value={resultLimit} onChange={(event) => setResultLimit(Number(event.target.value))}>{RESULT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>}</footer>}
  </section>;
}
