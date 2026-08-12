"use client";

import {
  Bot,
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

const RECENT_UPDATES_LIMIT = 5;
const DASHBOARD_HISTORY_OPTIONS = [5, 10, 25, 50] as const;

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

  const normalizedDescription = description.toLocaleLowerCase("pt-BR");
  const isRobotCenterDocumentationPublication = normalizedDescription.includes("documentação técnica publicada");
  if (isRobotCenterDocumentationPublication && !ruleChanges.some((change) => change.type === "Documentação")) {
    ruleChanges.push({ type: "Documentação", description: "Documentação Robot Center atualizada." });
  }

  return {
    ruleChanges,
    description: regularChanges.join(" • ") || (ruleChanges.length ? "Regras funcionais atualizadas." : description),
  };
}

export default function Feed({ publicacoes, robos, onViewRobot }: FeedProps) {
  const [resultLimit, setResultLimit] = useState<number>(RECENT_UPDATES_LIMIT);
  const robosPorId = useMemo(() => new Map(robos.map((robo) => [robo.id, robo])), [robos]);
  const items = useMemo(() => publicacoes
    .flatMap((publicacao) => {
      const robo = robosPorId.get(publicacao.roboId);
      return robo ? [{ publicacao, robo }] : [];
    })
    .sort((a, b) => new Date(b.publicacao.publicadaEm).getTime() - new Date(a.publicacao.publicadaEm).getTime())
    .slice(0, resultLimit), [publicacoes, resultLimit, robosPorId]);

  return (
    <section className="updates-feed" data-tour="dashboard-recent-updates">
      <header className="updates-feed__header">
        <div>
          <h2>Atualizações recentes</h2>
          <p>Acompanhe as últimas alterações realizadas nos robôs.</p>
        </div>
        <label className="updates-feed__limit">
          <span>Mostrar</span>
          <select value={resultLimit} onChange={(event) => setResultLimit(Number(event.target.value))} aria-label="Quantidade de atualizações exibidas">
            {DASHBOARD_HISTORY_OPTIONS.map((option) => <option key={option} value={option}>{option} resultados</option>)}
          </select>
        </label>
      </header>

      <div className="updates-feed__list">
        {items.map(({ publicacao, robo }) => {
          const EnvironmentIcon = getEnvironmentIcon(robo.ambiente);
          const { label: updateLabel, Icon: UpdateIcon } = getUpdateKind(publicacao);
          const parsedDescription = parsePublicationDescription(publicacao.descricao);
          const normalizedDescription = publicacao.descricao.toLocaleLowerCase("pt-BR");
          const packageChanged = normalizedDescription.includes("pacote");
          const isDocumentationPublication = normalizedDescription.includes("documentação técnica publicada");
          const versionChanged = !isDocumentationPublication
            && (normalizedDescription.includes("versão") || normalizedDescription.includes("versao"));
          const environmentClass = robo.ambiente === "Produção" ? "is-production" : robo.ambiente === "Teste" ? "is-test" : "is-development";

          return (
            <article
              key={publicacao.id}
              className={`updates-feed__row ${environmentClass}${parsedDescription.ruleChanges.length ? " has-documentation" : ""}`}
              role="link"
              tabIndex={0}
              aria-label={`Abrir robô ${robo.nome}`}
              onClick={() => onViewRobot(robo)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onViewRobot(robo);
                }
              }}
            >
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

              {parsedDescription.ruleChanges.length > 0 && (
                <div className="updates-feed__rule-changes" aria-label="Regras alteradas">
                  {parsedDescription.ruleChanges.map((rule, index) => (
                    <div key={`${rule.type}-${index}`} className="updates-feed__rule-change">
                      <strong><Plus size={12} /> {rule.type}</strong>
                    </div>
                  ))}
                </div>
              )}

              <div className="updates-feed__technical" aria-label="Informações técnicas">
                <span className={packageChanged ? "is-changed" : undefined} title={`Pacote: ${robo.pacote}`}><Package size={12} />{robo.pacote}</span>
                <span title={`Stack: ${robo.stack}`}><Layers3 size={12} />{robo.stack}</span>
                <span className={`is-version${versionChanged ? " is-changed" : ""}`} title={`Versão atual: ${robo.versao}`}>v{robo.versao}</span>
              </div>

            </article>
          );
        })}

        {items.length === 0 && (
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
          <span>Exibindo {items.length} {items.length === 1 ? "atualização recente" : "atualizações mais recentes"}.</span>
        </footer>
      )}
    </section>
  );
}
