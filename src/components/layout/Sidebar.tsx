"use client";

import { Bot, ChevronRight, LayoutDashboard, Settings2, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAdminAccess } from "@/auth/AdminAccessProvider";

const navigation = [
  { href: "/dashboard", label: "Dashboard", description: "Visão geral", icon: LayoutDashboard, access: "dashboard" },
  { href: "/robos", label: "Robôs", description: "Consulta e detalhes", icon: Bot, access: "robots" },
  { href: "/configuracoes", label: "Configurações", description: "Usuários e clientes", icon: Settings2, access: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { canAccessRobots, canAccessSettings, status } = useAdminAccess();
  const visibleNavigation = navigation.filter((item) => (
    item.access === "dashboard"
    || (item.access === "robots" && canAccessRobots)
    || (item.access === "settings" && canAccessSettings)
  ));

  return (
    <aside className="app-sidebar">
      <div>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Bot size={22} />
            <span className="sidebar-brand-spark"><Sparkles size={10} /></span>
          </div>
          <div className="sidebar-brand-copy">
            <div className="sidebar-brand-name">Robot Center</div>
            <div className="sidebar-brand-tagline">Automation workspace</div>
          </div>
        </div>

        <div className="sidebar-section-label">NAVEGAÇÃO</div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {(status === "loading" ? navigation.slice(0, 1) : visibleNavigation).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`sidebar-link${active ? " sidebar-link-active" : ""}`}
              >
                <span className="sidebar-link-icon"><Icon size={17} /></span>
                <span className="sidebar-link-copy">
                  <span className="sidebar-link-title">{item.label}</span>
                  <span className="sidebar-link-description">{item.description}</span>
                </span>
                <ChevronRight className="sidebar-link-arrow" size={14} />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer-dot" />
        <div>
          <div className="sidebar-footer-title">Sistema operacional</div>
          <div className="sidebar-footer-version">Versão 0.0.3</div>
        </div>
      </div>
    </aside>
  );
}
