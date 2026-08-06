import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface AppShellProps {
  title: string;
  children: ReactNode;
}

export default function AppShell({
  title,
  children,
}: AppShellProps) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#0F172A",
      }}
    >
      <Sidebar />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Topbar title={title} />

        <main
          style={{
            flex: 1,
            padding: "32px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}