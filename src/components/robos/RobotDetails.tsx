import {
  Bot,
  Calendar,
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
import type { ReactNode } from "react";
import type { Robot } from "@/types/robot";

interface RobotDetailsProps {
  robot: Robot | null;
  onEdit?: (robot: Robot) => void;
  onPublish?: (robot: Robot) => void;
}

const environmentColor = {
  Produção: "#22C55E",
  Teste: "#F59E0B",
  Desenvolvimento: "#3B82F6",
} as const;

export default function RobotDetails({ robot, onEdit, onPublish }: RobotDetailsProps) {
  if (!robot) {
    return (
      <div style={emptyStyle}>
        Selecione um robô para visualizar os detalhes.
      </div>
    );
  }

  const regras = robot.regras ?? [];

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
                  color: robot.ativo ? "#86EFAC" : "#CBD5E1",
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
                    background: robot.ativo ? "#22C55E" : "#94A3B8",
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

      <div style={sectionsGridStyle}>
        <DetailSection title="Configuração">
          <DetailRow icon={<Package size={17} />} label="Pacote" value={robot.pacote} />
          <DetailRow
            icon={<GitBranch size={17} />}
            label="Ambiente"
            value={
              <span style={{ ...environmentBadgeStyle, color: environmentColor[robot.ambiente] }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: environmentColor[robot.ambiente] }} />
                {robot.ambiente}
              </span>
            }
          />
          <DetailRow icon={<Calendar size={17} />} label="Última publicação" value={robot.ultimaPublicacao} />
        </DetailSection>

        <DetailSection title="Informações técnicas">
          <DetailRow icon={<Layers3 size={17} />} label="Stack" value={robot.stack} />
          <DetailRow icon={<Server size={17} />} label="Fila" value={robot.fila} />
          <DetailRow icon={<Bot size={17} />} label="Versão" value={robot.versao} />
          <DetailRow icon={<User size={17} />} label="Responsável" value={robot.responsavel} />
        </DetailSection>
      </div>

      <div style={documentationGridStyle}>
        <DetailSection title="Alteração realizada">
          <div style={documentContentStyle}>
            <FileText size={17} style={{ color: "#8B5CF6", flexShrink: 0 }} />
            <span>{robot.alteracaoRealizada || "Nenhuma alteração registrada."}</span>
          </div>
        </DetailSection>

        <DetailSection title="Regras funcionais">
          <div style={rulesStyle}>
            {regras.length === 0 && <div style={noRulesStyle}>Nenhuma regra cadastrada.</div>}
            {regras.map((regra, index) => (
              <div key={`${regra}-${index}`} style={detailRuleStyle}>
                <ListChecks size={16} style={{ color: "#8B5CF6", flexShrink: 0 }} />
                <span style={detailRuleCodeStyle}>{`RF${String(index + 1).padStart(3, "0")}`}</span>
                <span style={detailRuleTextStyle}>{regra}</span>
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
  background: "#111B2B",
  border: "1px solid #273449",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 18px 40px rgba(2, 6, 23, 0.3)",
} as const;

const emptyStyle = { ...containerStyle, minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" } as const;
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, padding: "24px 26px", background: "linear-gradient(135deg, rgba(124,58,237,.1), rgba(79,70,229,.025))", borderBottom: "1px solid #273449" } as const;
const identityStyle = { display: "flex", alignItems: "center", gap: 16, minWidth: 0 } as const;
const avatarStyle = { width: 54, height: 54, flexShrink: 0, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(124,58,237,.14)", border: "1px solid rgba(167,139,250,.22)" } as const;
const eyebrowStyle = { color: "#8B9CB3", fontSize: 10, fontWeight: 800, letterSpacing: 1.4, marginBottom: 4 } as const;
const titleStyle = { color: "#F8FAFC", margin: 0, fontSize: 24, lineHeight: 1.2 } as const;
const badgesStyle = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 9 } as const;
const systemBadgeStyle = { color: "#CBD5E1", fontSize: 12, padding: "4px 9px", borderRadius: 999, background: "rgba(148,163,184,.1)" } as const;
const statusBadgeStyle = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 9px", borderRadius: 999, fontWeight: 600 } as const;
const editButtonStyle = { display: "flex", alignItems: "center", gap: 7, flexShrink: 0, padding: "8px 14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", color: "#FFF", cursor: "pointer", fontWeight: 700, fontSize: 13, boxShadow: "0 8px 22px rgba(124, 58, 237, 0.24)" } as const;
const headerActionsStyle = { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 } as const;
const publishButtonStyle = { ...editButtonStyle, background: "rgba(124,58,237,.1)", border: "1px solid rgba(167,139,250,.35)", color: "#C4B5FD", boxShadow: "none" } as const;
const descriptionStyle = { padding: "20px 26px", borderBottom: "1px solid #273449" } as const;
const sectionLabelStyle = { color: "#8B9CB3", fontSize: 10, fontWeight: 800, letterSpacing: 1.3, marginBottom: 8 } as const;
const descriptionTextStyle = { color: "#CBD5E1", lineHeight: 1.6, fontSize: 14, margin: 0 } as const;
const sectionsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, padding: "20px 26px 26px" } as const;
const sectionStyle = { background: "rgba(15,23,42,.55)", border: "1px solid #273449", borderRadius: 12, overflow: "hidden" } as const;
const sectionTitleStyle = { color: "#F1F5F9", fontSize: 13, fontWeight: 700, padding: "12px 14px", borderBottom: "1px solid #273449" } as const;
const rowStyle = { display: "grid", gridTemplateColumns: "24px minmax(105px, .8fr) minmax(0, 1.2fr)", alignItems: "center", gap: 8, minHeight: 44, padding: "7px 14px", borderBottom: "1px solid rgba(39,52,73,.7)" } as const;
const rowIconStyle = { display: "flex", color: "#8B5CF6" } as const;
const rowLabelStyle = { color: "#8B9CB3", fontSize: 12 } as const;
const rowValueStyle = { color: "#F1F5F9", fontSize: 13, fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" } as const;
const environmentBadgeStyle = { display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 6, fontSize: 12 } as const;
const documentationGridStyle = { ...sectionsGridStyle, paddingTop: 0 } as const;
const documentContentStyle = { display: "flex", alignItems: "flex-start", gap: 10, padding: 14, color: "#CBD5E1", fontSize: 13, lineHeight: 1.55 } as const;
const rulesStyle = { display: "grid" } as const;
const noRulesStyle = { padding: 14, color: "#718198", fontSize: 12 } as const;
const detailRuleStyle = { display: "grid", gridTemplateColumns: "20px 48px minmax(0, 1fr)", alignItems: "start", gap: 7, padding: "10px 14px", borderBottom: "1px solid rgba(39,52,73,.7)" } as const;
const detailRuleCodeStyle = { color: "#A78BFA", fontSize: 11, fontWeight: 800, fontFamily: "monospace", paddingTop: 2 } as const;
const detailRuleTextStyle = { color: "#CBD5E1", fontSize: 12.5, lineHeight: 1.45 } as const;
