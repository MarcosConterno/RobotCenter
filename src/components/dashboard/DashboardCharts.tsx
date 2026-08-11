"use client";

import { BarChart3, ChevronDown, Circle, Disc3, Plus, RotateCcw, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Cliente, Robo } from "@/domain/entities";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database.types";

import styles from "./DashboardCharts.module.css";

type FilterKey = "clientId" | "courtName" | "system" | "stack" | "id" | "name" | "productType" | "package" | "environment" | "status" | "queue" | "version" | "command" | "responsible" | "trigger" | "tribunal" | "tribunalSystem" | "description" | "idealMin" | "idealMax" | "capacityMin" | "capacityMax" | "documentation";
type Filters = Record<FilterKey, string>;
type ChartItem = { label: string; value: number };
type ChartMode = "bars" | "pie" | "donut";
type ChartDimension = "client" | "courtName" | "system" | "stack" | "product" | "package" | "environment" | "status" | "queue" | "version" | "responsible" | "trigger" | "tribunal" | "tribunalSystem" | "documentation" | "idealRange" | "capacityRange" | "name" | "command";
type ChartConfig = { id: string; dimension: ChartDimension; mode: ChartMode };

const EMPTY_FILTERS: Filters = {
  clientId: "", courtName: "", system: "", stack: "", id: "", name: "", productType: "", package: "", environment: "", status: "", queue: "", version: "", command: "", responsible: "", trigger: "", tribunal: "", tribunalSystem: "", description: "", idealMin: "", idealMax: "", capacityMin: "", capacityMax: "", documentation: "",
};
const NOT_INFORMED = "Não informado";
const DEFAULT_CHARTS: ChartConfig[] = [
  { id: "default-client", dimension: "client", mode: "donut" },
  { id: "default-court", dimension: "courtName", mode: "bars" },
  { id: "default-system", dimension: "system", mode: "pie" },
  { id: "default-stack", dimension: "stack", mode: "donut" },
];
const CHART_DIMENSIONS: { value: ChartDimension; label: string; description: string }[] = [
  { value: "client", label: "Cliente", description: "Distribuição da carteira por empresa" },
  { value: "courtName", label: "CourtName", description: "Concentração por tribunal ou corte" },
  { value: "system", label: "Sistema", description: "Tecnologias e sistemas atendidos" },
  { value: "stack", label: "Stack", description: "Infraestrutura operacional" },
  { value: "product", label: "Produto", description: "Tipos de produto dos robôs" },
  { value: "package", label: "Pacote", description: "Pacotes operacionais cadastrados" },
  { value: "environment", label: "Ambiente", description: "Distribuição entre ambientes" },
  { value: "status", label: "Status", description: "Robôs ativos e inativos" },
  { value: "queue", label: "Fila", description: "Filas configuradas" },
  { value: "version", label: "Versão", description: "Versões atualmente cadastradas" },
  { value: "responsible", label: "Responsável", description: "Responsáveis pelos robôs" },
  { value: "trigger", label: "Disparo", description: "Formas de execução" },
  { value: "tribunal", label: "Tribunal", description: "Tribunais vinculados" },
  { value: "tribunalSystem", label: "Sistema do tribunal", description: "Sistemas judiciais vinculados" },
  { value: "documentation", label: "Documentação", description: "Cobertura documental dos robôs" },
  { value: "idealRange", label: "Faixa de capacidade ideal", description: "Distribuição da capacidade ideal" },
  { value: "capacityRange", label: "Faixa de capacidade máxima", description: "Distribuição da capacidade máxima" },
  { value: "name", label: "Nome do robô", description: "Ocorrências por nome cadastrado" },
  { value: "command", label: "Command", description: "Commands cadastrados" },
];
const DIMENSION_KEYS = new Set(CHART_DIMENSIONS.map((item) => item.value));
const MODE_KEYS = new Set<ChartMode>(["bars", "pie", "donut"]);

function normalized(value: string | null | undefined) {
  return value?.trim() || NOT_INFORMED;
}

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function contains(value: string | null | undefined, search: string) {
  return normalized(value).toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"));
}

function minimumMatches(value: number, filter: string) {
  return !filter || value >= Number(filter);
}

function maximumMatches(value: number, filter: string) {
  return !filter || value <= Number(filter);
}

function capacityRange(value: number) {
  if (value === 0) return "0";
  if (value <= 5) return "1–5";
  if (value <= 10) return "6–10";
  if (value <= 20) return "11–20";
  if (value <= 50) return "21–50";
  return "Acima de 50";
}

function validChartConfigs(value: unknown): ChartConfig[] | null {
  if (!Array.isArray(value)) return null;
  const configs = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ChartConfig>;
    return typeof candidate.id === "string" && candidate.id.length <= 100
      && typeof candidate.dimension === "string" && DIMENSION_KEYS.has(candidate.dimension as ChartDimension)
      && typeof candidate.mode === "string" && MODE_KEYS.has(candidate.mode as ChartMode)
      ? [{ id: candidate.id, dimension: candidate.dimension as ChartDimension, mode: candidate.mode as ChartMode }]
      : [];
  });
  return configs.length === value.length && configs.length <= 20 ? configs : null;
}

function distribution(robots: Robo[], getLabel: (robot: Robo) => string): ChartItem[] {
  const counts = new Map<string, number>();
  robots.forEach((robot) => {
    const label = normalized(getLabel(robot));
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  const ordered = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
  return ordered;
}

export default function DashboardCharts({ robots, clients }: { robots: Robo[]; clients: Cliente[] }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [chartConfigs, setChartConfigs] = useState<ChartConfig[]>(DEFAULT_CHARTS);
  const [expandedCharts, setExpandedCharts] = useState<Record<string, boolean>>({});
  const [layoutReady, setLayoutReady] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState("");
  const clientNames = useMemo(() => new Map(clients.map((client) => [client.id, client.nome])), [clients]);

  useEffect(() => {
    let active = true;
    const loadLayout = async () => {
      const supabase = createClient();
      const { data: claimsData } = await supabase.auth.getClaims();
      const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
      if (!userId) { if (active) setLayoutReady(true); return; }
      const { data, error } = await supabase.from("dashboard_chart_preferences").select("cards").eq("user_id", userId).maybeSingle();
      if (!active) return;
      if (!error && data) {
        const saved = validChartConfigs(data.cards);
        if (saved) setChartConfigs(saved);
      }
      setLayoutReady(true);
    };
    void loadLayout();
    return () => { active = false; };
  }, []);
  const options = useMemo(() => ({
    clients: [...clients].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    courtNames: unique(robots.map((robot) => normalized(robot.courtName))),
    systems: unique(robots.map((robot) => normalized(robot.sistema))),
    stacks: unique(robots.map((robot) => normalized(robot.stack))),
    packages: unique(robots.map((robot) => normalized(robot.pacote))),
    environments: unique(robots.map((robot) => normalized(robot.ambiente))),
    queues: unique(robots.map((robot) => normalized(robot.fila))),
    versions: unique(robots.map((robot) => normalized(robot.versao))),
    responsibles: unique(robots.map((robot) => normalized(robot.responsavel))),
    tribunals: unique(robots.map((robot) => normalized(robot.tribunal))),
    tribunalSystems: unique(robots.map((robot) => normalized(robot.tribunalSystem))),
  }), [clients, robots]);
  const filteredRobots = useMemo(() => robots.filter((robot) => (
    (!filters.clientId || (robot.clienteId ?? "unassigned") === filters.clientId)
    && (!filters.courtName || normalized(robot.courtName) === filters.courtName)
    && (!filters.system || normalized(robot.sistema) === filters.system)
    && (!filters.stack || normalized(robot.stack) === filters.stack)
    && (!filters.id || contains(robot.id, filters.id))
    && (!filters.name || contains(robot.nome, filters.name))
    && (!filters.productType || robot.productType === filters.productType)
    && (!filters.package || normalized(robot.pacote) === filters.package)
    && (!filters.environment || normalized(robot.ambiente) === filters.environment)
    && (!filters.status || (filters.status === "active" ? robot.ativo : !robot.ativo))
    && (!filters.queue || normalized(robot.fila) === filters.queue)
    && (!filters.version || normalized(robot.versao) === filters.version)
    && (!filters.command || contains(robot.command, filters.command))
    && (!filters.responsible || normalized(robot.responsavel) === filters.responsible)
    && (!filters.trigger || normalized(robot.disparo) === filters.trigger)
    && (!filters.tribunal || normalized(robot.tribunal) === filters.tribunal)
    && (!filters.tribunalSystem || normalized(robot.tribunalSystem) === filters.tribunalSystem)
    && (!filters.description || contains(robot.descricao, filters.description))
    && minimumMatches(robot.ideal, filters.idealMin)
    && maximumMatches(robot.ideal, filters.idealMax)
    && minimumMatches(robot.max, filters.capacityMin)
    && maximumMatches(robot.max, filters.capacityMax)
    && (!filters.documentation || (
      filters.documentation === "uploaded" ? Boolean(robot.uploadedDocuments?.length || robot.uploadedDocumentationPath)
        : filters.documentation === "internal" ? Boolean(robot.robotCenterDocumentation)
          : filters.documentation === "any" ? Boolean(robot.uploadedDocuments?.length || robot.uploadedDocumentationPath || robot.robotCenterDocumentation)
            : !robot.uploadedDocuments?.length && !robot.uploadedDocumentationPath && !robot.robotCenterDocumentation
    ))
  )), [filters, robots]);
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const charts = useMemo(() => chartConfigs.map((config) => {
    const definition = CHART_DIMENSIONS.find((item) => item.value === config.dimension) ?? CHART_DIMENSIONS[0]!;
    const getLabel = (robot: Robo) => {
      switch (config.dimension) {
        case "client": return robot.clienteId ? clientNames.get(robot.clienteId) ?? NOT_INFORMED : "Sem cliente";
        case "courtName": return robot.courtName;
        case "system": return robot.sistema;
        case "stack": return robot.stack;
        case "product": return ({ INTEGRADOR: "Robôs Integradores", CONSULTA_PROCESSUAL: "Consulta Processual", PETICIONAMENTO: "Peticionamento", MOVIMENTO: "Movimento" } as const)[robot.productType];
        case "package": return robot.pacote;
        case "environment": return robot.ambiente;
        case "status": return robot.ativo ? "Ativo" : "Inativo";
        case "queue": return robot.fila;
        case "version": return robot.versao;
        case "responsible": return robot.responsavel;
        case "trigger": return robot.disparo ?? NOT_INFORMED;
        case "tribunal": return robot.tribunal ?? NOT_INFORMED;
        case "tribunalSystem": return robot.tribunalSystem ?? NOT_INFORMED;
        case "documentation": return robot.robotCenterDocumentation ? "Robot Center" : robot.uploadedDocuments?.length || robot.uploadedDocumentationPath ? "Documentação Upada" : "Sem documentação";
        case "idealRange": return capacityRange(robot.ideal);
        case "capacityRange": return capacityRange(robot.max);
        case "name": return robot.nome;
        case "command": return robot.command;
      }
    };
    return { ...config, title: `Robôs por ${definition.label}`, description: definition.description, items: distribution(filteredRobots, getLabel) };
  }), [chartConfigs, clientNames, filteredRobots]);

  function updateFilter(key: FilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function addChart() {
    if (chartConfigs.length >= 20) { setLayoutMessage("O limite é de 20 quadros por usuário."); return; }
    setChartConfigs((current) => [...current, { id: crypto.randomUUID(), dimension: "product", mode: "bars" }]);
    setLayoutMessage("");
  }

  function updateChart(id: string, changes: Partial<Omit<ChartConfig, "id">>) {
    setChartConfigs((current) => current.map((chart) => chart.id === id ? { ...chart, ...changes } : chart));
    setLayoutMessage("");
  }

  function removeChart(id: string) {
    setChartConfigs((current) => current.filter((chart) => chart.id !== id));
    setLayoutMessage("");
  }

  async function saveLayout() {
    setSavingLayout(true);
    setLayoutMessage("");
    const supabase = createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (!userId) { setSavingLayout(false); setLayoutMessage("Sessão inválida. Entre novamente para salvar o layout."); return; }
    const { error } = await supabase.from("dashboard_chart_preferences").upsert({ user_id: userId, cards: chartConfigs as unknown as Json }, { onConflict: "user_id" });
    setSavingLayout(false);
    setLayoutMessage(error ? "Não foi possível salvar. Confirme se a migration da Dashboard foi aplicada." : "Layout salvo no Supabase Cloud.");
  }

  return (
    <section className={styles.dashboard} aria-label="Dashboard gráfica de robôs">
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.headingIcon}><BarChart3 size={18} /></span>
          <div><h2>Dashboards gráficas</h2><p>Analise a distribuição dos robôs e combine filtros operacionais.</p></div>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.resultCount}>{filteredRobots.length} de {robots.length} robôs</span>
          <button type="button" className={styles.addChartButton} onClick={addChart} disabled={!layoutReady || chartConfigs.length >= 20}><Plus size={14} /> Novo quadro</button>
          <button type="button" className={styles.saveLayoutButton} onClick={() => void saveLayout()} disabled={!layoutReady || savingLayout}><Save size={14} /> {savingLayout ? "Salvando..." : "Salvar layout"}</button>
        </div>
      </header>
      {layoutMessage ? <div className={styles.layoutMessage} role="status">{layoutMessage}</div> : null}

      <div className={styles.filters}>
        <div className={styles.filtersTitle}><SlidersHorizontal size={15} /><span>Filtros</span>{activeFilters > 0 ? <strong>{activeFilters}</strong> : null}</div>
        <Filter label="Cliente" value={filters.clientId} onChange={(value) => updateFilter("clientId", value)}>
          {options.clients.map((client) => <option key={client.id} value={client.id}>{client.nome}</option>)}
          {robots.some((robot) => !robot.clienteId) ? <option value="unassigned">Sem cliente</option> : null}
        </Filter>
        <Filter label="CourtName" value={filters.courtName} onChange={(value) => updateFilter("courtName", value)} options={options.courtNames} />
        <Filter label="Sistema" value={filters.system} onChange={(value) => updateFilter("system", value)} options={options.systems} />
        <Filter label="Stack" value={filters.stack} onChange={(value) => updateFilter("stack", value)} options={options.stacks} />
        <button type="button" className={`${styles.moreButton}${moreFiltersOpen ? ` ${styles.open}` : ""}`} aria-expanded={moreFiltersOpen} aria-controls="dashboard-more-filters" onClick={() => setMoreFiltersOpen((current) => !current)}>
          Mais filtros <ChevronDown size={14} />
        </button>
        <button type="button" className={styles.clearButton} onClick={() => setFilters(EMPTY_FILTERS)} disabled={activeFilters === 0}><RotateCcw size={14} /> Limpar</button>
        {moreFiltersOpen ? <div id="dashboard-more-filters" className={styles.moreFilters}>
          <TextFilter label="ID do robô" value={filters.id} onChange={(value) => updateFilter("id", value)} placeholder="Buscar UUID" />
          <TextFilter label="Nome" value={filters.name} onChange={(value) => updateFilter("name", value)} placeholder="Nome contém..." />
          <Filter label="Produto" value={filters.productType} onChange={(value) => updateFilter("productType", value)}>
            <option value="INTEGRADOR">Robôs Integradores</option><option value="CONSULTA_PROCESSUAL">Consulta Processual</option><option value="PETICIONAMENTO">Peticionamento</option><option value="MOVIMENTO">Movimento</option>
          </Filter>
          <Filter label="Pacote" value={filters.package} onChange={(value) => updateFilter("package", value)} options={options.packages} />
          <Filter label="Ambiente" value={filters.environment} onChange={(value) => updateFilter("environment", value)} options={options.environments} />
          <Filter label="Status" value={filters.status} onChange={(value) => updateFilter("status", value)}><option value="active">Ativo</option><option value="inactive">Inativo</option></Filter>
          <Filter label="Fila" value={filters.queue} onChange={(value) => updateFilter("queue", value)} options={options.queues} />
          <Filter label="Versão" value={filters.version} onChange={(value) => updateFilter("version", value)} options={options.versions} />
          <TextFilter label="Command" value={filters.command} onChange={(value) => updateFilter("command", value)} placeholder="Command contém..." />
          <Filter label="Responsável" value={filters.responsible} onChange={(value) => updateFilter("responsible", value)} options={options.responsibles} />
          <Filter label="Disparo" value={filters.trigger} onChange={(value) => updateFilter("trigger", value)}><option value="Agendado">Agendado</option><option value="Manual">Manual</option><option value="Gatilho">Gatilho</option></Filter>
          <Filter label="Tribunal" value={filters.tribunal} onChange={(value) => updateFilter("tribunal", value)} options={options.tribunals} />
          <Filter label="Sistema do tribunal" value={filters.tribunalSystem} onChange={(value) => updateFilter("tribunalSystem", value)} options={options.tribunalSystems} />
          <TextFilter label="Descrição" value={filters.description} onChange={(value) => updateFilter("description", value)} placeholder="Descrição contém..." />
          <NumberFilter label="Ideal mínimo" value={filters.idealMin} onChange={(value) => updateFilter("idealMin", value)} />
          <NumberFilter label="Ideal máximo" value={filters.idealMax} onChange={(value) => updateFilter("idealMax", value)} />
          <NumberFilter label="Capacidade mínima" value={filters.capacityMin} onChange={(value) => updateFilter("capacityMin", value)} />
          <NumberFilter label="Capacidade máxima" value={filters.capacityMax} onChange={(value) => updateFilter("capacityMax", value)} />
          <Filter label="Documentação" value={filters.documentation} onChange={(value) => updateFilter("documentation", value)}><option value="any">Com documentação</option><option value="uploaded">Documentação Upada</option><option value="internal">Documentação Robot Center</option><option value="none">Sem documentação</option></Filter>
        </div> : null}
      </div>

        {filteredRobots.length > 0 && charts.length > 0 ? (
        <div className={styles.chartGrid}>
          {charts.map((chart) => <ChartCard
            key={chart.id}
            {...chart}
                expanded={expandedCharts[chart.id] === true}
            onDimensionChange={(dimension) => updateChart(chart.id, { dimension })}
            onModeChange={(mode) => updateChart(chart.id, { mode })}
            onRemove={() => removeChart(chart.id)}
            onExpandedChange={() => setExpandedCharts((current) => ({ ...current, [chart.id]: !current[chart.id] }))}
          />)}
        </div>
      ) : filteredRobots.length ? (
        <div className={styles.empty}><BarChart3 size={28} /><strong>Seu painel está vazio</strong><span>Use “Novo quadro” para escolher um contexto e uma visualização.</span></div>
      ) : (
        <div className={styles.empty}><BarChart3 size={28} /><strong>Nenhum robô encontrado</strong><span>Altere ou limpe os filtros para visualizar os gráficos.</span></div>
      )}
    </section>
  );
}

function Filter({ label, value, onChange, options, children }: { label: string; value: string; onChange: (value: string) => void; options?: string[]; children?: React.ReactNode }) {
  return <label className={styles.filter}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Todos</option>{children ?? options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function TextFilter({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className={styles.filter}><span>{label}</span><input type="search" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className={styles.filter}><span>{label}</span><input type="number" min={0} step={1} value={value} placeholder="Qualquer" onChange={(event) => onChange(event.target.value)} /></label>;
}

function ChartCard({ dimension, title, description, items, mode, expanded, onDimensionChange, onModeChange, onRemove, onExpandedChange }: { id: string; dimension: ChartDimension; title: string; description: string; items: ChartItem[]; mode: ChartMode; expanded: boolean; onDimensionChange: (dimension: ChartDimension) => void; onModeChange: (mode: ChartMode) => void; onRemove: () => void; onExpandedChange: () => void }) {
  const compactItems = items.length > 8
    ? [...items.slice(0, 7), { label: "Outros", value: items.slice(7).reduce((sum, item) => sum + item.value, 0) }]
    : items;
  const visibleItems = expanded ? items : compactItems;
  return <article className={styles.chart}>
    <header>
      <div><h3>{title}</h3><p>{description}</p></div>
      <div className={styles.cardHeaderActions}><span>{items.reduce((sum, item) => sum + item.value, 0)}</span><button type="button" onClick={onRemove} aria-label={`Remover quadro ${title}`} title="Remover quadro"><Trash2 size={14} /></button></div>
    </header>
    <div className={styles.chartToolbar}>
      <label><span>Contexto</span><select value={dimension} onChange={(event) => onDimensionChange(event.target.value as ChartDimension)}>{CHART_DIMENSIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div role="group" aria-label={`Tipo de gráfico para ${title}`}>
        <ChartModeButton active={mode === "bars"} label="Barras" onClick={() => onModeChange("bars")}><BarChart3 size={13} /></ChartModeButton>
        <ChartModeButton active={mode === "pie"} label="Pizza" onClick={() => onModeChange("pie")}><Circle size={13} /></ChartModeButton>
        <ChartModeButton active={mode === "donut"} label="Rosca" onClick={() => onModeChange("donut")}><Disc3 size={13} /></ChartModeButton>
      </div>
    </div>
    {mode === "bars" ? <HorizontalBars items={visibleItems} /> : <RadialChart items={visibleItems} donut={mode === "donut"} />}
    {items.length > 8 ? <footer className={styles.chartFooter}><button type="button" onClick={onExpandedChange}>{expanded ? "Mostrar menos" : `Ver todos (${items.length})`}</button></footer> : null}
  </article>;
}

function ChartModeButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={active ? styles.activeMode : undefined} aria-pressed={active} onClick={onClick}>{children}{label}</button>;
}

function HorizontalBars({ items }: { items: ChartItem[] }) {
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return <div className={styles.bars}>{items.map((item) => <div className={styles.barRow} key={item.label}><div className={styles.barLabel}><span title={item.label}>{item.label}</span><strong>{item.value}</strong></div><div className={styles.barTrack}><span style={{ width: `${Math.max((item.value / maximum) * 100, 3)}%` }} /></div></div>)}</div>;
}

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#84cc16", "#14b8a6", "#eab308", "#a855f7"];

function pointAt(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: 100 + radius * Math.cos(radians), y: 100 + radius * Math.sin(radians) };
}

function sectorPath(startAngle: number, endAngle: number, innerRadius: number) {
  const safeEnd = endAngle - startAngle >= 360 ? startAngle + 359.999 : endAngle;
  const outerStart = pointAt(startAngle, 78);
  const outerEnd = pointAt(safeEnd, 78);
  const largeArc = safeEnd - startAngle > 180 ? 1 : 0;
  if (!innerRadius) return `M 100 100 L ${outerStart.x} ${outerStart.y} A 78 78 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} Z`;
  const innerEnd = pointAt(safeEnd, innerRadius);
  const innerStart = pointAt(startAngle, innerRadius);
  return `M ${outerStart.x} ${outerStart.y} A 78 78 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
}

function RadialChart({ items, donut }: { items: ChartItem[]; donut: boolean }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;
  return <div className={styles.radialLayout}>
    <div className={styles.radialGraphic}>
      <svg viewBox="0 0 200 200" role="img" aria-label={`${donut ? "Gráfico de rosca" : "Gráfico de pizza"} com ${items.length} categorias`}>
        {items.map((item, index) => {
          const startAngle = currentAngle;
          const endAngle = startAngle + (item.value / total) * 360;
          currentAngle = endAngle;
          return <path key={item.label} d={sectorPath(startAngle, endAngle, donut ? 46 : 0)} fill={CHART_COLORS[index % CHART_COLORS.length]}><title>{item.label}: {item.value}</title></path>;
        })}
      </svg>
      {donut ? <div className={styles.donutCenter}><strong>{total}</strong><span>robôs</span></div> : null}
    </div>
    <div className={styles.legend}>{items.map((item, index) => <div key={item.label}><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} /><span title={item.label}>{item.label}</span><strong>{item.value}</strong></div>)}</div>
  </div>;
}
