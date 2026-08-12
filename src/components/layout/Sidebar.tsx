"use client";

import { Bot, Calculator, ChevronDown, ChevronRight, CircleHelp, GitFork, House, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Settings2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { useTutorial } from "@/tutorial/TutorialProvider";
import { ROBOT_PRODUCTS } from "@/domain/robot-products";
import { DASHBOARD_UNREAD_EVENT, readDashboardUnreadCount } from "@/domain/dashboard-notifications";

const navigation = [
  { href: "/minha-pagina", label: "Minha página", description: "Organização diária", icon: House, access: "my-page" },
  { href: "/dashboard", label: "Dashboard", description: "Visão geral", icon: LayoutDashboard, access: "dashboard" },
  { href: "/robos", label: "Robôs", description: "Consulta e detalhes", icon: Bot, access: "robots" },
  { href: "/fluxos", label: "Fluxos", description: "Documentação visual", icon: GitFork, access: "flows" },
  { href: "/orcamentos", label: "Orçamentos", description: "Estimativas de projetos", icon: Calculator, access: "budgets" },
  { href: "/configuracoes", label: "Configurações", description: "Usuários e clientes", icon: Settings2, access: "settings" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [robotsExpanded, setRobotsExpanded] = useState(() => pathname.startsWith("/robos"));
  const [hasDashboardUpdates, setHasDashboardUpdates] = useState(false);
  useEffect(() => {
    const sync = (event?: Event) => setHasDashboardUpdates(event instanceof CustomEvent ? event.detail > 0 : readDashboardUnreadCount() > 0);
    sync();
    window.addEventListener(DASHBOARD_UNREAD_EVENT, sync);
    return () => window.removeEventListener(DASHBOARD_UNREAD_EVENT, sync);
  }, []);
  const { canAccessRobots, canAccessRobotProduct, canAccessFlows, canAccessBudgets, canAccessSettings, canManageTutorials, status } = useAdminAccess();
  const tutorial = useTutorial();
  const visibleNavigation = navigation.filter((item) => (
    item.access === "my-page"
    || item.access === "dashboard"
    || (item.access === "robots" && canAccessRobots)
    || (item.access === "flows" && canAccessFlows)
    || (item.access === "budgets" && canAccessBudgets)
    || (item.access === "settings" && (canAccessSettings || canManageTutorials))
  ));

  return (
    <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}`}>
      <button
        type="button"
        className="sidebar-collapse-toggle"
        aria-label={collapsed ? "Expandir menu de navegação" : "Recolher menu de navegação"}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        onClick={onToggle}
      >
        {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
      </button>
      <div>
        <Link href="/minha-pagina" className="sidebar-brand" aria-label="Robot Center — ir para Minha página">
          <div className="sidebar-brand-icon">
            <Image src="/images/robot-center-system-logo-transparent.png" alt="" fill sizes="42px" priority />
          </div>
          <div className="sidebar-brand-copy">
            <div className="sidebar-brand-name">Robot Center</div>
            <div className="sidebar-brand-tagline">Automation workspace</div>
          </div>
        </Link>

        <div className="sidebar-section-label">NAVEGAÇÃO</div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {(status === "loading" ? navigation.slice(0, 1) : visibleNavigation).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            if (item.access === "robots") {
              return <div key={item.href} className="sidebar-group">
                <button type="button" aria-expanded={robotsExpanded} title={collapsed ? item.label : undefined} className={`sidebar-link sidebar-group-trigger${active ? " sidebar-link-active" : ""}`} data-tour="sidebar-robots" onClick={() => setRobotsExpanded((current) => !current)}>
                  <span className="sidebar-link-icon"><Icon size={17} /></span>
                  <span className="sidebar-link-copy"><span className="sidebar-link-title">{item.label}</span><span className="sidebar-link-description">Produtos de automação</span></span>
                  <ChevronDown className={`sidebar-group-chevron${robotsExpanded ? " is-open" : ""}`} size={14} />
                </button>
                {!collapsed && robotsExpanded && <div className="sidebar-subnav">
                  {ROBOT_PRODUCTS.filter((product) => canAccessRobotProduct(product.productType)).map((product) => {
                    const href = `/robos/${product.slug}`;
                    const productActive = pathname === href;
                    return <Link key={product.productType} href={href} className={`sidebar-sublink${productActive ? " is-active" : ""}`} aria-current={productActive ? "page" : undefined}><span aria-hidden="true" />{product.label}</Link>;
                  })}
                </div>}
              </div>;
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`sidebar-link${active ? " sidebar-link-active" : ""}`}
                data-tour={`sidebar-${item.access}`}
              >
                <span className="sidebar-link-icon"><Icon size={17} /></span>
                <span className="sidebar-link-copy">
                  <span className="sidebar-link-title">{item.label}</span>
                  <span className="sidebar-link-description">{item.description}</span>
                </span>
                {item.access === "dashboard" && hasDashboardUpdates && !active && <span className="sidebar-dashboard-notification" aria-label="Novas atualizações na Dashboard" />}
                <ChevronRight className="sidebar-link-arrow" size={14} />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={`sidebar-tutorial${tutorial.progress.status === "not_started" && !tutorial.loading ? " is-new" : ""}${tutorial.progress.status === "in_progress" ? " is-progress" : ""}`}
              title={collapsed ? "Tutorial" : undefined}
              aria-label="Abrir opções do tutorial"
              data-tour="sidebar-tutorial"
            >
              <span className="sidebar-link-icon"><CircleHelp size={17} /></span>
              <span className="sidebar-link-copy">
                <span className="sidebar-link-title">Tutorial</span>
                <span className="sidebar-link-description">Conheça o Robot Center</span>
              </span>
              {!tutorial.loading && (tutorial.progress.status === "not_started" || tutorial.progress.status === "in_progress") && <span className="sidebar-tutorial-indicator" aria-hidden="true" />}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="sidebar-tutorial-menu" side={collapsed ? "right" : "top"} align="start" sideOffset={8}>
              {tutorial.progress.status === "in_progress" && (
                <DropdownMenu.Item className="sidebar-tutorial-menu-item" onSelect={() => void tutorial.continueTutorial()}>
                  Continuar tutorial
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item className="sidebar-tutorial-menu-item" onSelect={() => void (tutorial.progress.status === "not_started" ? tutorial.startTutorial() : tutorial.restartTutorial())}>
                {tutorial.progress.status === "not_started" ? "Iniciar tutorial" : "Recomeçar tutorial"}
              </DropdownMenu.Item>
              {tutorial.progress.status === "in_progress" && (
                <DropdownMenu.Item className="sidebar-tutorial-menu-item is-muted" onSelect={() => void tutorial.skipTutorial()}>
                  Pular tutorial
                </DropdownMenu.Item>
              )}
              {tutorial.error && <div className="sidebar-tutorial-menu-error">{tutorial.error}</div>}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className="sidebar-footer">
          <div className="sidebar-footer-dot" />
          <div>
            <div className="sidebar-footer-title">Sistema operacional</div>
            <div className="sidebar-footer-version">Versão 1.0.0</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
