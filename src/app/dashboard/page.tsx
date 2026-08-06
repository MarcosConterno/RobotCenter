"use client";

import { Activity, LayoutDashboard, TableProperties } from "lucide-react";
import { useState } from "react";

import Feed from "@/components/dashboard/Feed";
import RobotsOverviewTable from "@/components/dashboard/RobotsOverviewTable";
import StatsCards from "@/components/dashboard/StatsCards";
import AppShell from "@/components/layout/AppShell";
import RobotDetails from "@/components/robos/RobotDetails";
import { useAppData } from "@/data/AppDataProvider";
import type { Robo } from "@/domain/entities";

export default function DashboardPage() {
  const { robos, publicacoes } = useAppData();
  const [selectedRobot, setSelectedRobot] = useState<Robo | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "robots">("overview");

  function openRobotDetails(robot: Robo) {
    setSelectedRobot(robot);
  }

  return (
    <>
      <AppShell title="Dashboard">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1180, margin: "0 auto" }}>
          <nav className="dashboard-tabs" role="tablist" aria-label="Visualizações da Dashboard">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              aria-controls="dashboard-overview-panel"
              className={activeTab === "overview" ? "is-active" : ""}
              onClick={() => setActiveTab("overview")}
            >
              <LayoutDashboard size={15} />
              Visão geral
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "robots"}
              aria-controls="dashboard-robots-panel"
              className={activeTab === "robots" ? "is-active" : ""}
              onClick={() => setActiveTab("robots")}
            >
              <TableProperties size={15} />
              Tabela de robôs
            </button>
          </nav>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, color: "#A78BFA", background: "rgba(124,58,237,.12)" }}>
                  <Activity size={15} />
                </span>
                <h2 style={{ color: "#F8FAFC", fontSize: 21, margin: 0 }}>
                  {activeTab === "overview" ? "Visão geral" : "Tabela de robôs"}
                </h2>
              </div>
              <p style={{ color: "#7F91AA", fontSize: 12.5, margin: "6px 0 0 36px" }}>
                {activeTab === "overview"
                  ? "Acompanhe o ambiente e as últimas atualizações dos robôs."
                  : "Consulte os dados de todos os robôs em uma visão consolidada."}
              </p>
            </div>
          </div>

          {activeTab === "overview" ? (
            <div id="dashboard-overview-panel" role="tabpanel" className="dashboard-tab-panel">
              <StatsCards robos={robos} />
              <Feed publicacoes={publicacoes} robos={robos} onViewRobot={openRobotDetails} />
            </div>
          ) : (
            <div id="dashboard-robots-panel" role="tabpanel" className="dashboard-tab-panel">
              <RobotsOverviewTable robos={robos} onViewRobot={openRobotDetails} />
            </div>
          )}
        </div>
      </AppShell>

      {selectedRobot && (
        <div onClick={() => setSelectedRobot(null)} style={overlayStyle}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes de ${selectedRobot.nome}`}
            onClick={(event) => event.stopPropagation()}
            style={modalStyle}
          >
            <div style={modalHeaderStyle}>
              <div style={{ color: "#FFF", fontWeight: 700 }}>Detalhes do robô</div>
              <button type="button" onClick={() => setSelectedRobot(null)} style={closeButtonStyle}>
                Fechar
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <RobotDetails robot={selectedRobot} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "rgba(2, 6, 23, 0.72)",
};

const modalStyle: React.CSSProperties = {
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
  border: "1px solid #273449",
  borderRadius: 16,
  background: "#0F172A",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "18px 20px",
  borderBottom: "1px solid #273449",
};

const closeButtonStyle: React.CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "6px 10px",
  background: "transparent",
  color: "#FFF",
  cursor: "pointer",
};
