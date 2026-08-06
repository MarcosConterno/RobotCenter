"use client";

import { ArrowUpRight, Bot, TableProperties } from "lucide-react";

import { robotsMock } from "@/components/robos/robots.mock";
import type { Robot, RobotEnvironment } from "@/types/robot";

interface RobotsOverviewTableProps {
  onViewRobot: (robot: Robot) => void;
}

const environmentColors: Record<RobotEnvironment, { color: string; background: string }> = {
  Produção: { color: "#4ADE80", background: "rgba(34,197,94,.1)" },
  Teste: { color: "#FBBF24", background: "rgba(245,158,11,.1)" },
  Desenvolvimento: { color: "#A78BFA", background: "rgba(139,92,246,.1)" },
};

export default function RobotsOverviewTable({ onViewRobot }: RobotsOverviewTableProps) {
  return (
    <section className="dashboard-robots-table">
      <header className="dashboard-robots-table__header">
        <div className="dashboard-robots-table__heading">
          <span className="dashboard-robots-table__icon" aria-hidden="true">
            <TableProperties size={16} />
          </span>
          <div>
            <h2>Todos os robôs</h2>
            <p>Visão consolidada dos dados cadastrados no ambiente.</p>
          </div>
        </div>
        <span className="dashboard-robots-table__count">{robotsMock.length} robôs</span>
      </header>

      <div className="dashboard-robots-table__scroll">
        <table>
          <thead>
            <tr>
              <th>Robô</th>
              <th>Sistema / pacote</th>
              <th>Ambiente</th>
              <th>Status</th>
              <th>Dados técnicos</th>
              <th>Responsável</th>
              <th>Publicação</th>
              <th><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {robotsMock.map((robot) => {
              const environment = environmentColors[robot.ambiente];

              return (
                <tr
                  key={robot.id}
                  tabIndex={0}
                  onClick={() => onViewRobot(robot)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onViewRobot(robot);
                    }
                  }}
                >
                  <td>
                    <div className="dashboard-robots-table__robot">
                      <span><Bot size={15} /></span>
                      <div>
                        <strong>{robot.nome}</strong>
                        <small>{robot.descricao}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong className="dashboard-robots-table__primary">{robot.sistema}</strong>
                    <small className="dashboard-robots-table__secondary">{robot.pacote}</small>
                  </td>
                  <td>
                    <span className="dashboard-robots-table__badge" style={environment}>
                      {robot.ambiente}
                    </span>
                  </td>
                  <td>
                    <span className={`dashboard-robots-table__status ${robot.ativo ? "is-active" : "is-inactive"}`}>
                      <i /> {robot.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <strong className="dashboard-robots-table__primary">{robot.stack} · {robot.versao}</strong>
                    <small className="dashboard-robots-table__secondary">{robot.fila}</small>
                  </td>
                  <td className="dashboard-robots-table__muted">{robot.responsavel}</td>
                  <td className="dashboard-robots-table__muted">{robot.ultimaPublicacao}</td>
                  <td>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onViewRobot(robot);
                      }}
                      aria-label={`Ver detalhes de ${robot.nome}`}
                    >
                      Detalhes <ArrowUpRight size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
