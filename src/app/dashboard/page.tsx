"use client";

import { LayoutDashboard, TableProperties } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Feed from "@/components/dashboard/Feed";
import { useAdminAccess } from "@/auth/AdminAccessProvider";
import RobotsOverviewTable from "@/components/dashboard/RobotsOverviewTable";
import StatsCards from "@/components/dashboard/StatsCards";
import AppShell from "@/components/layout/AppShell";
import Topbar from "@/components/layout/Topbar";
import { useAppData } from "@/data/AppDataProvider";
import type { Robo } from "@/domain/entities";

export default function DashboardPage() {
  const router = useRouter();
  const { robos, publicacoes, clientes, atualizarCapacidadeRobo } = useAppData();
  const { canUpdateCapacity, displayName } = useAdminAccess();
  const [activeTab, setActiveTab] = useState<"overview" | "robots">("overview");

  function openRobotDetails(robot: Robo) {
    router.push(`/robos/${robot.id}`);
  }

  return (
    <AppShell title="Dashboard" hideTopbar>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 1480, margin: "0 auto" }}>
          <div className="dashboard-welcome">
            <div className="dashboard-welcome__copy">
              <span className="dashboard-welcome__emoji" aria-hidden="true">👋</span>
              <div><span>Olá,</span><h1>{displayName}</h1></div>
            </div>
            <Topbar title="Conta do usuário" bare />
          </div>
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

          {activeTab === "overview" ? (
            <div id="dashboard-overview-panel" role="tabpanel" className="dashboard-tab-panel">
              <StatsCards robos={robos} />
              <Feed publicacoes={publicacoes} robos={robos} onViewRobot={openRobotDetails} />
            </div>
          ) : (
            <div id="dashboard-robots-panel" role="tabpanel" className="dashboard-tab-panel">
              <RobotsOverviewTable robos={robos} clientes={clientes} onViewRobot={openRobotDetails} canEditCapacity={canUpdateCapacity} onUpdateCapacity={atualizarCapacidadeRobo} />
            </div>
          )}
        </div>
    </AppShell>
  );
}

