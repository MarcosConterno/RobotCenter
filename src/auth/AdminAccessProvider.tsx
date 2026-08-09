"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AccessStatus = "loading" | "ready";

interface AdminAccessContextValue {
  isAdmin: boolean;
  isMaster: boolean;
  isOperator: boolean;
  isClient: boolean;
  isSupport: boolean;
  canManageRobots: boolean;
  canUpdateCapacity: boolean;
  canAccessSettings: boolean;
  canAccessRobots: boolean;
  canAccessFlows: boolean;
  canEditFlows: boolean;
  canCreateFlows: boolean;
  canDeleteFlows: boolean;
  clientId: string | null;
  displayName: string;
  roles: string[];
  permissions: string[];
  canManageTutorials: boolean;
  status: AccessStatus;
  error: string;
}

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Usuário");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/access", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { roles?: string[]; permissions?: string[]; isMaster?: boolean; clientId?: string | null; displayName?: string; error?: string };
        if (!active) return;
        setRoles(response.ok && Array.isArray(payload.roles) ? payload.roles : []);
        setPermissions(response.ok && Array.isArray(payload.permissions) ? payload.permissions : []);
        setClientId(response.ok ? payload.clientId ?? null : null);
        setDisplayName(response.ok ? payload.displayName ?? "Usuário" : "Usuário");
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
    const isMaster = roles.includes("master");
    const isAdmin = roles.includes("admin") || isMaster;
    const isOperator = roles.includes("operador");
    const isClient = roles.includes("cliente");
    const isSupport = roles.includes("suporte");
    return {
      isAdmin,
      isMaster,
      isOperator,
      isClient,
      isSupport,
      canManageRobots: isAdmin,
      canUpdateCapacity: isAdmin || isOperator,
      canAccessSettings: isAdmin,
      canAccessRobots: isAdmin || isOperator || isClient || isSupport,
      canAccessFlows: isAdmin || isOperator || isClient || isSupport,
      canEditFlows: isAdmin || isClient,
      canCreateFlows: isAdmin,
      canDeleteFlows: isAdmin,
      canManageTutorials: isMaster || permissions.includes("tutorials.manage"),
      clientId,
      displayName,
      roles,
      permissions,
      status,
      error,
    };
  }, [clientId, displayName, error, permissions, roles, status]);
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const context = useContext(AdminAccessContext);
  if (!context) throw new Error("useAdminAccess deve ser usado dentro de AdminAccessProvider.");
  return context;
}
