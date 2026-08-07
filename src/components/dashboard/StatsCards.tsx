import { Bot, Code2, FlaskConical, Rocket } from "lucide-react";
import type { Robo } from "@/domain/entities";

export default function StatsCards({ robos }: { robos: Robo[] }) {
  const cards = [
    { icon: Bot, title: "Total de robôs", value: robos.length, color: "#60A5FA", background: "rgba(59,130,246,.1)" },
    { icon: Rocket, title: "Produção", value: robos.filter((robo) => robo.ambiente === "Produção").length, color: "#4ADE80", background: "rgba(34,197,94,.1)" },
    { icon: FlaskConical, title: "Em teste", value: robos.filter((robo) => robo.ambiente === "Teste").length, color: "#FBBF24", background: "rgba(245,158,11,.1)" },
    { icon: Code2, title: "Desenvolvimento", value: robos.filter((robo) => robo.ambiente === "Desenvolvimento").length, color: "#A78BFA", background: "rgba(139,92,246,.1)" },
  ];
  return (
    <section style={containerStyle} aria-label="Resumo dos robôs">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div key={card.title} style={{ ...itemStyle, borderRight: index < cards.length - 1 ? "1px solid var(--separator)" : "none" }}>
            <span style={{ ...iconStyle, color: card.color, background: card.background }}>
              <Icon size={15} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={labelStyle}>{card.title}</span>
              <span style={valueStyle}>{card.value}</span>
            </span>
          </div>
        );
      })}
    </section>
  );
}

const containerStyle = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--shadow)" } as const;
const itemStyle = { display: "flex", alignItems: "center", gap: 9, minWidth: 0, padding: "9px 12px" } as const;
const iconStyle = { width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } as const;
const labelStyle = { display: "block", color: "var(--muted)", fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;
const valueStyle = { display: "block", color: "var(--text-strong)", fontSize: 16, lineHeight: 1.05, fontWeight: 700, marginTop: 1 } as const;
