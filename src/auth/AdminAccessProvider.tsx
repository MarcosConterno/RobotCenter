"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AccessStatus = "loading" | "ready";

interface AdminAccessContextValue {
  isAdmin: boolean;
  isOperator: boolean;
  isClient: boolean;
  isSupport: boolean;
  canManageRobots: boolean;
  canUpdateCapacity: boolean;
  canAccessSettings: boolean;
  canAccessRobots: boolean;
  roles: string[];
  status: AccessStatus;
  error: string;
}

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<string[]>([]);
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/access", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { roles?: string[]; error?: string };
        if (!active) return;
        setRoles(response.ok && Array.isArray(payload.roles) ? payload.roles : []);
        setError(response.status === 401 ? "" : payload.error ?? "");
      })
      .catch(() => {
        if (active) setError("Não foi possível validar as permissões da sessão.");
      })
      .finally(() => {
        if (active) setStatus("ready");
      });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => {
    const isAdmin = roles.includes("admin");
    const isOperator = roles.includes("operador");
    const isClient = roles.includes("cliente");
    const isSupport = roles.includes("suporte");
    return {
      isAdmin,
      isOperator,
      isClient,
      isSupport,
      canManageRobots: isAdmin,
      canUpdateCapacity: isAdmin || isOperator,
      canAccessSettings: isAdmin,
      canAccessRobots: isAdmin || isOperator || isClient,
      roles,
      status,
      error,
    };
  }, [error, roles, status]);
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const context = useContext(AdminAccessContext);
  if (!context) throw new Error("useAdminAccess deve ser usado dentro de AdminAccessProvider.");
  return context;
}
