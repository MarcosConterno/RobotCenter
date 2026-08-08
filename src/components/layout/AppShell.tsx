import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

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
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg)",
      }}
    >
      <Sidebar />

      <div
        style={{
          position: "relative",
          flex: 1,
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
  );
}
