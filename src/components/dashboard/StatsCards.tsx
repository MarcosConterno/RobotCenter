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
    <section className="dashboard-stats" aria-label="Resumo dos robôs">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.title} className="dashboard-stat-card" style={{ "--stat-color": card.color, "--stat-background": card.background } as React.CSSProperties}>
            <span className="dashboard-stat-card__icon">
              <Icon size={15} />
            </span>
            <span className="dashboard-stat-card__copy">
              <span>{card.title}</span>
              <strong>{card.value}</strong>
            </span>
          </article>
        );
      })}
    </section>
  );
}

