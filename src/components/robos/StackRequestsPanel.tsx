"use client";

import { CheckCircle2, MessageSquarePlus, Plus, Save, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { createClient } from "@/lib/supabase/client";

import styles from "./StackRequestsPanel.module.css";

type Status = "SOLICITADA" | "EM_ANALISE" | "AGUARDANDO_INFORMACAO" | "CONCLUIDA" | "CANCELADA";
interface Queue { id: string; name: string }
interface History { id: string; event_type: string; message: string | null; created_at: string; previous_status: string | null; new_status: string | null }
interface RequestItem { id: string; suggested_stack_name: string; queue_id: string | null; type: string; job: string; status: Status; generated_stack: string | null; requested_at: string; completed_at: string | null; stack_request_history?: History[] }
type RequestPatch = Partial<Pick<RequestItem, "suggested_stack_name" | "queue_id" | "type" | "job" | "status" | "generated_stack">>;

const STATUS_LABELS: Record<Status, string> = { SOLICITADA: "Solicitada", EM_ANALISE: "Em análise", AGUARDANDO_INFORMACAO: "Aguardando informação", CONCLUIDA: "Concluída", CANCELADA: "Cancelada" };

export default function StackRequestsPanel({ robotId }: { robotId: string }) {
  const access = useAdminAccess();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [messageById, setMessageById] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ suggested_stack_name: "", queue_id: "", type: "", job: "" });

  const load = useCallback(async () => {
    if (!access.canViewStackRequests) return;
    const supabase = createClient();
    const [requests, queueResult] = await Promise.all([
      supabase.from("stack_requests").select("id,suggested_stack_name,queue_id,type,job,status,generated_stack,requested_at,completed_at,stack_request_history(id,event_type,message,created_at,previous_status,new_status)").eq("robot_id", robotId).order("requested_at", { ascending: false }),
      supabase.from("robot_queues").select("id,name").eq("active", true).order("name"),
    ]);
    if (requests.error) setError(requests.error.message); else setItems((requests.data ?? []) as RequestItem[]);
    if (!queueResult.error) setQueues((queueResult.data ?? []) as Queue[]);
  }, [access.canViewStackRequests, robotId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!access.canViewStackRequests) return;
    const supabase = createClient();
    const channel = supabase.channel(`stack-requests-${robotId}`).on("postgres_changes", { event: "*", schema: "public", table: "stack_requests", filter: `robot_id=eq.${robotId}` }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [access.canViewStackRequests, load, robotId]);

  if (!access.canViewStackRequests) return null;

  async function createRequest() {
    if (!draft.suggested_stack_name.trim() || !draft.type.trim() || !draft.job.trim()) return setError("Preencha nome sugerido, Type e Job.");
    setSaving(true); setError("");
    const { error: saveError } = await createClient().from("stack_requests").insert({ robot_id: robotId, suggested_stack_name: draft.suggested_stack_name.trim(), queue_id: draft.queue_id || null, type: draft.type.trim(), job: draft.job.trim() });
    setSaving(false);
    if (saveError) return setError(saveError.message);
    setDraft({ suggested_stack_name: "", queue_id: "", type: "", job: "" }); setCreating(false); await load();
  }

  async function patchRequest(id: string, patch: RequestPatch) {
    setSaving(true); setError("");
    const { error: saveError } = await createClient().from("stack_requests").update(patch).eq("id", id);
    setSaving(false); if (saveError) return setError(saveError.message); await load();
  }

  async function addMessage(item: RequestItem, eventType: "INFORMACAO_SOLICITADA" | "RESPOSTA") {
    const message = messageById[item.id]?.trim();
    if (!message) return setError("Escreva a informação antes de enviar.");
    setSaving(true); setError("");
    const supabase = createClient();
    const { error: historyError } = await supabase.from("stack_request_history").insert({ stack_request_id: item.id, event_type: eventType, message });
    if (!historyError && eventType === "INFORMACAO_SOLICITADA") await supabase.from("stack_requests").update({ status: "AGUARDANDO_INFORMACAO" }).eq("id", item.id);
    if (!historyError && eventType === "RESPOSTA") await supabase.from("stack_requests").update({ status: "EM_ANALISE" }).eq("id", item.id);
    setSaving(false); if (historyError) return setError(historyError.message); setMessageById((current) => ({ ...current, [item.id]: "" })); await load();
  }

  return <div className={styles.panel}>
    <header className={styles.header}><div><h2>Solicitações de Stack</h2><p>Acompanhe a necessidade técnica deste robô até a conclusão.</p></div>{access.canCreateStackRequests && <button type="button" className={styles.primary} onClick={() => setCreating((value) => !value)}><Plus size={14} /> Solicitar Stack</button>}</header>
    {creating && <div className={styles.form}>
      <label>Sugestão de nome<input value={draft.suggested_stack_name} onChange={(event) => setDraft({ ...draft, suggested_stack_name: event.target.value })} /></label>
      <label>Fila<select value={draft.queue_id} onChange={(event) => setDraft({ ...draft, queue_id: event.target.value })}><option value="">Não informada</option>{queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.name}</option>)}</select></label>
      <label>Type<input value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} /></label>
      <label>Job<input value={draft.job} onChange={(event) => setDraft({ ...draft, job: event.target.value })} /></label>
      <div className={styles.formActions}><button type="button" className={styles.secondary} onClick={() => setCreating(false)}>Cancelar</button><button type="button" className={styles.primary} disabled={saving} onClick={() => void createRequest()}><Save size={14} /> Enviar solicitação</button></div>
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.list}>{items.length === 0 ? <div className={styles.empty}>Nenhuma solicitação cadastrada para este robô.</div> : items.map((item) => {
      const queue = queues.find((entry) => entry.id === item.queue_id)?.name ?? "Não informada";
      const history = [...(item.stack_request_history ?? [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return <article className={styles.card} key={item.id}>
        <header className={styles.cardHeader}><div><h3>{item.suggested_stack_name}</h3><p>Solicitada em {new Date(item.requested_at).toLocaleString("pt-BR")}</p></div><span className={styles.status}>{STATUS_LABELS[item.status]}</span></header>
        <div className={styles.body}>
          <div className={styles.meta}><div><span>Fila</span><strong>{queue}</strong></div><div><span>Type</span><strong>{item.type}</strong></div><div><span>Job</span><strong>{item.job}</strong></div><div><span>Stack gerada</span><strong>{item.generated_stack ?? "—"}</strong></div></div>
          {access.canManageStackRequests && !["CONCLUIDA", "CANCELADA"].includes(item.status) && <>
            <div className={styles.editGrid}>
              <label>Stack gerada<input value={item.generated_stack ?? ""} placeholder="Preencha para concluir" onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, generated_stack: event.target.value } : entry))} /></label>
              <label>Status<select value={item.status} onChange={(event) => void patchRequest(item.id, { status: event.target.value as Status })}><option value="SOLICITADA">Solicitada</option><option value="EM_ANALISE">Em análise</option><option value="AGUARDANDO_INFORMACAO">Aguardando informação</option></select></label>
            </div>
            <div className={styles.actions}><button type="button" className={styles.secondary} disabled={saving} onClick={() => void patchRequest(item.id, { generated_stack: item.generated_stack })}><Save size={13} /> Salvar dados</button><button type="button" className={styles.primary} disabled={saving || !item.generated_stack?.trim()} onClick={() => void patchRequest(item.id, { generated_stack: item.generated_stack, status: "CONCLUIDA" })}><CheckCircle2 size={13} /> Concluir</button><button type="button" className={styles.danger} disabled={saving} onClick={() => void patchRequest(item.id, { status: "CANCELADA" })}><XCircle size={13} /> Cancelar</button></div>
            <div className={styles.messageBox}><label>Informação ou resposta<textarea value={messageById[item.id] ?? ""} onChange={(event) => setMessageById((current) => ({ ...current, [item.id]: event.target.value }))} /></label><div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => void addMessage(item, "RESPOSTA")}><MessageSquarePlus size={13} /> Registrar resposta</button><button type="button" className={styles.secondary} onClick={() => void addMessage(item, "INFORMACAO_SOLICITADA")}><MessageSquarePlus size={13} /> Pedir informação</button></div></div>
          </>}
          <div className={styles.history}><h4>Histórico</h4>{history.map((event) => <div className={styles.historyItem} key={event.id}><strong>{event.event_type.replaceAll("_", " ")}</strong><span>{event.message ?? (event.previous_status && event.new_status ? `${STATUS_LABELS[event.previous_status as Status]} → ${STATUS_LABELS[event.new_status as Status]}` : "Registro automático")}</span><time>{new Date(event.created_at).toLocaleString("pt-BR")}</time></div>)}</div>
        </div>
      </article>;
    })}</div>
  </div>;
}
