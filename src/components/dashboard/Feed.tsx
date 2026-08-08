"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Clock,
  CloudUpload,
  Code2,
  FlaskConical,
  Layers3,
  Package,
  Plus,
  Rocket,
  Settings,
  SquarePen,
  Upload,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { Publicacao, Robo } from "@/domain/entities";
import { formatarDataHoraRelativa } from "@/domain/formatters";

interface FeedProps {
  publicacoes: Publicacao[];
  robos: Robo[];
  onViewRobot: (robot: Robo) => void;
}

interface UpdateKind {
  label: string;
  Icon: LucideIcon;
}

interface RuleChange {
  type: "Documentação" | "Fora da Documentação";
  description: string;
}

const DASHBOARD_HISTORY_LIMIT = 10;
const RECENT_UPDATES_LIMIT = 5;

function getEnvironmentIcon(ambiente: Robo["ambiente"]): LucideIcon {
  if (ambiente === "Produção") return Rocket;
  if (ambiente === "Teste") return FlaskConical;
  return Code2;
}

function getUpdateKind(publicacao: Publicacao): UpdateKind {
  if (publicacao.categoria === "Novo Robô") return { label: "Novo robô", Icon: Plus };
  if (publicacao.descricao.includes("[REGRA_")) return { label: "Alteração", Icon: SquarePen };

  const descricao = publicacao.descricao.toLocaleLowerCase("pt-BR");
  if (descricao.includes("correç") || descricao.includes("corrig")) return { label: "Correção", Icon: Wrench };
  if (descricao.includes("nova versão") || descricao.includes("versão")) return { label: "Nova versão", Icon: CloudUpload };
  if (descricao.includes("nova funcionalidade") || descricao.includes("incluíd") || descricao.includes("adicion")) return { label: "Nova funcionalidade", Icon: Plus };
  if (descricao.includes("configura")) return { label: "Configuração", Icon: Settings };
  if (descricao.includes("publica")) return { label: "Publicação", Icon: Upload };
  return { label: "Alteração", Icon: SquarePen };
}

function parsePublicationDescription(description: string) {
  const ruleChanges: RuleChange[] = [];
  const regularChanges: string[] = [];

  description.split(" • ").forEach((part) => {
    const value = part.trim();
    if (value.startsWith("[REGRA_DOCUMENTACAO]")) {
      ruleChanges.push({ type: "Documentação", description: value.replace("[REGRA_DOCUMENTACAO]", "").trim() });
    } else if (value.startsWith("[REGRA_FORA_DOCUMENTACAO]")) {
      ruleChanges.push({ type: "Fora da Documentação", description: value.replace("[REGRA_FORA_DOCUMENTACAO]", "").trim() });
    } else if (value) {
      regularChanges.push(value);
    }
  });

  return {
    ruleChanges,
    description: regularChanges.join(" • ") || (ruleChanges.length ? "Regras funcionais atualizadas." : description),
  };
}

export default function Feed({ publicacoes, robos, onViewRobot }: FeedProps) {
  const [showCompleteHistory, setShowCompleteHistory] = useState(false);
  const robosPorId = useMemo(() => new Map(robos.map((robo) => [robo.id, robo])), [robos]);
  const items = useMemo(() => publicacoes
    .flatMap((publicacao) => {
      const robo = robosPorId.get(publicacao.roboId);
      return robo ? [{ publicacao, robo }] : [];
    })
    .sort((a, b) => new Date(b.publicacao.publicadaEm).getTime() - new Date(a.publicacao.publicadaEm).getTime())
    .slice(0, DASHBOARD_HISTORY_LIMIT), [publicacoes, robosPorId]);
  const visibleItems = showCompleteHistory ? items : items.slice(0, RECENT_UPDATES_LIMIT);

  return (
    <section className="updates-feed">
      <header className="updates-feed__header">
        <div>
          <h2>Atualizações recentes</h2>
          <p>Acompanhe as últimas alterações realizadas nos robôs.</p>
        </div>
        {items.length > RECENT_UPDATES_LIMIT && (
          <button type="button" className="updates-feed__history-button" onClick={() => setShowCompleteHistory((current) => !current)}>
            {showCompleteHistory ? <><ArrowLeft size={13} /> Mostrar recentes</> : <>Ver histórico completo <ArrowRight size={13} /></>}
          </button>
        )}
      </header>

      <div className="updates-feed__list">
        {visibleItems.map(({ publicacao, robo }) => {
          const EnvironmentIcon = getEnvironmentIcon(robo.ambiente);
          const { label: updateLabel, Icon: UpdateIcon } = getUpdateKind(publicacao);
          const parsedDescription = parsePublicationDescription(publicacao.descricao);
          const normalizedDescription = publicacao.descricao.toLocaleLowerCase("pt-BR");
          const packageChanged = normalizedDescription.includes("pacote");
          const versionChanged = normalizedDescription.includes("versão") || normalizedDescription.includes("versao");
          const environmentClass = robo.ambiente === "Produção" ? "is-production" : robo.ambiente === "Teste" ? "is-test" : "is-development";

          return (
            <article key={publicacao.id} className={`updates-feed__row ${environmentClass}`}>
              <span className="updates-feed__environment-bar" aria-hidden="true" />
              <span className="updates-feed__environment-icon"><EnvironmentIcon size={19} /></span>

              <div className="updates-feed__robot">
                <div>
                  <span className="updates-feed__environment">{robo.ambiente}</span>
                  <h3>{robo.nome}</h3>
                  <small>{robo.courtName}</small>
                </div>
              </div>

              <div className="updates-feed__change">
                <div className="updates-feed__change-labels">
                  <span><UpdateIcon size={13} /> {updateLabel}</span>
                </div>
                <p>{parsedDescription.description}</p>
              </div>

                <div className={`updates-feed__rule-changes${parsedDescription.ruleChanges.length ? "" : " is-empty"}`} aria-label="Regras alteradas">
                  {parsedDescription.ruleChanges.map((rule, index) => (
                    <div key={`${rule.type}-${index}`} className="updates-feed__rule-change">
                      <strong><Plus size={12} /> {rule.type}</strong>
                    </div>
                  ))}
                </div>

              <div className="updates-feed__technical" aria-label="Informações técnicas">
                <span className={packageChanged ? "is-changed" : undefined} title={`Pacote: ${robo.pacote}`}><Package size={12} />{robo.pacote}</span>
                <span title={`Stack: ${robo.stack}`}><Layers3 size={12} />{robo.stack}</span>
                <span className={`is-version${versionChanged ? " is-changed" : ""}`} title={`Versão atual: ${robo.versao}`}>v{robo.versao}</span>
              </div>

              <div className="updates-feed__side">
                <span className="updates-feed__time"><Clock size={13} />{formatarDataHoraRelativa(publicacao.publicadaEm)}</span>
                <button type="button" className="updates-feed__details" onClick={() => onViewRobot(robo)}>
                  Ver detalhes <ArrowRight size={13} />
                </button>
              </div>
            </article>
          );
        })}

        {visibleItems.length === 0 && (
          <div className="updates-feed__empty">
            <span><Bot size={18} /></span>
            <div>
              <strong>Nenhuma atualização publicada</strong>
              <p>As próximas alterações dos robôs aparecerão aqui.</p>
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <footer className="updates-feed__footer">
          <span>Exibindo {visibleItems.length} {visibleItems.length === 1 ? "atualização recente" : "atualizações mais recentes"}.</span>
          {items.length > RECENT_UPDATES_LIMIT && (
            <button type="button" onClick={() => setShowCompleteHistory((current) => !current)}>
              {showCompleteHistory ? <><ArrowLeft size={13} /> Mostrar somente as recentes</> : <>Ver todas as atualizações <ArrowRight size={13} /></>}
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
