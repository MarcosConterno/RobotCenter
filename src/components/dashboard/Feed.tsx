"use client";

import { ArrowRight, Bot, Clock3 } from "lucide-react";
import { useMemo } from "react";
import { formatarDataHoraRelativa } from "@/domain/formatters";
import type { CategoriaPublicacao, Publicacao, Robo } from "@/domain/entities";

interface FeedProps {
  publicacoes: Publicacao[];
  robos: Robo[];
  onViewRobot: (robot: Robo) => void;
}

const categoryColors: Record<CategoriaPublicacao, string> = {
  "Novo Robô": "#60A5FA",
  "Atualização de Regra": "#A78BFA",
  "Atualização do Robô": "#A78BFA",
};

export default function Feed({ publicacoes, robos, onViewRobot }: FeedProps) {
  const robosPorId = useMemo(() => new Map(robos.map((robo) => [robo.id, robo])), [robos]);
  const items = publicacoes.flatMap((publicacao) => {
    const robo = robosPorId.get(publicacao.roboId);
    return robo ? [{ publicacao, robo }] : [];
  });

  return (
    <section style={sectionStyle}>
      <header style={feedHeaderStyle}>
        <div>
          <h2 style={feedTitleStyle}>Atualizações recentes</h2>
          <p style={feedSubtitleStyle}>Histórico das últimas publicações realizadas.</p>
        </div>
        <span style={countStyle}>{items.length} publicações</span>
      </header>

      <div>
        {items.map((item) => (
          <article key={item.publicacao.id} style={itemStyle}>
            <span style={{ ...robotIconStyle, color: categoryColors[item.publicacao.categoria], background: `${categoryColors[item.publicacao.categoria]}14` }}>
              <Bot size={17} />
            </span>

            <div style={contentStyle}>
              <div style={metadataStyle}>
                <span style={{ ...categoryStyle, color: categoryColors[item.publicacao.categoria] }}>{item.publicacao.categoria}</span>
                <span style={dotStyle}>•</span>
                <span style={timeStyle}><Clock3 size={11} />{formatarDataHoraRelativa(item.publicacao.publicadaEm)}</span>
              </div>
              <h3 style={robotNameStyle}>{item.robo.nome}</h3>
              <p style={descriptionStyle}>{item.publicacao.descricao}</p>
            </div>

            <button type="button" onClick={() => onViewRobot(item.robo)} style={detailsButtonStyle}>
              Ver detalhes <ArrowRight size={14} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

const sectionStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow)" } as const;
const feedHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", borderBottom: "1px solid var(--separator)" } as const;
const feedTitleStyle = { color: "var(--text-strong)", fontSize: 14, margin: 0, fontWeight: 700 } as const;
const feedSubtitleStyle = { color: "var(--muted)", fontSize: 11.5, margin: "3px 0 0" } as const;
const countStyle = { color: "var(--muted)", background: "var(--surface)", padding: "4px 8px", borderRadius: 999, fontSize: 10.5, whiteSpace: "nowrap" } as const;
const itemStyle = { display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) auto", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: "1px solid var(--separator)" } as const;
const robotIconStyle = { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9 } as const;
const contentStyle = { minWidth: 0 } as const;
const metadataStyle = { display: "flex", alignItems: "center", gap: 6, marginBottom: 3 } as const;
const categoryStyle = { fontSize: 10.5, fontWeight: 700 } as const;
const dotStyle = { color: "var(--faint)", fontSize: 10 } as const;
const timeStyle = { display: "inline-flex", alignItems: "center", gap: 4, color: "var(--muted)", fontSize: 10.5 } as const;
const robotNameStyle = { color: "var(--text-strong)", fontSize: 13.5, margin: 0, lineHeight: 1.3 } as const;
const descriptionStyle = { color: "var(--muted)", fontSize: 11.5, lineHeight: 1.45, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const detailsButtonStyle = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--accent)", borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontSize: 11.5, fontWeight: 650, whiteSpace: "nowrap" } as const;
