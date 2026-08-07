"use client";

import { TableProperties } from "lucide-react";

import type { Cliente, Robo } from "@/domain/entities";

interface RobotsOverviewTableProps {
  robos: Robo[];
  clientes: Cliente[];
  onViewRobot: (robot: Robo) => void;
}

export default function RobotsOverviewTable({ robos, clientes, onViewRobot }: RobotsOverviewTableProps) {
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
        <span className="dashboard-robots-table__count">{robos.length} robôs</span>
      </header>

      <div className="dashboard-robots-table__scroll">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Sistema</th>
              <th>Robô</th>
              <th>CourtName</th>
              <th>Fila</th>
              <th>Stack</th>
              <th>Ideal</th>
              <th>Max</th>
              <th>Pacote</th>
              <th>Versão</th>
            </tr>
          </thead>
          <tbody>
            {robos.map((robot) => {
              const cliente = clientes.find((item) => item.id === robot.clienteId);

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
                    <strong className="dashboard-robots-table__primary">{cliente?.nome ?? "—"}</strong>
                  </td>
                  <td>
                    <strong className="dashboard-robots-table__primary">{robot.sistema}</strong>
                  </td>
                  <td>
                    <strong className="dashboard-robots-table__primary">{robot.nome}</strong>
                  </td>
                  <td className="dashboard-robots-table__muted">{robot.courtName}</td>
                  <td className="dashboard-robots-table__muted">{robot.fila}</td>
                  <td className="dashboard-robots-table__muted">{robot.stack}</td>
                  <td className="dashboard-robots-table__muted">{robot.ideal}</td>
                  <td className="dashboard-robots-table__muted">{robot.max}</td>
                  <td className="dashboard-robots-table__muted">{robot.pacote}</td>
                  <td className="dashboard-robots-table__muted">{robot.versao}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
