"use client";

import { ArrowRight, Bot, Clock3, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { formatarDataHoraRelativa } from "@/domain/formatters";
import type { Publicacao, Robo } from "@/domain/entities";

interface FeedProps {
  publicacoes: Publicacao[];
  robos: Robo[];
  onViewRobot: (robot: Robo) => void;
}

export default function Feed({ publicacoes, robos, onViewRobot }: FeedProps) {
  const robosPorId = useMemo(() => new Map(robos.map((robo) => [robo.id, robo])), [robos]);
  const items = useMemo(() => publicacoes
    .flatMap((publicacao) => {
      const robo = robosPorId.get(publicacao.roboId);
      return robo ? [{ publicacao, robo }] : [];
    })
    .sort((a, b) => new Date(b.publicacao.publicadaEm).getTime() - new Date(a.publicacao.publicadaEm).getTime())
    .slice(0, 6), [publicacoes, robosPorId]);

  return (
    <section className="updates-feed">
      <header className="updates-feed__header">
        <div>
          <h2>Atualizações recentes</h2>
          <p>Novidades publicadas nos robôs integradores.</p>
        </div>
        <span className="updates-feed__count">{items.length} {items.length === 1 ? "novidade" : "novidades"}</span>
      </header>

      <div className="updates-feed__grid">
        {items.map((item) => {
          const isNewRobot = item.publicacao.categoria === "Novo Robô";

          return (
          <article key={item.publicacao.id} className={`updates-feed__item${isNewRobot ? " is-new-robot" : " is-update"}`}>
            <div className="updates-feed__identity">
              <span className={`updates-feed__new${isNewRobot ? " is-new-robot" : " is-update"}`}>
                {isNewRobot ? <Bot size={12} /> : <Sparkles size={12} />}
                {isNewRobot ? "Novo robô" : "Nova atualização"}
              </span>
              <div className="updates-feed__robot-name">
                <span><Bot size={16} /></span>
                <div>
                <h3>{item.robo.nome}</h3>
                  <small>{item.robo.courtName}</small>
                </div>
              </div>
            </div>

            <div className="updates-feed__description">
              <span>{isNewRobot ? "Descrição do novo robô" : "O que foi alterado"}</span>
              <p>{item.publicacao.descricao}</p>
            </div>

            <dl className="updates-feed__facts">
              <div><dt>Pacote</dt><dd>{item.robo.pacote}</dd></div>
              <div><dt>Stack</dt><dd>{item.robo.stack}</dd></div>
              <div className="is-version"><dt>Versão</dt><dd>v{item.robo.versao}</dd></div>
            </dl>

            <div className="updates-feed__side">
              <span className="updates-feed__time"><Clock3 size={12} />{formatarDataHoraRelativa(item.publicacao.publicadaEm)}</span>
              <button type="button" onClick={() => onViewRobot(item.robo)} className="updates-feed__details">
                Ver detalhes <ArrowRight size={14} />
              </button>
            </div>
          </article>
          );
        })}

        {items.length === 0 && (
          <div className="updates-feed__empty">
            <span><Sparkles size={18} /></span>
            <div>
              <strong>Nenhuma novidade publicada</strong>
              <p>As próximas atualizações dos robôs aparecerão aqui.</p>
              </div>
          </div>
        )}
      </div>
    </section>
  );
}
