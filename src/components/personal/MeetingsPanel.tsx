"use client";

import { CalendarDays, Clock3, FileText, MoreHorizontal, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import styles from "@/app/minha-pagina/MinhaPagina.module.css";
import MeetingNotesEditor from "./MeetingNotesEditor";

type Meeting = Database["public"]["Tables"]["personal_meetings"]["Row"];
type MeetingFilter = "today" | "upcoming" | "previous";

const NOTES_TEMPLATE = "Objetivo\n\nPontos discutidos\n\nDecisões\n\nPróximos passos\n";

function dateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function MeetingsPanel({ userId, initialMeetingId, onInitialMeetingOpened, onCreateTodo }: { userId: string | null; initialMeetingId?: string | null; onInitialMeetingOpened?: () => void; onCreateTodo: (origin: { id: string; label: string; date: string; type: "meeting" }) => void }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState<MeetingFilter>("today");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openMeeting, setOpenMeeting] = useState<Meeting | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [meetingDate, setMeetingDate] = useState(dateKey());
  const [meetingTime, setMeetingTime] = useState("09:00");
  const [participants, setParticipants] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const today = dateKey();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await createClient().from("personal_meetings").select("*").order("meeting_date").order("meeting_time");
    if (queryError) setError(queryError.message); else setMeetings(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return meetings.filter((meeting) => {
      const matchesFilter = filter === "today" ? meeting.meeting_date === today : filter === "upcoming" ? meeting.meeting_date > today : meeting.meeting_date < today;
      return matchesFilter && (!term || `${meeting.name} ${meeting.summary ?? ""}`.toLocaleLowerCase("pt-BR").includes(term));
    });
  }, [filter, meetings, search, today]);

  function resetDraft() {
    setName(""); setMeetingDate(today); setMeetingTime("09:00"); setParticipants(""); setSummary(""); setNotes(NOTES_TEMPLATE);
  }

  function startCreate() { resetDraft(); setOpenMeeting(null); setCreating(true); setError(""); }
  function open(meeting: Meeting) {
    setCreating(false); setOpenMeeting(meeting); setName(meeting.name); setMeetingDate(meeting.meeting_date); setMeetingTime(meeting.meeting_time.slice(0, 5)); setParticipants(meeting.participants ?? ""); setSummary(meeting.summary ?? ""); setNotes(meeting.notes); setError("");
  }

  useEffect(() => {
    if (!initialMeetingId || meetings.length === 0) return;
    const meeting = meetings.find((item) => item.id === initialMeetingId);
    if (meeting) open(meeting);
    onInitialMeetingOpened?.();
  }, [initialMeetingId, meetings, onInitialMeetingOpened]);
  function close() { if (!saving) { setCreating(false); setOpenMeeting(null); } }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!userId || !name.trim()) return;
    setSaving(true); setError("");
    const payload = { name: name.trim(), meeting_date: meetingDate, meeting_time: meetingTime, participants: participants.trim() || null, summary: summary.trim() || null, notes };
    const result = openMeeting
      ? await createClient().from("personal_meetings").update(payload).eq("id", openMeeting.id)
      : await createClient().from("personal_meetings").insert({ ...payload, user_id: userId });
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    close(); await load();
  }

  async function remove(meeting: Meeting) {
    if (!window.confirm(`Excluir a reunião “${meeting.name}”?`)) return;
    const { error: mutationError } = await createClient().from("personal_meetings").delete().eq("id", meeting.id);
    if (mutationError) setError(mutationError.message); else setMeetings((current) => current.filter((item) => item.id !== meeting.id));
  }

  return <section className={styles.workspacePanel} aria-labelledby="meetings-title" data-tour="my-page-meetings">
    <header className={styles.workspaceHeader}><div><span>CADERNO PESSOAL</span><h2 id="meetings-title">Reuniões</h2></div><button className={styles.primaryButton} type="button" onClick={startCreate}><Plus size={15} /> Nova reunião</button></header>
    <div className={styles.workspaceToolbar}>
      <nav className={styles.filters} aria-label="Filtros de reuniões">{([['today', 'Hoje'], ['upcoming', 'Próximas'], ['previous', 'Anteriores']] as const).map(([id, label]) => <button key={id} type="button" className={filter === id ? styles.activeFilter : undefined} onClick={() => setFilter(id)}>{label}</button>)}</nav>
      <label className={styles.workspaceSearch}><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar reunião..." /></label>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.meetingList}>{loading ? <div className={styles.empty}>Carregando reuniões...</div> : visible.length === 0 ? <div className={styles.empty}><CalendarDays size={22} /><strong>Nenhuma reunião encontrada</strong><span>Registre suas conversas e decisões.</span></div> : visible.map((meeting) => <article className={styles.meetingItem} key={meeting.id}>
      <div className={styles.meetingDate}><strong>{new Date(`${meeting.meeting_date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit" })}</strong><span>{new Date(`${meeting.meeting_date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace('.', '')}</span></div>
      <div className={styles.meetingCopy}><time><Clock3 size={12} />{meeting.meeting_time.slice(0, 5)}</time><h3>{meeting.name}</h3>{meeting.summary && <p>{meeting.summary}</p>}<small className={meeting.notes.trim() ? styles.hasNotes : undefined}><FileText size={12} />{meeting.notes.trim() ? "Anotações registradas" : "Sem anotações"}</small></div>
      <button className={styles.openButton} type="button" onClick={() => open(meeting)}>Abrir reunião</button>
      <div className={styles.itemActions}><MoreHorizontal size={15} /><button type="button" aria-label={`Editar ${meeting.name}`} onClick={() => open(meeting)}><Pencil size={13} /></button><button type="button" aria-label={`Excluir ${meeting.name}`} onClick={() => void remove(meeting)}><Trash2 size={13} /></button></div>
    </article>)}</div>
    {(creating || openMeeting) && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className={styles.documentModal} onSubmit={save}>
      <header><div><span>{creating ? "NOVA REUNIÃO" : "REUNIÃO"}</span><h2>{creating ? "Criar reunião" : openMeeting?.name}</h2>{openMeeting && <p>{new Date(`${meetingDate}T12:00:00`).toLocaleDateString("pt-BR")} • {meetingTime}</p>}</div><button type="button" aria-label="Fechar" onClick={close}><X size={18} /></button></header>
      <div className={styles.documentFields}><label className={styles.wideField}><span>Nome da reunião</span><input required maxLength={180} value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Data</span><input required type="date" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} /></label><label><span>Horário</span><input required type="time" value={meetingTime} onChange={(event) => setMeetingTime(event.target.value)} /></label><label className={styles.wideField}><span>Participantes <small>opcional</small></span><input value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="Nomes ou emails" /></label><label className={styles.wideField}><span>Resumo <small>opcional</small></span><input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Resumo breve da reunião" /></label><div className={styles.editorField}><span className={styles.editorFieldLabel}>Anotações</span><MeetingNotesEditor value={notes} onChange={setNotes} ariaLabel="Anotações da reunião" /></div></div>
      {error && <p className={styles.modalError}>{error}</p>}
      <footer>{openMeeting && <button type="button" className={styles.secondaryButton} onClick={() => onCreateTodo({ id: openMeeting.id, label: openMeeting.name, date: openMeeting.meeting_date, type: "meeting" })}><Plus size={14} /> Criar ToDo</button>}<span /><button type="button" className={styles.secondaryButton} onClick={close}>Cancelar</button><button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></footer>
    </form></div>}
  </section>;
}
