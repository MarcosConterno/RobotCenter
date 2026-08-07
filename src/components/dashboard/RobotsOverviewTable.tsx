"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Bot, Check, Filter, GripVertical, RotateCcw, TableProperties, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Cliente, Robo } from "@/domain/entities";
import { PALETAS_BADGE_ROBO } from "@/domain/badge-colors";

interface RobotsOverviewTableProps {
  robos: Robo[];
  clientes: Cliente[];
  onViewRobot: (robot: Robo) => void;
  canEditCapacity?: boolean;
  onUpdateCapacity?: (id: string, ideal: number, max: number) => Promise<unknown>;
}

const ROBOT_ORDER_STORAGE_KEY = "robot-center-dashboard-robot-order";

function persistRobotOrder(order: string[]) {
  try {
    window.localStorage.setItem(ROBOT_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // A tabela continua ordenável durante a sessão quando o storage estiver indisponível.
  }
}

export default function RobotsOverviewTable({ robos, clientes, onViewRobot, canEditCapacity = false, onUpdateCapacity }: RobotsOverviewTableProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [sistema, setSistema] = useState("");
  const [courtName, setCourtName] = useState("");
  const [pacote, setPacote] = useState("");
  const [capacityError, setCapacityError] = useState("");
  const [capacityDrafts, setCapacityDrafts] = useState<Record<string, { ideal: string; max: string }>>({});
  const [robotOrder, setRobotOrder] = useState<string[]>([]);
  const [draggedRobotId, setDraggedRobotId] = useState<string | null>(null);
  const [dragOverRobotId, setDragOverRobotId] = useState<string | null>(null);
  const [clientSortDirection, setClientSortDirection] = useState<"asc" | "desc" | null>(null);

  useEffect(() => {
    try {
      const savedOrder = window.localStorage.getItem(ROBOT_ORDER_STORAGE_KEY);
      if (savedOrder) {
        const parsedOrder: unknown = JSON.parse(savedOrder);
        if (Array.isArray(parsedOrder) && parsedOrder.every((id) => typeof id === "string")) {
          setRobotOrder(parsedOrder);
        }
      }
    } catch {
      // Ignora preferências inválidas ou storage indisponível.
    }
  }, []);

  useEffect(() => {
    setRobotOrder((current) => {
      const availableIds = new Set(robos.map((robot) => robot.id));
      const normalizedOrder = [
        ...current.filter((id) => availableIds.has(id)),
        ...robos.map((robot) => robot.id).filter((id) => !current.includes(id)),
      ];
      if (normalizedOrder.length === current.length && normalizedOrder.every((id, index) => id === current[index])) {
        return current;
      }
      persistRobotOrder(normalizedOrder);
      return normalizedOrder;
    });
  }, [robos]);

  const clientePorId = useMemo(() => new Map(clientes.map((cliente) => [cliente.id, cliente])), [clientes]);
  const sistemas = useMemo(() => [...new Set(robos.map((robo) => robo.sistema))].sort(), [robos]);
  const courtNames = useMemo(() => [...new Set(robos.map((robo) => robo.courtName))].sort(), [robos]);
  const pacotes = useMemo(() => [...new Set(robos.map((robo) => robo.pacote))].sort(), [robos]);
  const robosOrdenados = useMemo(() => {
    const positionById = new Map(robotOrder.map((id, index) => [id, index]));
    return [...robos].sort((a, b) => {
      if (clientSortDirection) {
        const clientA = clientePorId.get(a.clienteId)?.nome ?? "";
        const clientB = clientePorId.get(b.clienteId)?.nome ?? "";
        const comparison = clientA.localeCompare(clientB, "pt-BR", { sensitivity: "base" });
        if (comparison !== 0) return clientSortDirection === "asc" ? comparison : -comparison;
      }

      return (positionById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (positionById.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    });
  }, [clientSortDirection, clientePorId, robotOrder, robos]);
  const robosFiltrados = useMemo(() => robosOrdenados.filter((robo) =>
    (!clienteId || robo.clienteId === clienteId) &&
    (!sistema || robo.sistema === sistema) &&
    (!courtName || robo.courtName === courtName) &&
    (!pacote || robo.pacote === pacote),
  ), [clienteId, courtName, pacote, robosOrdenados, sistema]);
  const totalFiltros = [clienteId, sistema, courtName, pacote].filter(Boolean).length;

  function limparFiltros() {
    setClienteId("");
    setSistema("");
    setCourtName("");
    setPacote("");
  }

  function atualizarRascunho(robot: Robo, field: "ideal" | "max", value: string) {
    setCapacityDrafts((current) => ({
      ...current,
      [robot.id]: {
        ideal: current[robot.id]?.ideal ?? String(robot.ideal),
        max: current[robot.id]?.max ?? String(robot.max),
        [field]: value,
      },
    }));
    setCapacityError("");
  }

  function moverRobo(targetRobotId: string) {
    if (!draggedRobotId || draggedRobotId === targetRobotId) return;

    const currentOrder = robosOrdenados.map((robot) => robot.id);
    const sourceIndex = currentOrder.indexOf(draggedRobotId);
    const targetIndex = currentOrder.indexOf(targetRobotId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextOrder = [...currentOrder];
    const [movedId] = nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, movedId);
    setRobotOrder(nextOrder);
    persistRobotOrder(nextOrder);
    setDraggedRobotId(null);
    setDragOverRobotId(null);
  }

  async function aplicarCapacidade(robot: Robo) {
    const draft = capacityDrafts[robot.id] ?? { ideal: String(robot.ideal), max: String(robot.max) };
    const ideal = Number(draft.ideal);
    const max = Number(draft.max);
    if (!Number.isInteger(ideal) || !Number.isInteger(max) || ideal < 0 || max < 0 || !onUpdateCapacity) {
      setCapacityError("Ideal e Max devem ser números inteiros maiores ou iguais a zero.");
      return;
    }
    if (max < ideal) {
      setCapacityError("Max deve ser maior ou igual a Ideal.");
      return;
    }
    try {
      setCapacityError("");
      await onUpdateCapacity(robot.id, ideal, max);
      setCapacityDrafts((current) => {
        const next = { ...current };
        delete next[robot.id];
        return next;
      });
    } catch {
      setCapacityError("Não foi possível atualizar Ideal e Max.");
    }
  }

  return (
    <section className="dashboard-robots-table">
      <header className="dashboard-robots-table__header">
        <div className="dashboard-robots-table__heading">
          <span className="dashboard-robots-table__icon" aria-hidden="true">
            <TableProperties size={16} />
          </span>
          <div>
            <h2>Todos os robôs</h2>
            <p>Visão consolidada dos dados cadastrados no ambiente.</p>
          </div>
        </div>
        <div className="dashboard-robots-table__header-actions">
          <span className="dashboard-robots-table__count">
            {robosFiltrados.length} de {robos.length} robôs
          </span>
          <button
            type="button"
            className={`dashboard-robots-table__filter-button${filtersOpen ? " is-active" : ""}`}
            aria-expanded={filtersOpen}
            aria-controls="dashboard-robots-filters"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            {filtersOpen ? <X size={15} /> : <Filter size={15} />}
            Filtros
            {totalFiltros > 0 && <span>{totalFiltros}</span>}
          </button>
        </div>
      </header>

      {filtersOpen && (
        <div id="dashboard-robots-filters" className="dashboard-robots-table__filters">
          <FilterField label="Cliente" value={clienteId} onChange={setClienteId} options={clientes.map((cliente) => ({ value: cliente.id, label: cliente.nome }))} />
          <FilterField label="Sistema" value={sistema} onChange={setSistema} options={sistemas.map((value) => ({ value, label: value }))} />
          <FilterField label="CourtName" value={courtName} onChange={setCourtName} options={courtNames.map((value) => ({ value, label: value }))} />
          <FilterField label="Pacote" value={pacote} onChange={setPacote} options={pacotes.map((value) => ({ value, label: value }))} />
          <button type="button" className="dashboard-robots-table__clear" onClick={limparFiltros} disabled={totalFiltros === 0}>
            <RotateCcw size={14} /> Limpar
          </button>
        </div>
      )}

      {capacityError && <div className="dashboard-robots-table__error" role="alert">{capacityError}</div>}

      <div className="dashboard-robots-table__scroll">
        <table>
          <thead>
            <tr>
              <th className="dashboard-robots-table__drag-column"><span className="sr-only">Ordenar</span></th>
              <th aria-sort={clientSortDirection === "asc" ? "ascending" : clientSortDirection === "desc" ? "descending" : "none"}>
                <button
                  type="button"
                  className={`dashboard-robots-table__sort${clientSortDirection ? " is-active" : ""}`}
                  onClick={() => setClientSortDirection((current) => current === "asc" ? "desc" : "asc")}
                  title={clientSortDirection === "asc" ? "Ordenar clientes do Z ao A" : "Ordenar clientes do A ao Z"}
                >
                  Cliente
                  {clientSortDirection === "asc" ? <ArrowUp size={13} /> : clientSortDirection === "desc" ? <ArrowDown size={13} /> : <ArrowUpDown size={13} />}
                </button>
              </th>
              <th>Sistema</th>
              <th>Robô</th>
              <th>CourtName</th>
              <th>Fila</th>
              <th>Stack</th>
              <th>Ideal</th>
              <th>Max</th>
              <th>Pacote</th>
              <th>Versão</th>
              {canEditCapacity && <th>Ação</th>}
            </tr>
          </thead>
          <tbody>
            {robosFiltrados.map((robot) => {
              const cliente = clientePorId.get(robot.clienteId);

              return (
                <tr
                  key={robot.id}
                  className={dragOverRobotId === robot.id ? "is-drag-over" : undefined}
                  tabIndex={0}
                  onDragOver={(event) => {
                    if (!draggedRobotId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverRobotId(robot.id);
                  }}
                  onDragLeave={() => setDragOverRobotId((current) => current === robot.id ? null : current)}
                  onDrop={(event) => {
                    event.preventDefault();
                    moverRobo(robot.id);
                  }}
                  onClick={() => onViewRobot(robot)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onViewRobot(robot);
                    }
                  }}
                >
                  <td className="dashboard-robots-table__drag-cell">
                    <button
                      type="button"
                      className="dashboard-robots-table__drag-handle"
                      draggable
                      aria-label={`Arrastar ${robot.nome} para alterar a posição`}
                      title="Arraste para reorganizar"
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => {
                        event.stopPropagation();
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", robot.id);
                        setDraggedRobotId(robot.id);
                      }}
                      onDragEnd={() => {
                        setDraggedRobotId(null);
                        setDragOverRobotId(null);
                      }}
                    >
                      <GripVertical size={16} />
                    </button>
                  </td>
                  <td>
                    <span className="dashboard-robots-table__client" style={{ color: PALETAS_BADGE_ROBO[robot.clienteCor].texto, background: PALETAS_BADGE_ROBO[robot.clienteCor].fundo, borderColor: PALETAS_BADGE_ROBO[robot.clienteCor].borda }}>{cliente?.nome ?? "—"}</span>
                  </td>
                  <td>
                    <strong className="dashboard-robots-table__primary">{robot.sistema}</strong>
                  </td>
                  <td>
                    <div className="dashboard-robots-table__robot">
                      <span><Bot size={15} /></span>
                      <strong>{robot.nome}</strong>
                    </div>
                  </td>
                  <td className="dashboard-robots-table__muted">{robot.courtName}</td>
                  <td className="dashboard-robots-table__muted">{robot.fila}</td>
                  <td className="dashboard-robots-table__muted">{robot.stack}</td>
                  <td>{canEditCapacity ? (
                    <input className="dashboard-robots-table__capacity" type="number" min={0} step={1} value={capacityDrafts[robot.id]?.ideal ?? String(robot.ideal)} aria-label={`Ideal de ${robot.nome}`} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => atualizarRascunho(robot, "ideal", event.target.value)} />
                  ) : <span className="dashboard-robots-table__number">{robot.ideal}</span>}</td>
                  <td>{canEditCapacity ? (
                    <input className="dashboard-robots-table__capacity is-max" type="number" min={0} step={1} value={capacityDrafts[robot.id]?.max ?? String(robot.max)} aria-label={`Máximo de ${robot.nome}`} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => atualizarRascunho(robot, "max", event.target.value)} />
                  ) : <span className="dashboard-robots-table__number is-max">{robot.max}</span>}</td>
                  <td><span className="dashboard-robots-table__package" style={{ color: PALETAS_BADGE_ROBO[robot.pacoteCor].texto, background: PALETAS_BADGE_ROBO[robot.pacoteCor].fundo, borderColor: PALETAS_BADGE_ROBO[robot.pacoteCor].borda }}>{robot.pacote}</span></td>
                  <td><span className="dashboard-robots-table__version">v{robot.versao}</span></td>
                  {canEditCapacity && <td>
                    <button type="button" className="dashboard-robots-table__apply" disabled={!capacityDrafts[robot.id]} onClick={(event) => { event.stopPropagation(); void aplicarCapacidade(robot); }}>
                      <Check size={14} /> Aplicar alteração
                    </button>
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {robosFiltrados.length === 0 && (
          <div className="dashboard-robots-table__empty">
            <Filter size={20} />
            <strong>Nenhum robô encontrado</strong>
            <span>Ajuste ou limpe os filtros para visualizar outros resultados.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function FilterField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="dashboard-robots-table__filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
