import {
  Cpu,
  FileCheck2,
  FileText,
  GitBranch,
  Layers3,
  Package,
  Server,
  Terminal,
  Building2,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Robo } from "@/domain/entities";
import styles from "./RobotCard.module.css";

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
  const descriptionRef = useRef<HTMLSpanElement>(null);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);
  const hasDocumentation = Boolean(
    robot.uploadedDocumentationPath
    || robot.uploadedDocuments?.length
    || robot.robotCenterDocumentation?.status === "published",
  );

  useEffect(() => {
    const descriptionElement = descriptionRef.current;
    if (!descriptionElement) return;

    const updateTruncation = () => {
      setIsDescriptionTruncated(descriptionElement.scrollWidth > descriptionElement.clientWidth);
    };

    updateTruncation();
    const resizeObserver = new ResizeObserver(updateTruncation);
    resizeObserver.observe(descriptionElement);

    return () => resizeObserver.disconnect();
  }, [robot.descricao]);

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
        background: selected ? "var(--accent-soft)" : "var(--card)",
        border: selected
          ? "1px solid var(--accent)"
          : "1px solid var(--border)",
        borderRadius: 14,
        padding: 14,
        boxShadow: selected
          ? "0 0 0 1px var(--accent-soft), var(--shadow)"
          : "var(--shadow)",
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
              color: "var(--text-strong)",
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
              {robot.nome}
              {robot.kortex && <span className={styles.kortex}>Kortex</span>}
          </div>

          <div
            style={{
              color: "var(--muted)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <Cpu size={14} />
            {robot.courtName}
          </div>
        </div>

        <div style={statusGroupStyle} aria-label="Ambiente e status do robô">
          {hasDocumentation && (
            <span title="Documentação disponível" aria-label="Documentação disponível" style={documentationIconStyle}>
              <FileCheck2 size={13} />
            </span>
          )}
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
              color: robot.ativo ? "var(--success)" : "var(--muted)",
              background: robot.ativo
                ? "var(--success-soft)"
                : "var(--surface)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                ...statusDotStyle,
                background: robot.ativo ? "var(--success)" : "var(--faint)",
                boxShadow: robot.ativo ? "0 0 0 3px rgba(34,197,94,.1)" : "none",
              }}
            />
            {robot.ativo ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>

      <div
        className={isDescriptionTruncated ? styles.descriptionHint : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--muted)",
          fontSize: 12.5,
        }}
        data-description={isDescriptionTruncated ? robot.descricao || "Descrição não informada" : undefined}
        tabIndex={isDescriptionTruncated ? 0 : undefined}
      >
        <FileText size={14} style={{ flexShrink: 0 }} />
        <span ref={descriptionRef} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {robot.descricao || "Descrição não informada"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          columnGap: 12,
          rowGap: 7,
          color: "var(--muted)",
          fontSize: 12.5,
          marginTop: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Package size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {robot.pacote}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <GitBranch size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Versão: {robot.versao}
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, gridColumn: "1 / -1" }} title={robot.command || "Command não informado"}>
          <Terminal size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{robot.command || "Command não informado"}</span>
        </div>
        {robot.productType !== "INTEGRADOR" && <>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Building2 size={14} style={{ flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{robot.tribunal || "Tribunal não informado"}</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Building2 size={14} style={{ flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{robot.tribunalSystem || "Sistema não informado"}</span></div>
        </>}
      </div>
      <span style={detailsHintStyle}>Detalhes</span>
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
const documentationIconStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  color: "var(--muted)",
  border: "1px solid var(--separator)",
  borderRadius: 7,
  background: "var(--surface)",
};
const detailsHintStyle: CSSProperties = {
  display: "block",
  marginTop: 9,
  color: "var(--accent)",
  fontSize: 10.5,
  fontWeight: 700,
  textAlign: "right",
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
