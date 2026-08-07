"use client";

import {
  Bot,
  FileText,
  GitBranch,
  Layers3,
  ListChecks,
  Package,
  Pencil,
  Send,
  Server,
  User,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatarData } from "@/domain/formatters";
import type { Cliente, Robo } from "@/domain/entities";

interface RobotDetailsProps {
  robot: Robo | null;
  clientes?: Cliente[];
  onEdit?: (robot: Robo) => void;
  onPublish?: (robot: Robo) => void;
}

export default function RobotDetails({ robot, clientes = [], onEdit, onPublish }: RobotDetailsProps) {
  const [rulesTab, setRulesTab] = useState<"documentacao" | "fora-documentacao">("documentacao");
  if (!robot) {
    return (
      <div style={emptyStyle}>
        Selecione um robô para visualizar os detalhes.
      </div>
    );
  }

  const regras = robot.regras ?? [];
  const regrasForaDocumentacao = robot.regrasForaDocumentacao ?? [];
  const regrasVisiveis = rulesTab === "documentacao" ? regras : regrasForaDocumentacao;
  const cliente = clientes.find((item) => item.id === robot.clienteId);

  return (
    <article style={containerStyle}>
      <header style={headerStyle}>
        <div style={identityStyle}>
          <div style={avatarStyle}>
            <Bot color="#A78BFA" size={28} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={eyebrowStyle}>ROBÔ INTEGRADOR</div>
            <h2 style={titleStyle}>{robot.nome}</h2>
            <div style={badgesStyle}>
              <span style={systemBadgeStyle}>{robot.sistema}</span>
              <span
                style={{
                  ...statusBadgeStyle,
                  color: robot.ativo ? "var(--success)" : "var(--text-2)",
                  background: robot.ativo
                    ? "rgba(34, 197, 94, 0.12)"
                    : "rgba(148, 163, 184, 0.12)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: robot.ativo ? "var(--success)" : "var(--muted)",
                  }}
                />
                {robot.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>
        </div>

        <div style={headerActionsStyle}>
          {onEdit && (
            <button type="button" onClick={() => onEdit(robot)} style={editButtonStyle}>
              <Pencil size={15} /> Editar
            </button>
          )}
          {onPublish && (
            <button type="button" onClick={() => onPublish(robot)} style={publishButtonStyle}>
              <Send size={15} /> Publicar alterações
            </button>
          )}
        </div>
      </header>

      <section style={descriptionStyle}>
        <div style={sectionLabelStyle}>SOBRE</div>
        <p style={descriptionTextStyle}>{robot.descricao}</p>
      </section>

      <div style={detailsBlockStyle}>
        <DetailSection title="Informações técnicas">
          <div style={technicalGridStyle}>
            <DetailRow icon={<User size={17} />} label="Cliente" value={cliente?.nome ?? "Cliente não encontrado"} />
            <DetailRow icon={<GitBranch size={17} />} label="Sistema" value={robot.sistema} />
            <DetailRow icon={<Bot size={17} />} label="Robô" value={robot.nome} />
            <DetailRow icon={<FileText size={17} />} label="CourtName" value={robot.courtName} />
            <DetailRow icon={<Server size={17} />} label="Fila" value={robot.fila} />
            <DetailRow icon={<Layers3 size={17} />} label="Stack" value={robot.stack} />
            <DetailRow icon={<Bot size={17} />} label="Ideal" value={robot.ideal} />
            <DetailRow icon={<Bot size={17} />} label="Max" value={robot.max} />
            <DetailRow icon={<Package size={17} />} label="Pacote" value={robot.pacote} />
            <DetailRow icon={<Bot size={17} />} label="Versão" value={robot.versao} />
          </div>
        </DetailSection>
      </div>

      <div style={followingBlockStyle}>
        <DetailSection title="Alterações realizadas">
          <div style={changesListStyle}>
            {robot.alteracoes.length === 0 && <div style={noRulesStyle}>Nenhuma alteração registrada.</div>}
            {robot.alteracoes.map((alteracao) => (
              <div key={alteracao.id} style={changeItemStyle}>
                <FileText size={16} style={{ color: "#8B5CF6", flexShrink: 0 }} />
                <span>
                  <span style={changeDateStyle}>{formatarData(alteracao.realizadaEm)}</span>
                  <span style={changeTextStyle}>{alteracao.descricao}</span>
                </span>
              </div>
            ))}
          </div>
        </DetailSection>
      </div>

      <div style={rulesSectionStyle}>
        <DetailSection title="Regras do robô">
          <div role="tablist" aria-label="Tipos de regras" style={detailTabsStyle}>
            <button type="button" role="tab" aria-selected={rulesTab === "documentacao"} onClick={() => setRulesTab("documentacao")} style={{ ...detailTabStyle, ...(rulesTab === "documentacao" ? activeDetailTabStyle : {}) }}>
              Documento técnico
            </button>
            <button type="button" role="tab" aria-selected={rulesTab === "fora-documentacao"} onClick={() => setRulesTab("fora-documentacao")} style={{ ...detailTabStyle, ...(rulesTab === "fora-documentacao" ? activeDetailTabStyle : {}) }}>
              Fora da documentação
            </button>
          </div>
          <div style={rulesStyle}>
            {regrasVisiveis.length === 0 && <div style={noRulesStyle}>Nenhuma regra cadastrada nesta categoria.</div>}
            {regrasVisiveis.map((regra, index) => (
              <div key={`${regra.descricao}-${index}`} style={detailRuleStyle}>
                <ListChecks size={16} style={{ color: "#8B5CF6", flexShrink: 0 }} />
                <span style={detailRuleCodeStyle}>{`${rulesTab === "documentacao" ? "RF" : "RFD"}${String(index + 1).padStart(3, "0")}`}</span>
                <span style={detailRuleTextStyle}>{regra.descricao}</span>
              </div>
            ))}
          </div>
        </DetailSection>
      </div>
    </article>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      <div>{children}</div>
    </section>
  );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div style={rowStyle}>
      <span style={rowIconStyle}>{icon}</span>
      <span style={rowLabelStyle}>{label}</span>
      <span style={rowValueStyle}>{value}</span>
    </div>
  );
}

const containerStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "var(--shadow)",
} as const;

const detailTabsStyle = { display: "flex", gap: 4, marginBottom: 12, padding: 4, borderRadius: 8, background: "var(--surface)" } as const;
const detailsBlockStyle = { padding: "20px 26px 0" } as const;
const followingBlockStyle = { padding: "16px 26px 0" } as const;
const rulesSectionStyle = { padding: "16px 26px 26px" } as const;
const technicalGridStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } as const;
const detailTabStyle = { flex: 1, padding: "7px 8px", border: "none", borderRadius: 6, background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 11, fontWeight: 700 } as const;
const activeDetailTabStyle = { background: "var(--card)", color: "var(--accent)" } as const;

const emptyStyle = { ...containerStyle, minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" } as const;
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, padding: "24px 26px", background: "var(--surface)", borderBottom: "1px solid var(--separator)" } as const;
const identityStyle = { display: "flex", alignItems: "center", gap: 16, minWidth: 0 } as const;
const avatarStyle = { width: 54, height: 54, flexShrink: 0, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-soft)", border: "1px solid var(--accent)" } as const;
const eyebrowStyle = { color: "var(--muted)", fontSize: 10, fontWeight: 800, letterSpacing: 1.4, marginBottom: 4 } as const;
const titleStyle = { color: "var(--text-strong)", margin: 0, fontSize: 24, lineHeight: 1.2 } as const;
const badgesStyle = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 9 } as const;
const systemBadgeStyle = { color: "var(--text-2)", fontSize: 12, padding: "4px 9px", borderRadius: 999, background: "var(--surface)" } as const;
const statusBadgeStyle = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 9px", borderRadius: 999, fontWeight: 600 } as const;
const editButtonStyle = { display: "flex", alignItems: "center", gap: 7, flexShrink: 0, padding: "8px 14px", borderRadius: 12, border: "none", background: "var(--accent)", color: "var(--on-accent)", cursor: "pointer", fontWeight: 700, fontSize: 13, boxShadow: "0 8px 22px rgba(10,132,255,.2)" } as const;
const headerActionsStyle = { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 } as const;
const publishButtonStyle = { ...editButtonStyle, background: "rgba(124,58,237,.1)", border: "1px solid rgba(167,139,250,.35)", color: "#C4B5FD", boxShadow: "none" } as const;
const descriptionStyle = { padding: "20px 26px", borderBottom: "1px solid var(--separator)" } as const;
const sectionLabelStyle = { color: "var(--muted)", fontSize: 10, fontWeight: 800, letterSpacing: 1.3, marginBottom: 8 } as const;
const descriptionTextStyle = { color: "var(--text)", lineHeight: 1.6, fontSize: 14, margin: 0 } as const;
const sectionsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, padding: "20px 26px 26px" } as const;
const sectionStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" } as const;
const sectionTitleStyle = { color: "var(--text-strong)", fontSize: 13, fontWeight: 700, padding: "12px 14px", borderBottom: "1px solid var(--separator)" } as const;
const rowStyle = { display: "grid", gridTemplateColumns: "24px minmax(105px, .8fr) minmax(0, 1.2fr)", alignItems: "center", gap: 8, minHeight: 44, padding: "7px 14px", borderBottom: "1px solid var(--separator)" } as const;
const rowIconStyle = { display: "flex", color: "var(--accent)" } as const;
const rowLabelStyle = { color: "var(--muted)", fontSize: 12 } as const;
const rowValueStyle = { color: "var(--text-strong)", fontSize: 13, fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" } as const;
const changesListStyle = { display: "grid", maxHeight: 430, overflowY: "auto" } as const;
const changeItemStyle = { display: "flex", alignItems: "flex-start", gap: 10, padding: 14, borderBottom: "1px solid var(--separator)" } as const;
const changeDateStyle = { display: "block", color: "var(--muted)", fontSize: 10.5, marginBottom: 4 } as const;
const changeTextStyle = { display: "block", color: "var(--text)", fontSize: 12.5, lineHeight: 1.5 } as const;
const rulesStyle = { display: "grid" } as const;
const noRulesStyle = { padding: 14, color: "var(--muted)", fontSize: 12 } as const;
const detailRuleStyle = { display: "grid", gridTemplateColumns: "20px 48px minmax(0, 1fr)", alignItems: "start", gap: 7, padding: "10px 14px", borderBottom: "1px solid var(--separator)" } as const;
const detailRuleCodeStyle = { color: "#A78BFA", fontSize: 11, fontWeight: 800, fontFamily: "monospace", paddingTop: 2 } as const;
const detailRuleTextStyle = { color: "var(--text)", fontSize: 12.5, lineHeight: 1.45 } as const;
