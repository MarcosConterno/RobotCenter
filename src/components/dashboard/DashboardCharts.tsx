"use client";

import { BarChart3, ChevronDown, Circle, Disc3, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import type { Cliente, Robo } from "@/domain/entities";

import styles from "./DashboardCharts.module.css";

type FilterKey = "clientId" | "courtName" | "system" | "stack" | "id" | "name" | "productType" | "package" | "environment" | "status" | "queue" | "version" | "command" | "responsible" | "trigger" | "tribunal" | "tribunalSystem" | "description" | "idealMin" | "idealMax" | "capacityMin" | "capacityMax" | "documentation";
type Filters = Record<FilterKey, string>;
type ChartItem = { label: string; value: number };
type ChartId = "clients" | "courts" | "systems" | "stacks";
type ChartMode = "bars" | "pie" | "donut";

const EMPTY_FILTERS: Filters = {
  clientId: "", courtName: "", system: "", stack: "", id: "", name: "", productType: "", package: "", environment: "", status: "", queue: "", version: "", command: "", responsible: "", trigger: "", tribunal: "", tribunalSystem: "", description: "", idealMin: "", idealMax: "", capacityMin: "", capacityMax: "", documentation: "",
};
const NOT_INFORMED = "Não informado";

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
  const [chartModes, setChartModes] = useState<Record<ChartId, ChartMode>>({ clients: "donut", courts: "bars", systems: "pie", stacks: "donut" });
  const [expandedCharts, setExpandedCharts] = useState<Record<ChartId, boolean>>({ clients: false, courts: false, systems: false, stacks: false });
  const clientNames = useMemo(() => new Map(clients.map((client) => [client.id, client.nome])), [clients]);
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
  const charts = useMemo(() => [
    { id: "clients" as const, title: "Robôs por cliente", description: "Distribuição da carteira por empresa", items: distribution(filteredRobots, (robot) => robot.clienteId ? clientNames.get(robot.clienteId) ?? NOT_INFORMED : "Sem cliente") },
    { id: "courts" as const, title: "Robôs por CourtName", description: "Concentração por tribunal ou corte", items: distribution(filteredRobots, (robot) => robot.courtName) },
    { id: "systems" as const, title: "Robôs por sistema", description: "Tecnologias e sistemas atendidos", items: distribution(filteredRobots, (robot) => robot.sistema) },
    { id: "stacks" as const, title: "Robôs por Stack", description: "Distribuição da infraestrutura operacional", items: distribution(filteredRobots, (robot) => robot.stack) },
  ], [clientNames, filteredRobots]);

  function updateFilter(key: FilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className={styles.dashboard} aria-label="Dashboard gráfica de robôs">
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.headingIcon}><BarChart3 size={18} /></span>
          <div><h2>Dashboards gráficas</h2><p>Analise a distribuição dos robôs e combine filtros operacionais.</p></div>
        </div>
        <span className={styles.resultCount}>{filteredRobots.length} de {robots.length} robôs</span>
      </header>

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

      {filteredRobots.length ? (
        <div className={styles.chartGrid}>
          {charts.map((chart) => <ChartCard
            key={chart.id}
            {...chart}
            mode={chartModes[chart.id]}
            expanded={expandedCharts[chart.id]}
            onModeChange={(mode) => setChartModes((current) => ({ ...current, [chart.id]: mode }))}
            onExpandedChange={() => setExpandedCharts((current) => ({ ...current, [chart.id]: !current[chart.id] }))}
          />)}
        </div>
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

function ChartCard({ title, description, items, mode, expanded, onModeChange, onExpandedChange }: { id: ChartId; title: string; description: string; items: ChartItem[]; mode: ChartMode; expanded: boolean; onModeChange: (mode: ChartMode) => void; onExpandedChange: () => void }) {
  const compactItems = items.length > 8
    ? [...items.slice(0, 7), { label: "Outros", value: items.slice(7).reduce((sum, item) => sum + item.value, 0) }]
    : items;
  const visibleItems = expanded ? items : compactItems;
  return <article className={styles.chart}>
    <header>
      <div><h3>{title}</h3><p>{description}</p></div>
      <span>{items.reduce((sum, item) => sum + item.value, 0)}</span>
    </header>
    <div className={styles.chartToolbar} role="group" aria-label={`Tipo de gráfico para ${title}`}>
      <ChartModeButton active={mode === "bars"} label="Barras" onClick={() => onModeChange("bars")}><BarChart3 size={13} /></ChartModeButton>
      <ChartModeButton active={mode === "pie"} label="Pizza" onClick={() => onModeChange("pie")}><Circle size={13} /></ChartModeButton>
      <ChartModeButton active={mode === "donut"} label="Rosca" onClick={() => onModeChange("donut")}><Disc3 size={13} /></ChartModeButton>
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
