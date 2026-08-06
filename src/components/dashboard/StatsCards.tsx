import { Bot, Code2, FlaskConical, Rocket } from "lucide-react";

const cards = [
  { icon: Bot, title: "Total de robôs", value: "23", color: "#60A5FA", background: "rgba(59,130,246,.1)" },
  { icon: Rocket, title: "Produção", value: "12", color: "#4ADE80", background: "rgba(34,197,94,.1)" },
  { icon: FlaskConical, title: "Em teste", value: "7", color: "#FBBF24", background: "rgba(245,158,11,.1)" },
  { icon: Code2, title: "Desenvolvimento", value: "4", color: "#A78BFA", background: "rgba(139,92,246,.1)" },
];

export default function StatsCards() {
  return (
    <section style={containerStyle} aria-label="Resumo dos robôs">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div key={card.title} style={{ ...itemStyle, borderRight: index < cards.length - 1 ? "1px solid #273449" : "none" }}>
            <span style={{ ...iconStyle, color: card.color, background: card.background }}>
              <Icon size={17} />
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

const containerStyle = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", background: "#172234", border: "1px solid #273449", borderRadius: 12, overflow: "hidden" } as const;
const itemStyle = { display: "flex", alignItems: "center", gap: 11, minWidth: 0, padding: "13px 15px" } as const;
const iconStyle = { width: 34, height: 34, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } as const;
const labelStyle = { display: "block", color: "#8B9CB3", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;
const valueStyle = { display: "block", color: "#F8FAFC", fontSize: 19, lineHeight: 1.15, fontWeight: 750, marginTop: 2 } as const;
