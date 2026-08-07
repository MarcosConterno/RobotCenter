"use client";

import { ChevronDown, ChevronUp, FileUp, Filter, Plus, Search, X } from "lucide-react";
import { useState, type CSSProperties } from "react";

interface RobotHeaderProps {
  pesquisa: string;
  onPesquisaChange: (value: string) => void;
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
  canImport: boolean;
  onImport: () => void;
  onLimparFiltros: () => void;
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: readonly string[];
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
        >
          {options.map((item) => (
            <option key={item} value={item}>
              {item === "Todos" ? allOptionLabel : item}
            </option>
          ))}
        </select>
        <ChevronDown size={16} style={chevronStyle} aria-hidden="true" />
      </span>
    </label>
  );
}

export default function RobotHeader({
  pesquisa,
  onPesquisaChange,
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
  canImport,
  onImport,
  onLimparFiltros,
}: RobotHeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtrosAtivos =
    pesquisa.trim().length > 0 ||
    pacote !== "Todos" ||
    sistema !== "Todos" ||
    ambiente !== "Todos" ||
    status !== "Todos";

  return (
    <div style={headerContentStyle}>
      <div style={titleRowStyle}>
        <h1 style={pageTitleStyle}>Robôs Integradores</h1>

        <div style={actionsStyle}>
          {canImport && (
            <button type="button" onClick={onImport} style={secondaryButtonStyle}>
              <FileUp size={16} />
              Importar
            </button>
          )}
          <button type="button" onClick={onNovoRobot} style={buttonStyle}>
            <Plus size={16} />
            Novo Robô
          </button>
        </div>
      </div>

      <section style={panelStyle} aria-label="Filtros de robôs">
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
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  background: "#111827",
  padding: 14,
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.2)",
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
  border: "1px solid #6D28D9",
  borderRadius: 9,
  padding: "0 15px",
  background: "rgba(109,40,217,.12)",
  color: "#DDD6FE",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  color: "#FFF",
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
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#182233",
  color: "#F8FAFC",
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
  color: "#94A3B8",
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
  color: "#94A3B8",
  padding: "0 2px",
  cursor: "pointer",
};

const filterToggleActiveStyle: CSSProperties = {
  color: "#C4B5FD",
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
  color: "#CBD5E1",
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
  color: "#94A3B8",
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
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#182233",
  color: "#F8FAFC",
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
  color: "#94A3B8",
  pointerEvents: "none",
};

const chevronStyle: CSSProperties = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#94A3B8",
  pointerEvents: "none",
};

const buttonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
  color: "#FFF",
  padding: "8px 14px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "0 8px 22px rgba(124, 58, 237, 0.24)",
  transition: "all .2s ease",
};

const clearStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "none",
  background: "transparent",
  color: "#94A3B8",
  padding: "2px 0",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
};
