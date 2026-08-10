"use client";

import { Bot, CalendarDays, CalendarPlus, Check, CheckCircle2, Circle, Clock3, FileText, GitFork, ListTodo, NotebookPen, Pencil, Plus, Settings2, Trash2, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import AppShell from "@/components/layout/AppShell";
import Topbar from "@/components/layout/Topbar";
import RobotsOverviewTable from "@/components/dashboard/RobotsOverviewTable";
import MeetingsPanel from "@/components/personal/MeetingsPanel";
import NotesPanel from "@/components/personal/NotesPanel";
import { useAppData } from "@/data/AppDataProvider";
import { useFlowsData } from "@/data/FlowsDataProvider";
import { formatarData } from "@/domain/formatters";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

import styles from "./MinhaPagina.module.css";

type Todo = Database["public"]["Tables"]["personal_tasks"]["Row"] & {
  personal_meetings: { name: string; meeting_date: string } | null;
  personal_notes: { title: string } | null;
};
type Priority = "low" | "medium" | "high";
type Filter = "today" | "pending" | "upcoming" | "completed";
type WorkspaceTab = "todo" | "meetings" | "notes";
type TodoOrigin = { id: string; label: string; date?: string; type: "meeting" | "note" };

const filters: Array<{ id: Filter; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "pending", label: "Pendentes" },
  { id: "upcoming", label: "Próximas" },
  { id: "completed", label: "Concluídas" },
];

const priorityLabels: Record<Priority, string> = { low: "Baixa", medium: "Média", high: "Alta" };

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTaskDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(new Date(`${value}T12:00:00`));
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function databaseMessage(message: string) {
  if (message.includes("personal_tasks") || message.includes("schema cache") || message.includes("relation")) {
    return "As tabelas de Minha página ainda não estão disponíveis. Aplique as migrations pendentes do Supabase.";
  }
  if (message.toLocaleLowerCase("pt-BR").includes("row-level security")) {
    return "Sua sessão não tem permissão para realizar esta operação. Entre novamente e tente de novo.";
  }
  return message;
}

export default function MinhaPaginaPage() {
  const router = useRouter();
  const { displayName } = useAdminAccess();
  const { robos, clientes, atualizarCapacidadeRobo } = useAppData();
  const { fluxos } = useFlowsData();
  const { canUpdateCapacity } = useAdminAccess();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("todo");
  const [requestedMeetingId, setRequestedMeetingId] = useState<string | null>(null);
  const [requestedNoteId, setRequestedNoteId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<Filter>("today");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState(localDateKey());
  const [priority, setPriority] = useState<Priority>("medium");
  const [todoOrigin, setTodoOrigin] = useState<TodoOrigin | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showRobotTable, setShowRobotTable] = useState(false);
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>([]);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const today = localDateKey();

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: queryError } = await createClient()
      .from("personal_tasks")
      .select("*,personal_meetings(name,meeting_date),personal_notes(title)")
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (queryError) setError(databaseMessage(queryError.message));
    else setTasks((data ?? []) as Todo[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const loadPreferences = useCallback(async () => {
    setPreferencesLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPreferencesLoading(false); return; }
    setUserId(user.id);
    const [preferenceResult, flowsResult] = await Promise.all([
      supabase.from("personal_page_preferences").select("show_robot_table").eq("user_id", user.id).maybeSingle(),
      supabase.from("personal_page_flows").select("flow_id").eq("user_id", user.id).order("created_at"),
    ]);
    if (preferenceResult.error || flowsResult.error) {
      const message = preferenceResult.error?.message ?? flowsResult.error?.message ?? "Não foi possível carregar suas preferências.";
      setError(databaseMessage(message));
    } else {
      setShowRobotTable(preferenceResult.data?.show_robot_table ?? false);
      setSelectedFlowIds((flowsResult.data ?? []).map((item) => item.flow_id));
    }
    setPreferencesLoading(false);
  }, []);

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (filter === "today") return task.due_date === today && task.status === "pending";
    if (filter === "pending") return task.status === "pending";
    if (filter === "upcoming") return task.status === "pending" && task.due_date > today;
    return task.status === "completed";
  }), [filter, tasks, today]);

  const todayTasks = tasks.filter((task) => task.due_date === today);
  const todayCompleted = todayTasks.filter((task) => task.status === "completed").length;
  const progress = todayTasks.length ? Math.round((todayCompleted / todayTasks.length) * 100) : 0;
  const upcomingTasks = tasks.filter((task) => task.status === "pending" && task.due_date > today).slice(0, 4);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setNote("");
    setDueDate(today);
    setPriority("medium");
    setTodoOrigin(null);
    setFormOpen(false);
  }

  function startEdit(task: Todo) {
    setEditingId(task.id);
    setTitle(task.title);
    setNote(task.note ?? "");
    setDueDate(task.due_date);
    setPriority(task.priority as Priority);
    setTodoOrigin(task.origin_meeting_id && task.personal_meetings ? { id: task.origin_meeting_id, label: task.personal_meetings.name, date: task.personal_meetings.meeting_date, type: "meeting" } : task.origin_note_id && task.personal_notes ? { id: task.origin_note_id, label: task.personal_notes.title, type: "note" } : null);
    setFormOpen(true);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const payload = { title: title.trim(), note: note.trim() || null, due_date: dueDate, priority, origin_meeting_id: todoOrigin?.type === "meeting" ? todoOrigin.id : null, origin_note_id: todoOrigin?.type === "note" ? todoOrigin.id : null };
    let mutationError;
    if (editingId) {
      ({ error: mutationError } = await supabase.from("personal_tasks").update(payload).eq("id", editingId));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) mutationError = new Error("Sessão não encontrada.");
      else ({ error: mutationError } = await supabase.from("personal_tasks").insert({ ...payload, user_id: user.id }));
    }
    setSaving(false);
    if (mutationError) { setError(databaseMessage(mutationError.message)); return; }
    resetForm();
    await loadTasks();
  }

  async function toggleTask(task: Todo) {
    const status = task.status === "completed" ? "pending" : "completed";
    setTasks((current) => current.map((item) => item.id === task.id
      ? { ...item, status, completed_at: status === "completed" ? new Date().toISOString() : null }
      : item));
    const { error: mutationError } = await createClient().from("personal_tasks").update({ status }).eq("id", task.id);
    if (mutationError) {
      setError(databaseMessage(mutationError.message));
      await loadTasks();
      return;
    }
    if (status === "pending") setFilter("pending");
  }

  async function deleteTask(task: Todo) {
    if (!window.confirm(`Excluir o ToDo “${task.title}”?`)) return;
    const previous = tasks;
    setTasks((current) => current.filter((item) => item.id !== task.id));
    const { error: mutationError } = await createClient().from("personal_tasks").delete().eq("id", task.id);
    if (mutationError) { setTasks(previous); setError(databaseMessage(mutationError.message)); }
  }

  function createTodoFromOrigin(origin: TodoOrigin) {
    setActiveTab("todo");
    resetForm();
    setTodoOrigin(origin);
    setFormOpen(true);
  }

  function openTodoOrigin(task: Todo) {
    if (task.origin_meeting_id) {
      setRequestedMeetingId(task.origin_meeting_id);
      setActiveTab("meetings");
    } else if (task.origin_note_id) {
      setRequestedNoteId(task.origin_note_id);
      setActiveTab("notes");
    }
  }

  async function toggleRobotTable(enabled: boolean) {
    if (!userId) return;
    const previous = showRobotTable;
    setShowRobotTable(enabled);
    const { error: mutationError } = await createClient().from("personal_page_preferences").upsert({ user_id: userId, show_robot_table: enabled });
    if (mutationError) { setShowRobotTable(previous); setError(databaseMessage(mutationError.message)); }
  }

  async function toggleSelectedFlow(flowId: string, selected: boolean) {
    if (!userId) return;
    const previous = selectedFlowIds;
    setSelectedFlowIds((current) => selected ? [...current, flowId] : current.filter((id) => id !== flowId));
    const query = selected
      ? createClient().from("personal_page_flows").insert({ user_id: userId, flow_id: flowId })
      : createClient().from("personal_page_flows").delete().eq("user_id", userId).eq("flow_id", flowId);
    const { error: mutationError } = await query;
    if (mutationError) { setSelectedFlowIds(previous); setError(databaseMessage(mutationError.message)); }
  }

  const selectedFlows = fluxos.filter((flow) => selectedFlowIds.includes(flow.id));

  const currentDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());

  return (
    <AppShell title="Minha página" hideTopbar>
      <div className={styles.page}>
        <header className={styles.welcome} data-tour="my-page-welcome">
          <div>
            <p className={styles.date}><CalendarDays size={14} />{currentDate}</p>
            <h1>{greeting()}, {displayName}</h1>
            <p>Organize seu dia e acompanhe suas prioridades.</p>
          </div>
          <div className={styles.welcomeActions}>
            <button type="button" className={styles.settingsButton} data-tour="my-page-personalize" onClick={() => setSettingsOpen((current) => !current)} aria-expanded={settingsOpen}>
              <Settings2 size={15} /> Personalizar
            </button>
            <Topbar title="Conta do usuário" bare />
          </div>
        </header>

        <nav className={styles.workspaceTabs} aria-label="Áreas do workspace pessoal" data-tour="my-page-tabs">
          <button type="button" data-tour="my-page-tab-todo" className={activeTab === "todo" ? styles.activeWorkspaceTab : undefined} aria-current={activeTab === "todo" ? "page" : undefined} onClick={() => setActiveTab("todo")}><ListTodo size={15} /> ToDo</button>
          <button type="button" data-tour="my-page-tab-meetings" className={activeTab === "meetings" ? styles.activeWorkspaceTab : undefined} aria-current={activeTab === "meetings" ? "page" : undefined} onClick={() => setActiveTab("meetings")}><UsersRound size={15} /> Reuniões</button>
          <button type="button" data-tour="my-page-tab-notes" className={activeTab === "notes" ? styles.activeWorkspaceTab : undefined} aria-current={activeTab === "notes" ? "page" : undefined} onClick={() => setActiveTab("notes")}><NotebookPen size={15} /> Notas</button>
        </nav>

        {settingsOpen && (
          <section className={styles.settingsPanel} aria-label="Personalizar Minha página">
            <div className={styles.settingsHeading}><div><span>VISUALIZAÇÃO PESSOAL</span><h2>Escolha o que aparece nesta página</h2></div><button type="button" aria-label="Fechar personalização" onClick={() => setSettingsOpen(false)}><X size={16} /></button></div>
            {preferencesLoading ? <p>Carregando preferências...</p> : (
              <div className={styles.widgetOptions}>
                <label className={styles.widgetToggle}><input type="checkbox" checked={showRobotTable} onChange={(event) => void toggleRobotTable(event.target.checked)} /><span><Bot size={16} /><strong>Tabela de robôs</strong><small>Exibe a mesma visão consolidada da Dashboard.</small></span></label>
                <div className={styles.flowPicker}>
                  <div><GitFork size={16} /><span><strong>Cards de fluxos</strong><small>Selecione somente os atalhos que acompanha com frequência.</small></span></div>
                  {fluxos.length === 0 ? <p>Nenhum fluxo disponível para seu perfil.</p> : <div className={styles.flowChoices}>{fluxos.map((flow) => <label key={flow.id}><input type="checkbox" checked={selectedFlowIds.includes(flow.id)} onChange={(event) => void toggleSelectedFlow(flow.id, event.target.checked)} /><span>{flow.nome}</span></label>)}</div>}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "todo" && <div className={styles.layout} data-tour="my-page-todos">
          <section className={styles.tasksPanel} aria-labelledby="todos-title">
            <div className={styles.panelHeader}>
              <div><span>Organização pessoal</span><h2 id="todos-title">Meus ToDos</h2></div>
              <button className={styles.primaryButton} type="button" onClick={() => { resetForm(); setFormOpen(true); }}>
                <Plus size={15} /> Novo ToDo
              </button>
            </div>

            {formOpen && (
              <form className={styles.taskForm} onSubmit={saveTask}>
                <div className={styles.formHeading}>
                  <strong>{editingId ? "Editar ToDo" : "Novo ToDo"}</strong>
                  <button type="button" aria-label="Fechar formulário" onClick={resetForm}><X size={16} /></button>
                </div>
                <label className={styles.titleField}><span>Título</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required autoFocus placeholder="O que precisa ser feito?" /></label>
                <label><span>Observação <small>opcional</small></span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Adicione um contexto breve" /></label>
                <label><span>Data</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label>
                <label><span>Prioridade</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label>
                {todoOrigin && <div className={styles.todoOriginForm}><FileText size={13} /><span>Origem: {todoOrigin.type === "meeting" ? "Reunião" : "Nota"} — {todoOrigin.label}</span><button type="button" aria-label="Remover origem" onClick={() => setTodoOrigin(null)}><X size={13} /></button></div>}
                <button className={styles.saveButton} disabled={saving} type="submit"><Check size={14} />{saving ? "Salvando..." : "Salvar"}</button>
              </form>
            )}

            <nav className={styles.filters} aria-label="Filtros de ToDos">
              {filters.map((item) => <button key={item.id} type="button" className={filter === item.id ? styles.activeFilter : undefined} onClick={() => setFilter(item.id)}>{item.label}</button>)}
            </nav>
            {error && <p className={styles.error} role="alert">{error}</p>}

            <div className={styles.taskList}>
              {loading ? <div className={styles.empty}>Carregando seus ToDos...</div> : visibleTasks.length === 0 ? (
                <div className={styles.empty}><CheckCircle2 size={22} /><strong>Nenhum ToDo por aqui</strong><span>Sua lista está organizada.</span></div>
              ) : visibleTasks.map((task) => {
                const completed = task.status === "completed";
                const overdue = !completed && task.due_date < today;
                return (
                  <article key={task.id} className={`${styles.task}${completed ? ` ${styles.completed}` : ""}${overdue ? ` ${styles.overdue}` : ""}`}>
                    <button className={styles.checkbox} type="button" aria-label={completed ? `Reabrir ToDo ${task.title}` : `Concluir ToDo ${task.title}`} onClick={() => void toggleTask(task)}>{completed ? <Check size={14} /> : <Circle size={16} />}</button>
                    <div className={styles.taskCopy}><strong>{task.title}</strong>{task.note && <span>{task.note}</span>}{task.personal_meetings && <button type="button" className={styles.originLink} onClick={() => openTodoOrigin(task)}><FileText size={11} />Origem: Reunião — {task.personal_meetings.name} · {formatTaskDate(task.personal_meetings.meeting_date)}</button>}{task.personal_notes && <button type="button" className={styles.originLink} onClick={() => openTodoOrigin(task)}><FileText size={11} />Origem: Nota — {task.personal_notes.title}</button>}</div>
                    <time dateTime={task.due_date}><Clock3 size={12} />{overdue ? "Atrasada · " : ""}{formatTaskDate(task.due_date)}</time>
                    <span className={`${styles.priority} ${styles[task.priority as Priority]}`}>{priorityLabels[task.priority as Priority]}</span>
                    <div className={styles.actions}><button type="button" aria-label={`Editar ToDo ${task.title}`} onClick={() => startEdit(task)}><Pencil size={14} /></button><button type="button" aria-label={`Excluir ToDo ${task.title}`} onClick={() => void deleteTask(task)}><Trash2 size={14} /></button></div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className={styles.summary} aria-label="Resumo dos ToDos do dia">
            <section className={styles.summaryCard}>
              <div className={styles.summaryTitle}><span>Resumo do dia</span><strong>{progress}%</strong></div>
              <div className={styles.progress} aria-label={`${progress}% dos ToDos de hoje concluídos`}><span style={{ width: `${progress}%` }} /></div>
              <dl><div><dt>ToDos de hoje</dt><dd>{todayTasks.length}</dd></div><div><dt>Concluídos</dt><dd>{todayCompleted}</dd></div><div><dt>Pendentes</dt><dd>{todayTasks.length - todayCompleted}</dd></div></dl>
            </section>
            <section className={styles.upcomingCard}>
              <h2>Próximos ToDos</h2>
              {upcomingTasks.length === 0 ? <p>Nenhum ToDo futuro.</p> : upcomingTasks.map((task) => <div key={task.id}><span>{task.title}</span><time>{formatTaskDate(task.due_date)}</time></div>)}
            </section>
          </aside>
        </div>}

        {activeTab === "meetings" && <MeetingsPanel userId={userId} initialMeetingId={requestedMeetingId} onInitialMeetingOpened={() => setRequestedMeetingId(null)} onCreateTodo={createTodoFromOrigin} />}
        {activeTab === "notes" && <NotesPanel userId={userId} initialNoteId={requestedNoteId} onInitialNoteOpened={() => setRequestedNoteId(null)} onCreateTodo={createTodoFromOrigin} />}

        {selectedFlows.length > 0 && (
          <section className={styles.selectedFlows} aria-labelledby="selected-flows-title">
            <header><div><span>ATALHOS PESSOAIS</span><h2 id="selected-flows-title">Meus fluxos</h2></div><button type="button" onClick={() => setSettingsOpen(true)}><Settings2 size={14} /> Alterar seleção</button></header>
            <div className="flows-grid">
              {selectedFlows.map((flow) => {
                const cliente = clientes.find((item) => item.id === flow.clienteId);
                return <article className="flow-card" key={flow.id} role="link" tabIndex={0} onClick={() => router.push(`/fluxos/${flow.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/fluxos/${flow.id}`); } }}>
                  <div className="flow-card__top"><span className="flow-card__client"><GitFork size={12} />{cliente?.nome ?? "Cliente"}</span><span className={`flow-status is-${flow.status}`}>{flow.status === "publicado" ? "Publicado" : "Rascunho"}</span></div>
                  <div className="flow-card__title"><span><GitFork size={17} /></span><h2>{flow.nome}</h2></div>
                  <p>{flow.descricao || "Sem descrição."}</p>
                  <div className="flow-card__facts"><span><Bot size={13} /><strong>{flow.quantidadeRobos}</strong> robôs</span><span><CalendarPlus size={13} />Criado em {formatarData(flow.criadoEm)}</span><span><Clock3 size={13} />Alterado em {formatarData(flow.atualizadoEm)}</span></div>
                </article>;
              })}
            </div>
          </section>
        )}

        {showRobotTable && (
          <section className={styles.robotWidget} aria-label="Tabela de robôs selecionada">
            <RobotsOverviewTable robos={robos} clientes={clientes} onViewRobot={(robot) => router.push(`/robos/${robot.id}`)} canEditCapacity={canUpdateCapacity} onUpdateCapacity={atualizarCapacidadeRobo} />
          </section>
        )}
      </div>
    </AppShell>
  );
}
