"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import DashboardUpdateNotifier from "@/components/notifications/DashboardUpdateNotifier";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const SIDEBAR_PREFERENCE_KEY = "robot-center:sidebar-collapsed";
let sidebarCollapsedMemory: boolean | null = null;

interface AppShellProps {
  title: string;
  children: ReactNode;
  hideTopbar?: boolean;
}

export default function AppShell({
  title,
  children,
  hideTopbar = false,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => sidebarCollapsedMemory ?? false);
  const [sidebarReady, setSidebarReady] = useState(false);

  useEffect(() => {
    if (sidebarCollapsedMemory === null) {
      const stored = window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY);
      sidebarCollapsedMemory = stored === null ? window.innerWidth < 1100 : stored === "true";
      setSidebarCollapsed(sidebarCollapsedMemory);
    }
    const frame = window.requestAnimationFrame(() => setSidebarReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      sidebarCollapsedMemory = next;
      window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(next));
      return next;
    });
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 240);
  }

  return (
    <>
      <DashboardUpdateNotifier />
      <div
        className={`app-shell${sidebarCollapsed ? " has-collapsed-sidebar" : ""}${sidebarReady ? " is-sidebar-ready" : ""}`}
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "var(--bg)",
        }}
      >
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

        <div
          className="app-shell-content"
          style={{
            position: "relative",
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!hideTopbar && (
            <div className="app-shell-account-row">
              <Topbar title={title} bare />
            </div>
          )}

          <main
            className={`app-shell-main${hideTopbar ? " has-inline-account" : ""}`}
            style={{
              flex: 1,
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
