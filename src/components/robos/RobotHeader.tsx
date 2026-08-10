"use client";

import { ChevronDown, ChevronUp, FileUp, Filter, Plus, RefreshCw, Search, X } from "lucide-react";
import { useState, type CSSProperties } from "react";

interface RobotHeaderProps {
  pesquisa: string;
  onPesquisaChange: (value: string) => void;
  clienteId: string;
  clientes: readonly { value: string; label: string }[];
  onClienteChange: (value: string) => void;
  pacote: string;
  pacotes: readonly string[];
  onPacoteChange: (value: string) => void;
  sistema: string;
  sistemas: readonly string[];
  onSistemaChange: (value: string) => void;
  ambiente: string;
  ambientes: readonly string[];
  onAmbienteChange: (value: string) => void;
  status: string;
  statusOptions: readonly string[];
  onStatusChange: (value: string) => void;
  totalRobots: number;
  onNovoRobot: () => void;
  canCreate: boolean;
  canImport: boolean;
  onImport: () => void;
  canSyncVersions: boolean;
  onSyncVersions: () => void;
  onLimparFiltros: () => void;
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: readonly (string | { value: string; label: string })[];
  allOptionLabel: string;
  onChange: (value: string) => void;
}

function FilterSelect({
  label,
  value,
  options,
  allOptionLabel,
  onChange,
}: FilterSelectProps) {
  return (
    <label style={filterFieldStyle}>
      <span style={filterLabelStyle}>{label}</span>
      <span style={selectWrapStyle}>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={selectStyle}
          className="robot-filter-select"
        >
          {options.map((item) => {
            const value = typeof item === "string" ? item : item.value;
            const optionLabel = typeof item === "string" ? (item === "Todos" ? allOptionLabel : item) : item.label;
            return <option key={value} value={value}>
              {optionLabel}
            </option>
          })}
        </select>
        <ChevronDown size={16} style={chevronStyle} aria-hidden="true" />
      </span>
    </label>
  );
}

export default function RobotHeader({
  pesquisa,
  onPesquisaChange,
  clienteId,
  clientes,
  onClienteChange,
  pacote,
  pacotes,
  onPacoteChange,
  sistema,
  sistemas,
  onSistemaChange,
  ambiente,
  ambientes,
  onAmbienteChange,
  status,
  statusOptions,
  onStatusChange,
  totalRobots,
  onNovoRobot,
  canCreate,
  canImport,
  onImport,
  canSyncVersions,
  onSyncVersions,
  onLimparFiltros,
}: RobotHeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtrosAtivos =
    pesquisa.trim().length > 0 ||
    clienteId !== "Todos" ||
    pacote !== "Todos" ||
    sistema !== "Todos" ||
    ambiente !== "Todos" ||
    status !== "Todos";

  return (
    <div style={headerContentStyle} data-tour="robots-header">
      <div className="robots-title-row" style={titleRowStyle}>
        <div>
          <span className="robots-page-eyebrow">ROBÔS</span>
          <h1 style={pageTitleStyle}>Robôs Integradores</h1>
          <p className="robots-page-subtitle">Veja todas as configurações e regras dos robôs.</p>
        </div>

        <div className="robots-page-actions" style={actionsStyle}>
          {canSyncVersions && (
            <button type="button" onClick={onSyncVersions} style={secondaryButtonStyle}>
              <RefreshCw size={16} />
              Atualizar versões
            </button>
          )}
          {canImport && (
            <button type="button" onClick={onImport} style={secondaryButtonStyle}>
              <FileUp size={16} />
              Importar
            </button>
          )}
          {canCreate && (
            <button type="button" onClick={onNovoRobot} style={buttonStyle}>
              <Plus size={16} />
              Novo Robô
            </button>
          )}
        </div>
      </div>

      <section className="robots-filter-panel" style={panelStyle} aria-label="Filtros de robôs">
        <button
          type="button"
          onClick={() => setFiltersOpen((isOpen) => !isOpen)}
          aria-expanded={filtersOpen}
          style={{
            ...filterToggleStyle,
            ...(filtrosAtivos ? filterToggleActiveStyle : {}),
          }}
        >
          <span style={filterTitleStyle}>
            <Filter size={16} aria-hidden="true" />
            Filtros
          </span>
          {filtersOpen ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
        </button>

        <div style={searchRowStyle}>
          <div style={searchFieldStyle}>
            <Search size={18} style={iconStyle} aria-hidden="true" />
            <input
              value={pesquisa}
              onChange={(event) => onPesquisaChange(event.target.value)}
              placeholder="Pesquisar por nome, sistema ou pacote..."
              aria-label="Pesquisar robôs"
              style={inputStyle}
            />
            <span style={countStyle} aria-live="polite">
              {totalRobots} {totalRobots === 1 ? "robô" : "robôs"}
            </span>
          </div>
        </div>

        {filtersOpen && (
          <div style={filterContentStyle}>
            <div style={filterHeaderStyle}>
              {filtrosAtivos && (
                <button type="button" onClick={onLimparFiltros} style={clearStyle}>
                  <X size={15} />
                  Limpar filtros
                </button>
              )}
            </div>

            <div style={selectRowStyle}>
              <FilterSelect
                label="Cliente"
                value={clienteId}
                options={["Todos", ...clientes]}
                allOptionLabel="Todos os clientes"
                onChange={onClienteChange}
              />
              <FilterSelect
                label="Pacote"
                value={pacote}
                options={pacotes}
                allOptionLabel="Todos os pacotes"
                onChange={onPacoteChange}
              />
              <FilterSelect
                label="Sistema"
                value={sistema}
                options={sistemas}
                allOptionLabel="Todos os sistemas"
                onChange={onSistemaChange}
              />
              <FilterSelect
                label="Ambiente"
                value={ambiente}
                options={ambientes}
                allOptionLabel="Todos os ambientes"
                onChange={onAmbienteChange}
              />
              <FilterSelect
                label="Status"
                value={status}
                options={statusOptions}
                allOptionLabel="Todos os status"
                onChange={onStatusChange}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "var(--card)",
  padding: 14,
  boxShadow: "var(--shadow)",
};

const headerContentStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  width: "100%",
};

const actionsStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10 };

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: 40,
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "1px solid var(--accent)",
  borderRadius: 9,
  padding: "0 15px",
  background: "var(--accent-soft)",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const pageTitleStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "var(--text-strong)",
  fontSize: 30,
  fontWeight: 700,
};

const searchRowStyle: CSSProperties = {
  display: "flex",
  minWidth: 0,
};

const searchFieldStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  minWidth: 240,
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 40,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  padding: "0 92px 0 38px",
  outline: "none",
  boxSizing: "border-box",
  transition: "all .2s ease",
  fontSize: 13,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
};

const countStyle: CSSProperties = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: 12,
  color: "var(--muted)",
  pointerEvents: "none",
  whiteSpace: "nowrap",
};

const filterHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 12,
};

const filterToggleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  width: "100%",
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  padding: "0 2px",
  cursor: "pointer",
};

const filterToggleActiveStyle: CSSProperties = {
  color: "var(--accent)",
};

const filterContentStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  paddingTop: 2,
};

const filterTitleStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  color: "var(--text-strong)",
  fontSize: 13,
  fontWeight: 700,
};

const selectRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "flex-end",
};

const filterFieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  flex: "1 1 160px",
  minWidth: 150,
};

const filterLabelStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 600,
};

const selectWrapStyle: CSSProperties = {
  position: "relative",
};

const selectStyle: CSSProperties = {
  width: "100%",
  height: 40,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  padding: "0 32px 0 12px",
  outline: "none",
  boxSizing: "border-box",
  appearance: "none",
  transition: "all .2s ease",
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
};

const iconStyle: CSSProperties = {
  position: "absolute",
  left: 12,
  top: "50%",
  transform: "translateY(-50%)",
  color: "var(--muted)",
  pointerEvents: "none",
};

const chevronStyle: CSSProperties = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  color: "var(--muted)",
  pointerEvents: "none",
};

const buttonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "var(--on-accent)",
  padding: "8px 14px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "0 8px 22px rgba(10, 132, 255, 0.22)",
  transition: "all .2s ease",
};

const clearStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  padding: "2px 0",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
};
