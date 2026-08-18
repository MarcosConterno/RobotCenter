"use client";

import { Bot, ChevronDown, Layers3, ListFilter, RotateCcw, Search, SlidersHorizontal, Users } from "lucide-react";
import { useMemo, useState } from "react";

import type { Cliente, Robo } from "@/domain/entities";

import styles from "./StackMap.module.css";

type Filters = {
  search: string;
  clientId: string;
  stack: string;
  system: string;
  environment: string;
  status: string;
  responsible: string;
  trigger: string;
  kortex: string;
};
type BarOrder = "stacks-desc" | "stacks-asc" | "robots-desc" | "name-asc" | "name-desc";

const EMPTY_FILTERS: Filters = { search: "", clientId: "", stack: "", system: "", environment: "", status: "", responsible: "", trigger: "", kortex: "" };
const NOT_INFORMED = "Não informado";
const NO_STACK = "Sem stack";

function text(value: string | null | undefined, fallback = NOT_INFORMED) {
  return value?.trim() || fallback;
}

function key(value: string | null | undefined) {
  return text(value).toLocaleLowerCase("pt-BR");
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => text(value)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export default function StackMap({ robots, clients, onOpenRobot }: { robots: Robo[]; clients: Cliente[]; onOpenRobot: (robot: Robo) => void }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [barOrder, setBarOrder] = useState<BarOrder>("stacks-desc");
  const [showAllBars, setShowAllBars] = useState(false);
  const clientNames = useMemo(() => new Map(clients.map((client) => [client.id, client.nome])), [clients]);
  const options = useMemo(() => ({
    stacks: unique(robots.map((robot) => robot.stack || NO_STACK)),
    systems: unique(robots.map((robot) => robot.sistema)),
    environments: unique(robots.map((robot) => robot.ambiente)),
    responsibles: unique(robots.map((robot) => robot.responsavel)),
    triggers: unique(robots.map((robot) => robot.disparo)),
  }), [robots]);

  const filteredRobots = useMemo(() => robots.filter((robot) => {
    const clientName = robot.clienteId ? clientNames.get(robot.clienteId) ?? NOT_INFORMED : "Sem cliente";
    const searchable = [clientName, robot.stack, robot.sistema, robot.nome, robot.courtName, robot.descricao, robot.ambiente, robot.responsavel, robot.disparo, robot.fila, robot.command, robot.tribunal, robot.tribunalSystem].join(" ").toLocaleLowerCase("pt-BR");
    return (!filters.search || searchable.includes(filters.search.trim().toLocaleLowerCase("pt-BR")))
      && (!filters.clientId || (robot.clienteId ?? "unassigned") === filters.clientId)
      && (!filters.stack || text(robot.stack, NO_STACK) === filters.stack)
      && (!filters.system || text(robot.sistema) === filters.system)
      && (!filters.environment || text(robot.ambiente) === filters.environment)
      && (!filters.status || (filters.status === "active" ? robot.ativo : !robot.ativo))
      && (!filters.responsible || text(robot.responsavel) === filters.responsible)
      && (!filters.trigger || text(robot.disparo) === filters.trigger)
      && (!filters.kortex || (filters.kortex === "yes" ? robot.kortex : !robot.kortex));
  }), [clientNames, filters, robots]);

  const groups = useMemo(() => {
    const byClient = new Map<string, { id: string; name: string; robots: Robo[] }>();
    if (!Object.values(filters).some(Boolean)) {
      clients.forEach((client) => byClient.set(client.id, { id: client.id, name: client.nome, robots: [] }));
    } else if (filters.clientId) {
      const selected = clients.find((client) => client.id === filters.clientId);
      if (selected) byClient.set(selected.id, { id: selected.id, name: selected.nome, robots: [] });
    }
    filteredRobots.forEach((robot) => {
      const id = robot.clienteId ?? "unassigned";
      const name = robot.clienteId ? clientNames.get(robot.clienteId) ?? NOT_INFORMED : "Sem cliente";
      const group = byClient.get(id) ?? { id, name, robots: [] };
      group.robots.push(robot);
      byClient.set(id, group);
    });
    return [...byClient.values()].map((client) => {
      const byStack = new Map<string, Robo[]>();
      client.robots.forEach((robot) => {
        const stack = text(robot.stack, NO_STACK);
        byStack.set(stack, [...(byStack.get(stack) ?? []), robot]);
      });
      return { ...client, stacks: [...byStack.entries()].map(([name, stackRobots]) => ({ name, robots: stackRobots })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
    }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [clientNames, clients, filteredRobots, filters]);

  const stackCount = new Set(filteredRobots.filter((robot) => robot.stack.trim()).map((robot) => `${robot.clienteId ?? "unassigned"}:${key(robot.stack)}`)).size;
  const systemCount = new Set(filteredRobots.map((robot) => key(robot.sistema))).size;
  const maxStacks = Math.max(1, ...groups.map((group) => group.stacks.filter((stack) => stack.name !== NO_STACK).length));
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const orderedBarGroups = useMemo(() => [...groups].sort((a, b) => {
    const aStacks = a.stacks.filter((stack) => stack.name !== NO_STACK).length;
    const bStacks = b.stacks.filter((stack) => stack.name !== NO_STACK).length;
    if (barOrder === "stacks-desc") return bStacks - aStacks || b.robots.length - a.robots.length || a.name.localeCompare(b.name, "pt-BR");
    if (barOrder === "stacks-asc") return aStacks - bStacks || a.name.localeCompare(b.name, "pt-BR");
    if (barOrder === "robots-desc") return b.robots.length - a.robots.length || bStacks - aStacks || a.name.localeCompare(b.name, "pt-BR");
    if (barOrder === "name-desc") return b.name.localeCompare(a.name, "pt-BR");
    return a.name.localeCompare(b.name, "pt-BR");
  }), [barOrder, groups]);
  const visibleBarGroups = showAllBars ? orderedBarGroups : orderedBarGroups.slice(0, 5);

  function updateFilter(name: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function toggle(id: string) {
    setExpanded((current) => ({ ...current, [id]: !current[id] }));
  }

  function focusClient(id: string) {
    updateFilter("clientId", filters.clientId === id ? "" : id);
  }

  return (
    <section className={styles.map} aria-label="Mapa de stacks por cliente e sistema">
      <header className={styles.header}>
        <div className={styles.heading}><span><Layers3 size={19} /></span><div><h2>Mapa de stacks</h2><p>Visualize onde cada sistema roda e navegue até o robô responsável.</p></div></div>
        <div className={styles.summary}><strong>{stackCount}</strong><span>stacks encontradas</span></div>
      </header>

      <div className={styles.filters}>
        <div className={styles.search}><Search size={14} /><input aria-label="Buscar no mapa de stacks" placeholder="Buscar cliente, stack, sistema, robô, fila..." value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /></div>
        <Filter label="Cliente" value={filters.clientId} onChange={(value) => updateFilter("clientId", value)}><option value="">Todos</option>{[...clients].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((client) => <option key={client.id} value={client.id}>{client.nome}</option>)}<option value="unassigned">Sem cliente</option></Filter>
        <Filter label="Stack" value={filters.stack} onChange={(value) => updateFilter("stack", value)} options={options.stacks} />
        <Filter label="Sistema" value={filters.system} onChange={(value) => updateFilter("system", value)} options={options.systems} />
        <Filter label="Ambiente" value={filters.environment} onChange={(value) => updateFilter("environment", value)} options={options.environments} />
        <Filter label="Status" value={filters.status} onChange={(value) => updateFilter("status", value)}><option value="">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></Filter>
        <Filter label="Responsável" value={filters.responsible} onChange={(value) => updateFilter("responsible", value)} options={options.responsibles} />
        <Filter label="Execução" value={filters.trigger} onChange={(value) => updateFilter("trigger", value)} options={options.triggers} />
        <Filter label="Kortex" value={filters.kortex} onChange={(value) => updateFilter("kortex", value)}><option value="">Todos</option><option value="yes">Sim</option><option value="no">Não</option></Filter>
        <button type="button" className={styles.clear} onClick={() => setFilters(EMPTY_FILTERS)} disabled={!activeFilters}><RotateCcw size={13} /> Limpar {activeFilters ? `(${activeFilters})` : ""}</button>
      </div>

      <div className={styles.metrics}>
        <Metric icon={<Users size={17} />} value={groups.length} label="Clientes" />
        <Metric icon={<Layers3 size={17} />} value={stackCount} label="Stacks" />
        <Metric icon={<SlidersHorizontal size={17} />} value={systemCount} label="Sistemas" />
        <Metric icon={<Bot size={17} />} value={filteredRobots.length} label="Rotinas/robôs" />
      </div>

      {groups.length ? <>
        <section className={styles.chart} aria-label="Quantidade de stacks por cliente">
          <header><div><h3>Stacks por cliente</h3><p>Os 5 maiores aparecem primeiro. Clique em um cliente para filtrar.</p></div><label className={styles.barOrder}><ListFilter size={13} /><span>Ordenar</span><select value={barOrder} onChange={(event) => setBarOrder(event.target.value as BarOrder)}><option value="stacks-desc">Mais stacks</option><option value="stacks-asc">Menos stacks</option><option value="robots-desc">Mais rotinas</option><option value="name-asc">Cliente A–Z</option><option value="name-desc">Cliente Z–A</option></select></label></header>
          <div className={styles.bars}>{visibleBarGroups.map((group) => {
            const count = group.stacks.filter((stack) => stack.name !== NO_STACK).length;
            return <button type="button" key={group.id} className={filters.clientId === group.id ? styles.selectedBar : undefined} onClick={() => focusClient(group.id)}><span className={styles.barLabel}>{group.name}</span><span className={styles.barTrack}><i style={{ width: `${(count / maxStacks) * 100}%` }} /></span><strong>{count}</strong></button>;
          })}</div>
          {orderedBarGroups.length > 5 ? <footer className={styles.chartFooter}><button type="button" onClick={() => setShowAllBars((current) => !current)} aria-expanded={showAllBars}>{showAllBars ? "Mostrar somente os 5 primeiros" : `Outros (${orderedBarGroups.length - 5})`}<ChevronDown size={13} className={showAllBars ? styles.chevronOpen : undefined} /></button></footer> : null}
        </section>

        <div className={styles.clients}>{groups.map((group) => <section key={group.id} className={styles.client}>
          <header><div><span className={styles.clientAvatar}>{group.name.slice(0, 2).toUpperCase()}</span><div><h3>{group.name}</h3><p>{group.stacks.length} {group.stacks.length === 1 ? "stack" : "stacks"} · {group.robots.length} {group.robots.length === 1 ? "rotina" : "rotinas"}</p></div></div></header>
          <div className={styles.stackList}>{group.stacks.map((stack) => {
            const id = `${group.id}:${stack.name}`;
            const systems = new Set(stack.robots.map((robot) => key(robot.sistema))).size;
            const isOpen = expanded[id] ?? false;
            return <article key={id} className={styles.stack}>
              <button type="button" className={styles.stackHeader} onClick={() => toggle(id)} aria-expanded={isOpen}>
                <span className={styles.stackIcon}><Layers3 size={15} /></span><span className={styles.stackName}><strong>{stack.name}</strong><small>{systems} {systems === 1 ? "sistema" : "sistemas"} · {stack.robots.length} {stack.robots.length === 1 ? "rotina" : "rotinas"}</small></span><ChevronDown size={15} className={isOpen ? styles.chevronOpen : undefined} />
              </button>
              {isOpen ? <div className={styles.robots}>{stack.robots.sort((a, b) => a.sistema.localeCompare(b.sistema, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR")).map((robot) => <button type="button" key={robot.id} onClick={() => onOpenRobot(robot)}>
                <span className={styles.statusDot} data-active={robot.ativo} /><span><strong>{text(robot.sistema)}</strong><small>{robot.nome}</small><em>{text(robot.ambiente)} · {text(robot.responsavel)}{robot.kortex ? " · Kortex" : ""}</em></span><span className={styles.openLabel}>Abrir robô</span>
              </button>)}</div> : null}
            </article>;
          })}{group.stacks.length === 0 ? <p className={styles.noStacks}>Nenhuma stack cadastrada para este cliente.</p> : null}</div>
        </section>)}</div>
      </> : <div className={styles.empty}><Layers3 size={24} /><strong>Nenhuma stack encontrada</strong><span>Ajuste ou limpe os filtros para visualizar outros resultados.</span></div>}
    </section>
  );
}

function Filter({ label, value, onChange, options, children }: { label: string; value: string; onChange: (value: string) => void; options?: string[]; children?: React.ReactNode }) {
  return <label className={styles.filter}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children ?? <><option value="">Todos</option>{options?.map((option) => <option key={option} value={option}>{option}</option>)}</>}</select></label>;
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <article className={styles.metric}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>;
}
