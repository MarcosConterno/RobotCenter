import type { CorBadgeRobo } from "@/domain/entities";

export const PALETAS_BADGE_ROBO: Record<CorBadgeRobo, { nome: string; fundo: string; texto: string; borda: string }> = {
  azul: { nome: "Azul", fundo: "rgba(59,130,246,.14)", texto: "#BFDBFE", borda: "rgba(96,165,250,.28)" },
  violeta: { nome: "Violeta", fundo: "rgba(124,58,237,.16)", texto: "#DDD6FE", borda: "rgba(167,139,250,.3)" },
  verde: { nome: "Verde", fundo: "rgba(16,185,129,.14)", texto: "#A7F3D0", borda: "rgba(52,211,153,.27)" },
  ambar: { nome: "Âmbar", fundo: "rgba(245,158,11,.14)", texto: "#FDE68A", borda: "rgba(251,191,36,.28)" },
  rosa: { nome: "Rosa", fundo: "rgba(236,72,153,.14)", texto: "#FBCFE8", borda: "rgba(244,114,182,.28)" },
  ciano: { nome: "Ciano", fundo: "rgba(6,182,212,.14)", texto: "#A5F3FC", borda: "rgba(34,211,238,.28)" },
};
