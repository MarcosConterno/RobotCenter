"use client";

import { Check, PackagePlus, Pencil, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CORES_BADGE_ROBO, type CorBadgeRobo } from "@/domain/entities";
import { PALETAS_BADGE_ROBO } from "@/domain/badge-colors";
import { ROBOT_CATALOGS, type RobotCatalogItem, type RobotCatalogKind } from "@/domain/robot-catalog";
import styles from "./RobotCatalogSettings.module.css";

const kinds = Object.keys(ROBOT_CATALOGS) as RobotCatalogKind[];

export default function RobotCatalogSettings({ canManage }: { canManage: boolean }) {
  const [kind, setKind] = useState<RobotCatalogKind>("packages");
  const [items, setItems] = useState<RobotCatalogItem[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [color, setColor] = useState<CorBadgeRobo>("violeta");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const supabase = createClient();
    const result = kind === "packages" ? await supabase.from("robot_packages").select("id,name,color,active").order("name")
      : kind === "commands" ? await supabase.from("robot_commands").select("id,name,command,active").order("name")
      : kind === "stacks" ? await supabase.from("robot_stacks").select("id,name,active").order("name")
      : await supabase.from("robot_queues").select("id,name,active").order("name");
    if (result.error) setError(result.error.message);
    else setItems((result.data ?? []) as RobotCatalogItem[]);
    setLoading(false);
  }, [kind]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => items.filter((item) => `${item.name} ${item.command ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [items, query]);

  function reset() { setName(""); setCommand(""); setColor("violeta"); setEditingId(null); setError(""); }
  function edit(item: RobotCatalogItem) { setEditingId(item.id); setName(item.name); setCommand(item.command ?? ""); setColor(item.color ?? "violeta"); }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || (kind === "commands" && !command.trim())) return;
    const supabase = createClient();
    let operationError: { code?: string; message: string } | null = null;
    if (kind === "packages") operationError = (editingId ? await supabase.from("robot_packages").update({ name: name.trim(), color }).eq("id", editingId) : await supabase.from("robot_packages").insert({ name: name.trim(), color })).error;
    else if (kind === "commands") operationError = (editingId ? await supabase.from("robot_commands").update({ name: name.trim(), command: command.trim() }).eq("id", editingId) : await supabase.from("robot_commands").insert({ name: name.trim(), command: command.trim() })).error;
    else if (kind === "stacks") operationError = (editingId ? await supabase.from("robot_stacks").update({ name: name.trim() }).eq("id", editingId) : await supabase.from("robot_stacks").insert({ name: name.trim() })).error;
    else operationError = (editingId ? await supabase.from("robot_queues").update({ name: name.trim() }).eq("id", editingId) : await supabase.from("robot_queues").insert({ name: name.trim() })).error;
    if (operationError) { setError(operationError.code === "23505" ? `${ROBOT_CATALOGS[kind].singular} já cadastrado.` : operationError.message); return; }
    reset(); await load();
  }

  async function toggle(item: RobotCatalogItem) {
    const supabase = createClient();
    const result = kind === "packages" ? await supabase.from("robot_packages").update({ active: !item.active }).eq("id", item.id)
      : kind === "commands" ? await supabase.from("robot_commands").update({ active: !item.active }).eq("id", item.id)
      : kind === "stacks" ? await supabase.from("robot_stacks").update({ active: !item.active }).eq("id", item.id)
      : await supabase.from("robot_queues").update({ active: !item.active }).eq("id", item.id);
    if (result.error) setError(result.error.message); else await load();
  }

  return <section className={styles.shell} aria-label="Cadastros técnicos de robôs">
    <header><div><span>CADASTROS</span><h2>Catálogos dos robôs</h2><p>Padronize os valores usados nos cadastros, importações e dashboards.</p></div><PackagePlus size={24} /></header>
    <nav className={styles.tabs}>{kinds.map((value) => <button key={value} type="button" className={kind === value ? styles.active : ""} onClick={() => { setKind(value); reset(); }}>{ROBOT_CATALOGS[value].label}</button>)}</nav>
    {canManage && <form className={styles.form} onSubmit={save}>
      <label><span>{kind === "commands" ? "Nome amigável" : "Nome"}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={`Novo ${ROBOT_CATALOGS[kind].singular.toLocaleLowerCase("pt-BR")}`} required /></label>
      {kind === "commands" && <label className={styles.wide}><span>Command</span><input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Ex.: python main.py --tribunal tjsp" required /></label>}
      {kind === "packages" && <fieldset><legend>Cor</legend><div className={styles.colors}>{CORES_BADGE_ROBO.map((value) => <button key={value} type="button" aria-label={value} aria-pressed={color === value} onClick={() => setColor(value)} style={{ color: PALETAS_BADGE_ROBO[value].texto, background: PALETAS_BADGE_ROBO[value].fundo, borderColor: color === value ? PALETAS_BADGE_ROBO[value].texto : PALETAS_BADGE_ROBO[value].borda }}>Aa</button>)}</div></fieldset>}
      <div className={styles.formActions}><button type="submit"><Plus size={14} />{editingId ? "Salvar" : "Cadastrar"}</button>{editingId && <button type="button" className={styles.secondary} onClick={reset}><X size={14} />Cancelar</button>}</div>
    </form>}
    <div className={styles.listHeader}><label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Pesquisar ${ROBOT_CATALOGS[kind].label.toLocaleLowerCase("pt-BR")}`} /></label><span>{visible.length} registros</span></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.list}>{loading ? <p>Carregando...</p> : visible.length === 0 ? <p>Nenhum cadastro encontrado.</p> : visible.map((item) => <article key={item.id} className={!item.active ? styles.inactive : ""}>
      <div>{kind === "packages" && item.color && <i style={{ background: PALETAS_BADGE_ROBO[item.color].texto }} />}<span><strong>{item.name}</strong>{item.command && <small>{item.command}</small>}</span></div>
      <span className={styles.status}>{item.active ? "Ativo" : "Inativo"}</span>
      {canManage && <div className={styles.actions}><button type="button" aria-label={`Editar ${item.name}`} onClick={() => edit(item)}><Pencil size={14} /></button><button type="button" aria-label={`${item.active ? "Inativar" : "Ativar"} ${item.name}`} onClick={() => void toggle(item)}><Check size={14} /></button></div>}
    </article>)}</div>
  </section>;
}
