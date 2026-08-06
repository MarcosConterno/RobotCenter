import {
  Calendar,
  Cpu,
  Layers3,
  Server,
  User,
} from "lucide-react";
import type { CSSProperties } from "react";
import { formatarData } from "@/domain/formatters";
import type { Robo } from "@/domain/entities";

interface RobotCardProps {
  robot: Robo;
  selected?: boolean;
  onClick?: () => void;
}

const environmentStyle = {
  Produção: { color: "#4ADE80", background: "rgba(34,197,94,.1)" },
  Teste: { color: "#FBBF24", background: "rgba(245,158,11,.1)" },
  Desenvolvimento: { color: "#A78BFA", background: "rgba(139,92,246,.1)" },
} as const;

export default function RobotCard({
  robot,
  selected = false,
  onClick,
}: RobotCardProps) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      style={{
        cursor: "pointer",
        userSelect: "none",
        transition: "all .2s ease",
        background: selected ? "#223149" : "#182233",
        border: selected
          ? "1px solid rgba(124, 58, 237, 0.65)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 14,
        boxShadow: selected
          ? "0 0 0 1px rgba(124, 58, 237, 0.18), 0 14px 32px rgba(15, 23, 42, 0.22)"
          : "0 10px 24px rgba(15, 23, 42, 0.16)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              color: "#F8FAFC",
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {robot.nome}
          </div>

          <div
            style={{
              color: "#94A3B8",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <Cpu size={14} />
            {robot.sistema}
          </div>
        </div>

        <div style={statusGroupStyle} aria-label="Ambiente e status do robô">
          <span
            style={{
              ...environmentBadgeStyle,
              ...environmentStyle[robot.ambiente],
            }}
          >
            {robot.ambiente}
          </span>
          <span
            style={{
              ...statusBadgeStyle,
              color: robot.ativo ? "#4ADE80" : "#94A3B8",
              background: robot.ativo
                ? "rgba(34,197,94,.08)"
                : "rgba(100,116,139,.1)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                ...statusDotStyle,
                background: robot.ativo ? "#22C55E" : "#64748B",
                boxShadow: robot.ativo ? "0 0 0 3px rgba(34,197,94,.1)" : "none",
              }}
            />
            {robot.ativo ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          columnGap: 12,
          rowGap: 7,
          color: "#94A3B8",
          fontSize: 12.5,
          marginTop: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {formatarData(robot.ultimaPublicacaoEm)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Layers3 size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {robot.stack}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Server size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {robot.fila}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <User size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {robot.responsavel}
          </span>
        </div>
      </div>
    </div>
  );
}

const statusGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: 6,
};

const environmentBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "4px 7px",
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const statusBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 24,
  padding: "4px 7px",
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 650,
  whiteSpace: "nowrap",
};

const statusDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  flex: "0 0 6px",
  borderRadius: "50%",
};
