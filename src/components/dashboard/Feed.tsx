"use client";

import { ArrowRight, Bot, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { robotsMock } from "@/components/robos/robots.mock";
import type { Robot } from "@/types/robot";

interface FeedProps { onViewRobot: (robot: Robot) => void; }
interface FeedItem {
  id: number | string;
  category: string;
  robot: Robot;
  description: string;
  publishedAt: string;
  color: string;
}

const feedItems: FeedItem[] = [
  { id: "new-robot", category: "Novo Robô", robot: robotsMock[1], description: "O robô Cadastro de Documentos foi publicado em ambiente de Produção para a seguradora Allianz.", publishedAt: "há 2 horas", color: "#60A5FA" },
  { id: "rule-update", category: "Atualização de Regra", robot: robotsMock[0], description: "A regra de validação de documentos foi atualizada para melhorar o tratamento de anexos recebidos.", publishedAt: "há 35 minutos", color: "#A78BFA" },
];

export default function Feed({ onViewRobot }: FeedProps) {
  const [items, setItems] = useState<FeedItem[]>(feedItems);

  useEffect(() => {
    try {
      const publications = JSON.parse(localStorage.getItem("robot-center-publications") ?? "[]") as Array<Omit<FeedItem, "color">>;
      setItems([...publications.map((publication) => ({ ...publication, color: "#A78BFA" })), ...feedItems]);
    } catch { setItems(feedItems); }
  }, []);

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
          <article key={item.id} style={itemStyle}>
            <span style={{ ...robotIconStyle, color: item.color, background: `${item.color}14` }}>
              <Bot size={17} />
            </span>

            <div style={contentStyle}>
              <div style={metadataStyle}>
                <span style={{ ...categoryStyle, color: item.color }}>{item.category}</span>
                <span style={dotStyle}>•</span>
                <span style={timeStyle}><Clock3 size={11} />{item.publishedAt}</span>
              </div>
              <h3 style={robotNameStyle}>{item.robot.nome}</h3>
              <p style={descriptionStyle}>{item.description}</p>
            </div>

            <button type="button" onClick={() => onViewRobot(item.robot)} style={detailsButtonStyle}>
              Ver detalhes <ArrowRight size={14} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

const sectionStyle = { background: "#172234", border: "1px solid #273449", borderRadius: 12, overflow: "hidden" } as const;
const feedHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", borderBottom: "1px solid #273449" } as const;
const feedTitleStyle = { color: "#F8FAFC", fontSize: 14, margin: 0, fontWeight: 700 } as const;
const feedSubtitleStyle = { color: "#7F91AA", fontSize: 11.5, margin: "3px 0 0" } as const;
const countStyle = { color: "#94A3B8", background: "rgba(148,163,184,.08)", padding: "4px 8px", borderRadius: 999, fontSize: 10.5, whiteSpace: "nowrap" } as const;
const itemStyle = { display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) auto", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: "1px solid rgba(39,52,73,.75)" } as const;
const robotIconStyle = { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9 } as const;
const contentStyle = { minWidth: 0 } as const;
const metadataStyle = { display: "flex", alignItems: "center", gap: 6, marginBottom: 3 } as const;
const categoryStyle = { fontSize: 10.5, fontWeight: 700 } as const;
const dotStyle = { color: "#475569", fontSize: 10 } as const;
const timeStyle = { display: "inline-flex", alignItems: "center", gap: 4, color: "#718198", fontSize: 10.5 } as const;
const robotNameStyle = { color: "#F1F5F9", fontSize: 13.5, margin: 0, lineHeight: 1.3 } as const;
const descriptionStyle = { color: "#94A3B8", fontSize: 11.5, lineHeight: 1.45, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const detailsButtonStyle = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #334155", background: "rgba(15,23,42,.45)", color: "#C4B5FD", borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontSize: 11.5, fontWeight: 650, whiteSpace: "nowrap" } as const;
