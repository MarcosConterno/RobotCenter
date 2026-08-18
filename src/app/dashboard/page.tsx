"use client";

import { BarChart3, Layers3, LayoutDashboard, TableProperties } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Feed from "@/components/dashboard/Feed";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import { useAdminAccess } from "@/auth/AdminAccessProvider";
import RobotsOverviewTable from "@/components/dashboard/RobotsOverviewTable";
import StatsCards from "@/components/dashboard/StatsCards";
import StackRequestsDashboard from "@/components/dashboard/StackRequestsDashboard";
import StackMap from "@/components/dashboard/StackMap";
import AppShell from "@/components/layout/AppShell";
import Topbar from "@/components/layout/Topbar";
import { useAppData } from "@/data/AppDataProvider";
import type { Robo } from "@/domain/entities";

export default function DashboardPage() {
  const router = useRouter();
  const { robos, publicacoes, clientes, atualizarCapacidadeRobo } = useAppData();
  const { canUpdateCapacity } = useAdminAccess();
  const [activeTab, setActiveTab] = useState<"overview" | "robots" | "stacks" | "charts">("overview");

  function openRobotDetails(robot: Robo, tab?: "stackRequests") {
    router.push(`/robos/${robot.id}${tab ? `?tab=${tab}` : ""}`);
  }

  return (
    <AppShell title="Dashboard" hideTopbar>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 1480, margin: "0 auto" }}>
          <div className="dashboard-welcome">
            <div className="dashboard-welcome__copy">
              <div><span className="dashboard-welcome__eyebrow">DASHBOARD</span><h1>Visão geral do Robot Center</h1><p>Acompanhe robôs, capacidade e solicitações operacionais.</p></div>
            </div>
            <Topbar title="Conta do usuário" bare />
          </div>
          <nav className="dashboard-tabs" role="tablist" aria-label="Visualizações da Dashboard">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "stacks"}
              aria-controls="dashboard-stacks-panel"
              className={activeTab === "stacks" ? "is-active" : ""}
              onClick={() => setActiveTab("stacks")}
            >
              <Layers3 size={15} />
              Mapa de stacks
            </button>
            <button
              type="button"
              role="tab"
              data-tour="dashboard-overview-tab"
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
              data-tour="dashboard-robots-tab"
              aria-selected={activeTab === "robots"}
              aria-controls="dashboard-robots-panel"
              className={activeTab === "robots" ? "is-active" : ""}
              onClick={() => setActiveTab("robots")}
            >
              <TableProperties size={15} />
              Tabela de robôs
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "charts"}
              aria-controls="dashboard-charts-panel"
              className={activeTab === "charts" ? "is-active" : ""}
              onClick={() => setActiveTab("charts")}
            >
              <BarChart3 size={15} />
              Gráficos
            </button>
          </nav>

          {activeTab === "overview" ? (
            <div id="dashboard-overview-panel" role="tabpanel" className="dashboard-tab-panel">
              <StatsCards robos={robos} />
              <StackRequestsDashboard robots={robos} onOpenRobot={openRobotDetails} />
              <Feed publicacoes={publicacoes} robos={robos} onViewRobot={openRobotDetails} />
            </div>
          ) : activeTab === "robots" ? (
            <div id="dashboard-robots-panel" role="tabpanel" className="dashboard-tab-panel">
              <RobotsOverviewTable robos={robos} clientes={clientes} onViewRobot={openRobotDetails} canEditCapacity={canUpdateCapacity} onUpdateCapacity={atualizarCapacidadeRobo} />
            </div>
          ) : activeTab === "stacks" ? (
            <div id="dashboard-stacks-panel" role="tabpanel" className="dashboard-tab-panel">
              <StackMap robots={robos} clients={clientes} onOpenRobot={openRobotDetails} />
            </div>
          ) : (
            <div id="dashboard-charts-panel" role="tabpanel" className="dashboard-tab-panel">
              <DashboardCharts robots={robos} clients={clientes} />
            </div>
          )}
        </div>
    </AppShell>
  );
}

