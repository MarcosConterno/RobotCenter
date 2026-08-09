import type { TutorialCapabilities, TutorialStepDefinition } from "./types";

const dashboardStep: TutorialStepDefinition = {
  id: "dashboard-overview",
  route: "/dashboard",
  targets: ['[data-tour="dashboard-recent-updates"]'],
  title: "Atualizações recentes",
  description: "Acompanhe neste painel as alterações mais recentes das automações.",
  side: "bottom",
};

const dashboardTableStep: TutorialStepDefinition = {
  id: "dashboard-robots-table",
  route: "/dashboard",
  targets: ['[data-tour="dashboard-robots-table"]'],
  title: "Tabela de robôs",
  description: "Consulte nesta visualização os dados consolidados dos robôs.",
  side: "bottom",
};

const robotSteps: TutorialStepDefinition[] = [
  {
    id: "robots-navigation",
    route: "/dashboard",
    targets: ['[data-tour="sidebar-robots"]'],
    title: "Robôs",
    description: "Acesse a consulta de robôs e os detalhes de cada automação por este item.",
    side: "right",
  },
  {
    id: "robots-header",
    route: "/robos",
    targets: ['[data-tour="robots-header"]'],
    title: "Consulta de robôs",
    description: "Use a pesquisa e os filtros para localizar rapidamente uma automação.",
    side: "bottom",
  },
  {
    id: "robots-list",
    route: "/robos",
    targets: ['[data-tour="robots-list"]', '[data-tour="robots-header"]'],
    title: "Detalhes do robô",
    description: "Selecione um card para abrir dados gerais, regras e documentações disponíveis.",
    side: "top",
  },
];

const flowStep: TutorialStepDefinition = {
  id: "flows",
  route: "/fluxos",
  targets: ['[data-tour="flows-heading"]', '[data-tour="sidebar-flows"]'],
  title: "Fluxos",
  description: "Consulte a documentação visual das automações e seus relacionamentos.",
  side: "bottom",
};

const adminSteps: TutorialStepDefinition[] = [
  {
    id: "settings-navigation",
    route: "/fluxos",
    targets: ['[data-tour="sidebar-settings"]'],
    title: "Configurações",
    description: "A administração de usuários, clientes e permissões fica disponível aqui.",
    side: "right",
  },
  {
    id: "settings-sections",
    route: "/configuracoes",
    targets: ['[data-tour="settings-navigation"]'],
    title: "Administração",
    description: "Alterne entre usuários, clientes e a matriz de permissões conforme seu acesso.",
    side: "bottom",
  },
];

export function resolveTutorialSteps(capabilities: TutorialCapabilities) {
  const steps: TutorialStepDefinition[] = [dashboardStep, dashboardTableStep];
  if (capabilities.canAccessRobots) steps.push(...robotSteps);
  if (capabilities.canAccessFlows) steps.push(flowStep);
  if (capabilities.canAccessSettings) steps.push(...adminSteps);
  return steps;
}
