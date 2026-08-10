export interface TourTargetOption {
  key: string;
  label: string;
  selector: string;
  conditionKey?: "canAccessRobots" | "canAccessFlows" | "canAccessSettings" | "canManageTutorials";
}

export interface TourPageOption {
  key: string;
  label: string;
  route: string;
  targets: TourTargetOption[];
}

export const TOUR_PAGE_CATALOG: TourPageOption[] = [
  {
    key: "my-page",
    label: "Minha página",
    route: "/minha-pagina",
    targets: [
      { key: "sidebar-my-page", label: "Menu Minha página", selector: '[data-tour="sidebar-my-page"]' },
      { key: "my-page-welcome", label: "Saudação e visão pessoal", selector: '[data-tour="my-page-welcome"]' },
      { key: "my-page-tabs", label: "Navegação do workspace", selector: '[data-tour="my-page-tabs"]' },
      { key: "my-page-todos", label: "ToDos e resumo do dia", selector: '[data-tour="my-page-todos"]' },
      { key: "my-page-meetings", label: "Caderno de reuniões", selector: '[data-tour="my-page-meetings"]' },
      { key: "my-page-notes", label: "Notas pessoais", selector: '[aria-labelledby="notes-title"]' },
      { key: "my-page-personalize", label: "Personalização e widgets", selector: '[data-tour="my-page-personalize"]' },
    ],
  },
  {
    key: "dashboard",
    label: "Dashboard",
    route: "/dashboard",
    targets: [
      { key: "dashboard-overview", label: "Atualizações recentes", selector: '[data-tour="dashboard-recent-updates"]' },
      { key: "dashboard-robots-tab", label: "Visualização da tabela de robôs", selector: '[data-tour="dashboard-robots-table"]' },
      { key: "sidebar-dashboard", label: "Menu Dashboard", selector: '[data-tour="sidebar-dashboard"]' },
    ],
  },
  {
    key: "robots",
    label: "Robôs",
    route: "/robos",
    targets: [
      { key: "sidebar-robots", label: "Menu Robôs", selector: '[data-tour="sidebar-robots"]', conditionKey: "canAccessRobots" },
      { key: "robots-header", label: "Pesquisa e filtros de Robôs", selector: '[data-tour="robots-header"]', conditionKey: "canAccessRobots" },
      { key: "robots-list", label: "Cards de Robôs", selector: '[data-tour="robots-list"]', conditionKey: "canAccessRobots" },
    ],
  },
  {
    key: "flows",
    label: "Fluxos",
    route: "/fluxos",
    targets: [
      { key: "sidebar-flows", label: "Menu Fluxos", selector: '[data-tour="sidebar-flows"]', conditionKey: "canAccessFlows" },
      { key: "flows-heading", label: "Cabeçalho e ações de Fluxos", selector: '[data-tour="flows-heading"]', conditionKey: "canAccessFlows" },
    ],
  },
  {
    key: "settings",
    label: "Configurações",
    route: "/configuracoes",
    targets: [
      { key: "sidebar-settings", label: "Menu Configurações", selector: '[data-tour="sidebar-settings"]', conditionKey: "canManageTutorials" },
      { key: "settings-navigation", label: "Navegação de Configurações", selector: '[data-tour="settings-navigation"]', conditionKey: "canManageTutorials" },
    ],
  },
];

export function findTourPage(pageKey: string) {
  return TOUR_PAGE_CATALOG.find((page) => page.key === pageKey);
}

export function findTourTarget(pageKey: string, targetKey: string) {
  return findTourPage(pageKey)?.targets.find((target) => target.key === targetKey);
}
