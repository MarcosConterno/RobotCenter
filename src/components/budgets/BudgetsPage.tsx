"use client";

import { BookOpen, Calculator, Check, ChevronDown, FileDown, FileText, Pencil, Plus, Save, Search, Settings2, Trash2, Upload, X } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/client";
import { generateBudgetPdf, generateRobotCenterBudgetPdf } from "./budget-pdf";
import { BUDGET_STATUSES, normalizeBudgetText, parseBudgetText, type BudgetAction, type BudgetActionAlias, type BudgetClient, type BudgetItemDraft, type BudgetStatus, type BudgetSummary, type BudgetSystem } from "@/domain/budgets";
import { budgetSchema, primeiraMensagemErro } from "@/domain/validation";
import styles from "./BudgetsPage.module.css";

const DEFAULT_RATE = 220;
const DEFAULT_COMMISSION = 30;

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : fallback;
}

function money(value: number | null | undefined) {
  const safeValue = Number(value);
  return (Number.isFinite(safeValue) ? safeValue : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function BudgetsPage() {
  const [actions, setActions] = useState<BudgetAction[]>([]);
  const [aliases, setAliases] = useState<BudgetActionAlias[]>([]);
  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
  const [clients, setClients] = useState<BudgetClient[]>([]);
  const [systems, setSystems] = useState<BudgetSystem[]>([]);
  const [items, setItems] = useState<BudgetItemDraft[]>([]);
  const [projectName, setProjectName] = useState("Orçamento de Projeto");
  const [source, setSource] = useState<"manual" | "txt">("manual");
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [sourceContent, setSourceContent] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState(DEFAULT_RATE);
  const [commissionPercent, setCommissionPercent] = useState(DEFAULT_COMMISSION);
  const [clientId, setClientId] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus>("novo");
  const [systemId, setSystemId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    setLoading(true);
    const supabase = createClient();
    const [actionsResult, aliasesResult, budgetsResult, clientsResult, systemsResult] = await Promise.all([
      supabase.from("budget_action_catalog").select("id,code,category,description,default_hours,sort_order,active").order("sort_order"),
      supabase.from("budget_action_aliases").select("id,action_id,alias,priority,active").order("priority", { ascending: false }),
      supabase.from("budgets").select("id,project_name,source,status,total_hours,total,robot_id,client_id,system_id,created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(20),
      supabase.from("clientes").select("id,nome").is("deleted_at", null).order("nome"),
      supabase.from("robot_systems").select("id,name").eq("active", true).is("deleted_at", null).order("name"),
    ]);
    if (actionsResult.error || aliasesResult.error || budgetsResult.error || clientsResult.error || systemsResult.error) {
      setMessage("Não foi possível carregar o módulo. Confirme se a migration foi aplicada.");
    } else {
      setActions((actionsResult.data ?? []).map((row) => ({ id: row.id, code: row.code, category: row.category, description: row.description, defaultHours: Number(row.default_hours), sortOrder: row.sort_order, active: row.active })));
      setAliases((aliasesResult.data ?? []).map((row) => ({ id: row.id, actionId: row.action_id, alias: row.alias, priority: row.priority, active: row.active })));
      const loadedClients = (clientsResult.data ?? []).map((row) => ({ id: row.id, name: row.nome }));
      setClients(loadedClients);
      const loadedSystems = (systemsResult.data ?? []).map((row) => ({ id: row.id, name: row.name }));
      setSystems(loadedSystems);
      setBudgets((budgetsResult.data ?? []).map((row) => ({ id: row.id, projectName: row.project_name, source: row.source as "manual" | "txt", status: row.status as BudgetStatus, totalHours: Number(row.total_hours), estimatedValue: Number(row.total), clientId: row.client_id, clientName: loadedClients.find((client) => client.id === row.client_id)?.name ?? null, systemId: row.system_id, systemName: loadedSystems.find((system) => system.id === row.system_id)?.name ?? null, robotId: row.robot_id, createdAt: row.created_at })));
    }
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, []);

  const totals = useMemo(() => {
    const hours = items.reduce((sum, item) => sum + item.hours, 0);
    const subtotal = hours * hourlyRate;
    return { hours, subtotal, total: subtotal * (1 + commissionPercent / 100) };
  }, [commissionPercent, hourlyRate, items]);

  function addAction() {
    const action = actions.find((candidate) => candidate.id === selectedAction && candidate.active);
    if (!action) return;
    setItems((current) => [...current, { id: crypto.randomUUID(), actionId: action.id, description: action.description, hours: action.defaultHours, sourceLine: null, sourceText: null, recognized: true }]);
  }

  async function importTxt(file: File) {
    if (!file.name.toLocaleLowerCase("pt-BR").endsWith(".txt")) return setMessage("Selecione um arquivo TXT.");
    if (file.size > 2_000_000) return setMessage("O arquivo TXT deve ter no máximo 2 MB.");
    const content = await file.text();
    const parsed = parseBudgetText(content, actions, aliases);
    setSource("txt");
    setSourceFileName(file.name);
    setSourceContent(content);
    setItems(parsed);
    setMessage(parsed.some((item) => !item.recognized) ? "Arquivo processado. Revise os itens não reconhecidos." : "Arquivo processado com sucesso.");
  }

  function resetEditor() {
    setItems([]); setProjectName("Orçamento de Projeto"); setSource("manual"); setSourceFileName(null); setSourceContent(null); setClientId(null); setSystemId(null); setEditingBudgetId(null); setBudgetStatus("novo"); setHourlyRate(DEFAULT_RATE); setCommissionPercent(DEFAULT_COMMISSION); setMessage("");
  }

  async function editBudget(id: string) {
    setMessage("Carregando orçamento...");
    const supabase = createClient();
    const [budgetResult, itemsResult] = await Promise.all([
      supabase.from("budgets").select("id,project_name,source,status,source_file_name,source_content,hourly_rate,commission_percent,client_id,system_id").eq("id", id).is("deleted_at", null).single(),
      supabase.from("budget_items").select("id,action_id,description,hours,source_line,source_text,sort_order").eq("budget_id", id).order("sort_order"),
    ]);
    if (budgetResult.error || itemsResult.error || !budgetResult.data) return setMessage("Não foi possível carregar o orçamento para edição.");
    const budget = budgetResult.data;
    setEditingBudgetId(budget.id); setProjectName(budget.project_name); setSource(budget.source as "manual" | "txt"); setBudgetStatus(budget.status as BudgetStatus); setSourceFileName(budget.source_file_name); setSourceContent(budget.source_content); setHourlyRate(Number(budget.hourly_rate)); setCommissionPercent(Number(budget.commission_percent)); setClientId(budget.client_id); setSystemId(budget.system_id);
    setItems((itemsResult.data ?? []).map((item) => ({ id: item.id, actionId: item.action_id, description: item.description, hours: Number(item.hours), sourceLine: item.source_line, sourceText: item.source_text, recognized: item.action_id !== null })));
    setMessage("Orçamento aberto para edição.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveBudget() {
    const validation = budgetSchema.safeParse({ projectName, source, sourceFileName, sourceContent, clientId, systemId, status: budgetStatus, hourlyRate, commissionPercent, items });
    if (!validation.success) return setMessage(primeiraMensagemErro(validation.error));
    setSaving(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("save_budget", {
      p_budget_id: editingBudgetId,
      p_project_name: projectName.trim(),
      p_source: source,
      p_source_file_name: sourceFileName,
      p_source_content: sourceContent,
      p_hourly_rate: hourlyRate,
      p_commission_percent: commissionPercent,
      p_client_id: clientId,
      p_system_id: systemId,
      p_status: budgetStatus,
      p_items: items.map((item) => ({ action_id: item.actionId, description: item.description, hours: item.hours, source_line: item.sourceLine, source_text: item.sourceText })),
    });
    if (error) setMessage(error.message ?? "Não foi possível salvar o orçamento.");
    else { setMessage(editingBudgetId ? "Orçamento atualizado com sucesso." : "Orçamento salvo com sucesso."); setEditingBudgetId(null); setBudgetStatus("novo"); await loadData(); }
    setSaving(false);
  }

  return <AppShell title="Orçamentos">
    <section className={styles.page}>
      <header className={styles.heading}>
        <div><span>ORÇAMENTOS</span><h1>Calculadora de projetos</h1><p>Monte manualmente ou transforme um TXT em uma estimativa revisável.</p></div>
        <div className={styles.headingActions}>
          <button className={styles.secondaryButton} onClick={() => setDictionaryOpen(true)}><Settings2 size={16} /> Configurar dicionário</button>
          <button className={styles.primaryButton} onClick={resetEditor}><Plus size={16} /> Novo orçamento</button>
        </div>
      </header>

      {message && <div className={styles.message}>{message}</div>}
      <div className={styles.workspace}>
        <div className={styles.editorCard}>
          <div className={styles.modeTabs}>
            <button className={source === "manual" ? styles.activeTab : ""} onClick={() => setSource("manual")}><Calculator size={16} /> Manual</button>
            <button className={source === "txt" ? styles.activeTab : ""} onClick={() => fileRef.current?.click()}><Upload size={16} /> Importar TXT</button>
            <input ref={fileRef} type="file" hidden accept=".txt,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importTxt(file); event.target.value = ""; }} />
          </div>

          <div className={styles.projectIdentity}>
            <label className={styles.projectNameField}><span>Nome do projeto</span><textarea rows={2} value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Descreva o projeto ou iniciativa..." /></label>
            <div className={styles.relationshipFields}>
              <label><span>Cliente <small>opcional</small></span><select value={clientId ?? ""} onChange={(event) => setClientId(event.target.value || null)}><option value="">Sem cliente vinculado</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
              <label><span>Sistema <small>opcional</small></span><select value={systemId ?? ""} onChange={(event) => setSystemId(event.target.value || null)}><option value="">Sem sistema vinculado</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select></label>
            </div>
          </div>

          <div className={styles.internalSettings}>
            <div className={styles.internalSettingsHeading}><span>PARÂMETROS INTERNOS</span><small>Não aparecem no PDF</small></div>
            <div className={styles.internalFields}>
              <label><span>Valor por hora</span><input type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => setHourlyRate(numberValue(event.target.value))} /></label>
              <label><span>Comissão (%)</span><input type="number" min="0" max="100" step="0.01" value={commissionPercent} onChange={(event) => setCommissionPercent(numberValue(event.target.value))} /></label>
              <label><span>Status</span><select value={budgetStatus} disabled={!editingBudgetId} onChange={(event) => setBudgetStatus(event.target.value as BudgetStatus)}>{BUDGET_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
            </div>
          </div>

          {sourceFileName && <div className={styles.fileBadge}><FileText size={15} /><span>{sourceFileName}</span><button aria-label="Remover arquivo" onClick={() => { setSourceFileName(null); setSourceContent(null); setSource("manual"); }}><X size={14} /></button></div>}

          <div className={styles.actionPicker}>
            <ActionCombobox actions={actions} value={selectedAction} onChange={setSelectedAction} />
            <button className={styles.primaryButton} onClick={addAction} disabled={!selectedAction}><Plus size={16} /> Adicionar</button>
          </div>

          <div className={styles.itemsTable}>
            <div className={styles.tableHeader}><span>Descrição</span><span>Horas</span><span>Valor</span><span /></div>
            {items.length === 0 ? <div className={styles.empty}><Calculator size={28} /><strong>Nenhum item adicionado</strong><span>Escolha uma ação ou importe o arquivo de escopo.</span></div> : items.map((item) => <div className={`${styles.itemRow}${!item.recognized ? ` ${styles.unrecognized}` : ""}`} key={item.id}>
              <div><input value={item.description} onChange={(event) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, description: event.target.value } : candidate))} />{item.sourceText && <small>Linha {item.sourceLine}: {item.sourceText}</small>}</div>
              <input type="number" min="0" step="0.01" value={item.hours} onChange={(event) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, hours: numberValue(event.target.value), recognized: true } : candidate))} />
              <strong>{money(item.hours * hourlyRate)}</strong>
              <button aria-label="Remover item" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}><Trash2 size={15} /></button>
            </div>)}
          </div>

          <div className={styles.editorActions}>
            <button className={styles.secondaryButton} disabled={!items.length} onClick={() => void generateBudgetPdf({ projectName, items, hourlyRate, commissionPercent })}><FileDown size={16} /> PDF clássico</button>
            <button className={styles.secondaryButton} disabled={!items.length} onClick={() => void generateRobotCenterBudgetPdf({ projectName, items, hourlyRate, commissionPercent })}><FileDown size={16} /> PDF Robot Center (prévia)</button>
            <button className={styles.primaryButton} disabled={saving || !items.length} onClick={() => void saveBudget()}><Save size={16} /> {saving ? "Salvando..." : editingBudgetId ? "Atualizar orçamento" : "Salvar orçamento"}</button>
          </div>
        </div>

        <aside className={styles.summaryCard}>
          <span className={styles.summaryEyebrow}>RESUMO</span><h2>{projectName || "Novo orçamento"}</h2>
          <dl><div><dt>Total de horas</dt><dd>{totals.hours.toFixed(2)}h</dd></div><div><dt>Valor base</dt><dd>{money(totals.subtotal)}</dd></div><div><dt>Comissão</dt><dd>{money(totals.total - totals.subtotal)}</dd></div><div className={styles.grandTotal}><dt>Valor estimado</dt><dd>{money(totals.total)}</dd></div></dl>
        </aside>
      </div>

      <section className={styles.history}><div><span>HISTÓRICO</span><h2>Orçamentos recentes</h2></div>{loading ? <p>Carregando...</p> : budgets.length === 0 ? <p>Nenhum orçamento salvo.</p> : <div className={styles.historyGrid}>{budgets.map((budget) => <article key={budget.id} data-budget-status={budget.status}><div><FileText size={17} /><strong>{budget.projectName}</strong><button className={styles.editBudgetButton} type="button" aria-label={`Editar ${budget.projectName}`} onClick={() => void editBudget(budget.id)}><Pencil size={14} /> Editar</button></div><div className={styles.budgetMeta}><span>{budget.clientName ?? "Sem cliente"}{budget.systemName ? ` • ${budget.systemName}` : ""} • {budget.source === "txt" ? "Importado de TXT" : "Manual"}</span><strong className={styles.statusBadge}>{BUDGET_STATUSES.find((status) => status.value === budget.status)?.label ?? "Novo"}</strong></div><dl><div><dt>Horas</dt><dd>{budget.totalHours.toFixed(2)}h</dd></div><div><dt>Valor estimado</dt><dd>{money(budget.estimatedValue)}</dd></div></dl><small>{new Date(budget.createdAt).toLocaleDateString("pt-BR")}{budget.robotId ? " • Vinculado a robô" : " • Sem robô vinculado"}</small></article>)}</div>}</section>
      {dictionaryOpen && <DictionaryDialog actions={actions} aliases={aliases} onClose={() => setDictionaryOpen(false)} onSaved={loadData} />}
    </section>
  </AppShell>;
}

function ActionCombobox({ actions, value, onChange }: { actions: BudgetAction[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = actions.find((action) => action.id === value);
  const visible = actions.filter((action) => action.active && normalizeBudgetText(`${action.description} ${action.category}`).includes(normalizeBudgetText(search)));
  const groups = ["RPA", "API", "Geral"].map((category) => ({ category, actions: visible.filter((action) => action.category === category) })).filter((group) => group.actions.length);
  const remaining = visible.filter((action) => !["RPA", "API", "Geral"].includes(action.category));
  if (remaining.length) groups.push({ category: "Outras", actions: remaining });

  return <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
    <Popover.Trigger asChild>
      <button type="button" className={`${styles.actionSelectTrigger}${open ? ` ${styles.isOpen}` : ""}`} aria-label="Selecionar ação">
        {selected ? <><span className={styles.actionSelectIcon}><Calculator size={15} /></span><span className={styles.actionSelectCopy}><span>{selected.description}</span><small>{selected.category}</small></span><span className={styles.hoursBadge}>{selected.defaultHours.toFixed(2)}h</span></> : <><span className={styles.actionSelectIcon}><Search size={15} /></span><span className={styles.actionSelectPlaceholder}>Selecione ou pesquise uma ação...</span></>}
        <ChevronDown className={styles.actionSelectChevron} size={16} />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className={styles.actionSelectContent} align="start" sideOffset={7} collisionPadding={14}>
        <div className={styles.actionSearch}><Search size={15} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por ação ou categoria..." /></div>
        <div className={styles.actionOptions} role="listbox">
          {groups.length === 0 ? <div className={styles.actionNoResults}>Nenhuma ação encontrada.</div> : groups.map((group) => <section key={group.category}>
            <div className={styles.actionGroupLabel}>{group.category}</div>
            {group.actions.map((action) => <button type="button" role="option" aria-selected={action.id === value} className={`${styles.actionOption}${action.id === value ? ` ${styles.isSelected}` : ""}`} key={action.id} onClick={() => { onChange(action.id); setOpen(false); }}>
              <span className={styles.actionOptionCheck}>{action.id === value ? <Check size={14} /> : null}</span>
              <span><span>{action.description}</span><small>{action.category}</small></span>
              <span className={styles.hoursBadge}>{action.defaultHours.toFixed(2)}h</span>
            </button>)}
          </section>)}
        </div>
        <div className={styles.actionSelectFooter}><BookOpen size={13} /> {visible.length} {visible.length === 1 ? "ação disponível" : "ações disponíveis"}</div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

function DictionaryDialog({ actions, aliases, onClose, onSaved }: { actions: BudgetAction[]; aliases: BudgetActionAlias[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [drafts, setDrafts] = useState(() => actions.map((action) => ({ ...action, aliases: aliases.filter((alias) => alias.actionId === action.id).map((alias) => alias.alias).join(", ") })));
  const [newAction, setNewAction] = useState({ category: "RPA", description: "", hours: 0, aliases: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  async function save() {
    setSaving(true); const supabase = createClient();
    for (const draft of drafts) {
      await supabase.from("budget_action_catalog").update({ description: draft.description.trim(), default_hours: draft.defaultHours, active: draft.active }).eq("id", draft.id);
      const existing = aliases.filter((alias) => alias.actionId === draft.id);
      const requested = draft.aliases.split(",").map((value) => value.trim()).filter(Boolean);
      for (const alias of existing) await supabase.from("budget_action_aliases").update({ active: requested.includes(alias.alias) }).eq("id", alias.id);
      const existingValues = new Set(existing.map((alias) => alias.alias));
      const fresh = requested.filter((alias) => !existingValues.has(alias));
      if (fresh.length) await supabase.from("budget_action_aliases").insert(fresh.map((alias) => ({ action_id: draft.id, alias, priority: 50 })));
    }
    if (newAction.description.trim()) {
      const code = `custom-${crypto.randomUUID()}`;
      const { data } = await supabase.from("budget_action_catalog").insert({ code, category: newAction.category, description: newAction.description.trim(), default_hours: newAction.hours, sort_order: 900 }).select("id").single();
      const freshAliases = newAction.aliases.split(",").map((value) => value.trim()).filter(Boolean);
      if (data && freshAliases.length) await supabase.from("budget_action_aliases").insert(freshAliases.map((alias) => ({ action_id: data.id, alias, priority: 50 })));
    }
    await onSaved(); setSaving(false); onClose();
  }
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={styles.dictionaryDialog} role="dialog" aria-modal="true" aria-labelledby="dictionary-title">
    <header><div><BookOpen size={19} /><div><span>DICIONÁRIO</span><h2 id="dictionary-title">Ações e termos do TXT</h2></div></div><button aria-label="Fechar" onClick={onClose}><X size={18} /></button></header>
    <p>Uma única configuração alimenta o modo manual e o reconhecimento dos arquivos.</p>
    <div className={styles.dictionaryTable}><div className={styles.dictionaryHeader}><span>Ação</span><span>Horas</span><span>Termos no TXT</span><span>Ativa</span></div>{drafts.map((draft) => <div className={styles.dictionaryRow} key={draft.id}><input value={draft.description} onChange={(event) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, description: event.target.value } : item))} /><input type="number" min="0" step="0.01" value={draft.defaultHours} onChange={(event) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, defaultHours: numberValue(event.target.value) } : item))} /><input value={draft.aliases} placeholder="termo 1, termo 2" onChange={(event) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, aliases: event.target.value } : item))} /><input type="checkbox" checked={draft.active} onChange={(event) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, active: event.target.checked } : item))} /></div>)}</div>
    <div className={styles.newDictionaryAction}><strong>Nova ação</strong><select value={newAction.category} onChange={(event) => setNewAction((current) => ({ ...current, category: event.target.value }))}><option>RPA</option><option>API</option><option>Geral</option></select><input placeholder="Descrição" value={newAction.description} onChange={(event) => setNewAction((current) => ({ ...current, description: event.target.value }))} /><input type="number" min="0" step="0.01" value={newAction.hours} onChange={(event) => setNewAction((current) => ({ ...current, hours: numberValue(event.target.value) }))} /><input placeholder="Termos separados por vírgula" value={newAction.aliases} onChange={(event) => setNewAction((current) => ({ ...current, aliases: event.target.value }))} /></div>
    <footer><button className={styles.secondaryButton} onClick={onClose}>Cancelar</button><button className={styles.primaryButton} disabled={saving} onClick={() => void save()}><Save size={15} /> {saving ? "Salvando..." : "Salvar dicionário"}</button></footer>
  </section></div>;
}
