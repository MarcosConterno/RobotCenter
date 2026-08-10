"use client";

import { FileText, Plus, Search, Trash2, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import styles from "@/app/minha-pagina/MinhaPagina.module.css";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

type PersonalNote = Database["public"]["Tables"]["personal_notes"]["Row"];

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Editado agora";
  if (seconds < 3600) return `Editado há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Editado há ${Math.floor(seconds / 3600)}h`;
  return `Editado há ${Math.floor(seconds / 86400)}d`;
}

export default function NotesPanel({ userId, initialNoteId, onInitialNoteOpened, onCreateTodo }: { userId: string | null; initialNoteId?: string | null; onInitialNoteOpened?: () => void; onCreateTodo: (origin: { id: string; label: string; type: "note" }) => void }) {
  const [items, setItems] = useState<PersonalNote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<PersonalNote | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await createClient().from("personal_notes").select("*").order("updated_at", { ascending: false });
    if (queryError) setError(queryError.message); else setItems(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => { const term = search.trim().toLocaleLowerCase("pt-BR"); return items.filter((item) => !term || `${item.title} ${item.content}`.toLocaleLowerCase("pt-BR").includes(term)); }, [items, search]);
  function startCreate() { setCreating(true); setCurrent(null); setTitle(""); setContent(""); setError(""); }
  function open(note: PersonalNote) { setCreating(false); setCurrent(note); setTitle(note.title); setContent(note.content); setError(""); }
  useEffect(() => {
    if (!initialNoteId || items.length === 0) return;
    const note = items.find((item) => item.id === initialNoteId);
    if (note) open(note);
    onInitialNoteOpened?.();
  }, [initialNoteId, items, onInitialNoteOpened]);
  function close() { if (!saving) { setCreating(false); setCurrent(null); } }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!userId || !title.trim()) return; setSaving(true); setError("");
    const result = current ? await createClient().from("personal_notes").update({ title: title.trim(), content }).eq("id", current.id) : await createClient().from("personal_notes").insert({ title: title.trim(), content, user_id: userId });
    setSaving(false); if (result.error) { setError(result.error.message); return; } close(); await load();
  }
  async function remove(note: PersonalNote) { if (!window.confirm(`Excluir a nota “${note.title}”?`)) return; const { error: mutationError } = await createClient().from("personal_notes").delete().eq("id", note.id); if (mutationError) setError(mutationError.message); else { setItems((currentItems) => currentItems.filter((item) => item.id !== note.id)); close(); } }

  return <section className={styles.workspacePanel} aria-labelledby="notes-title"><header className={styles.workspaceHeader}><div><span>ARQUIVO PESSOAL</span><h2 id="notes-title">Notas</h2></div><button className={styles.primaryButton} type="button" onClick={startCreate}><Plus size={15} /> Nova nota</button></header><div className={styles.notesToolbar}><label className={styles.workspaceSearch}><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar notas..." /></label></div>{error && <p className={styles.error}>{error}</p>}<div className={styles.notesGrid}>{loading ? <div className={styles.empty}>Carregando notas...</div> : visible.length === 0 ? <div className={styles.empty}><FileText size={22} /><strong>Nenhuma nota encontrada</strong><span>Guarde ideias e lembretes pessoais.</span></div> : visible.map((note) => <article key={note.id} className={styles.noteCard} role="button" tabIndex={0} onClick={() => open(note)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") open(note); }}><h3>{note.title}</h3><p>{note.content || "Nota sem conteúdo."}</p><time>{relativeTime(note.updated_at)}</time></article>)}</div>{(creating || current) && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className={styles.documentModal} onSubmit={save}><header><div><span>{creating ? "NOVA NOTA" : "NOTA"}</span><h2>{creating ? "Criar nota" : current?.title}</h2></div><button type="button" aria-label="Fechar" onClick={close}><X size={18} /></button></header><div className={styles.noteEditor}><label><span>Título</span><input required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label><span>Conteúdo</span><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escreva livremente..." /></label></div>{error && <p className={styles.modalError}>{error}</p>}<footer>{current && <><button type="button" className={styles.dangerButton} onClick={() => void remove(current)}><Trash2 size={14} /> Excluir nota</button><button type="button" className={styles.secondaryButton} onClick={() => onCreateTodo({ id: current.id, label: current.title, type: "note" })}><Plus size={14} /> Criar ToDo</button></>}<span /><button type="button" className={styles.secondaryButton} onClick={close}>Cancelar</button><button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></footer></form></div>}</section>;
}
