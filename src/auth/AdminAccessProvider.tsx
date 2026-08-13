"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { TipoProdutoRobo } from "@/domain/entities";

type AccessStatus = "loading" | "ready";

interface AdminAccessContextValue {
  userId: string | null;
  isAdmin: boolean;
  isMaster: boolean;
  isOperator: boolean;
  isHeadSector: boolean;
  isClient: boolean;
  isSupport: boolean;
  canManageRobots: boolean;
  canDuplicateRobots: boolean;
  canEditClientRobots: boolean;
  canUpdateCapacity: boolean;
  canAccessSettings: boolean;
  canAccessRobots: boolean;
  canAccessRobotProduct: (productType: TipoProdutoRobo) => boolean;
  canAccessFlows: boolean;
  canEditFlows: boolean;
  canCreateFlows: boolean;
  canDeleteFlows: boolean;
  canAccessBudgets: boolean;
  canManageBudgetDictionary: boolean;
  canViewStackRequests: boolean;
  canCreateStackRequests: boolean;
  canManageStackRequests: boolean;
  clientId: string | null;
  displayName: string;
  roles: string[];
  permissions: string[];
  canManageTutorials: boolean;
  status: AccessStatus;
  error: string;
}

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

const PUBLIC_PATHS = new Set([
  "/login",
  "/recuperar-senha",
  "/redefinir-senha",
]);

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [canEditClientRobots, setCanEditClientRobots] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isPublicPath) {
      setRoles([]);
      setPermissions([]);
      setClientId(null);
      setCanEditClientRobots(false);
      setDisplayName("");
      setUserId(null);
      setError("");
      setStatus("ready");
      return;
    }

    let active = true;
    setStatus("loading");
    void fetch("/api/admin/access", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { userId?: string; roles?: string[]; permissions?: string[]; isMaster?: boolean; clientId?: string | null; canEditClientRobots?: boolean; displayName?: string; error?: string };
        if (!active) return;
        if (response.status === 401) {
          const redirectTo = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
          return;
        }
        setRoles(response.ok && Array.isArray(payload.roles) ? payload.roles : []);
        setPermissions(response.ok && Array.isArray(payload.permissions) ? payload.permissions : []);
        setClientId(response.ok ? payload.clientId ?? null : null);
        setCanEditClientRobots(response.ok && payload.canEditClientRobots === true);
        setDisplayName(response.ok ? payload.displayName ?? "" : "");
        setUserId(response.ok ? payload.userId ?? null : null);
        setError(response.status === 401 ? "" : payload.error ?? "");
      })
      .catch(() => {
        if (active) setError("Não foi possível validar as permissões da sessão.");
      })
      .finally(() => {
        if (active) setStatus("ready");
      });
    return () => { active = false; };
  }, [isPublicPath]);

  const value = useMemo(() => {
    const isMaster = roles.includes("master");
    const isAdmin = roles.includes("admin") || isMaster;
    const isOperator = roles.includes("operador");
    const isHeadSector = roles.includes("head_setor");
    const isClient = roles.includes("cliente");
    const isSupport = roles.includes("suporte");
    return {
      userId,
      isAdmin,
      isMaster,
      isOperator,
      isHeadSector,
      isClient,
      isSupport,
      canManageRobots: permissions.some((permission) => ["robots.create", "robots.update", "robots.archive"].includes(permission)),
      canDuplicateRobots: isMaster || (roles.includes("admin") && permissions.includes("robots.duplicate")),
      canEditClientRobots,
      canUpdateCapacity: permissions.includes("robots.capacity.update"),
      canAccessSettings: permissions.some((permission) => permission === "settings.read" || permission === "access_control.read" || permission.startsWith("users.") || permission.startsWith("clients.") || permission.startsWith("robot_catalog.")),
      canAccessRobots: permissions.includes("robots.read"),
      canAccessRobotProduct: (productType: TipoProdutoRobo) => permissions.includes(`robots.product.${({ INTEGRADOR: "integrador", CONSULTA_PROCESSUAL: "consulta_processual", PETICIONAMENTO: "peticionamento", MOVIMENTO: "movimento" } as const)[productType]}.read`),
      canAccessFlows: permissions.includes("flows.read"),
      canEditFlows: permissions.includes("flows.update"),
      canCreateFlows: permissions.includes("flows.create"),
      canDeleteFlows: permissions.includes("flows.delete"),
      canAccessBudgets: isAdmin,
      canManageBudgetDictionary: isAdmin,
      canViewStackRequests: permissions.includes("stack_requests.read"),
      canCreateStackRequests: permissions.includes("stack_requests.create"),
      canManageStackRequests: permissions.some((permission) => ["stack_requests.update", "stack_requests.status", "stack_requests.complete", "stack_requests.cancel", "stack_requests.request_info"].includes(permission)),
      canManageTutorials: isMaster || permissions.includes("tutorials.manage"),
      clientId,
      displayName,
      roles,
      permissions,
      status,
      error,
    };
  }, [canEditClientRobots, clientId, displayName, error, permissions, roles, status, userId]);
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const context = useContext(AdminAccessContext);
  if (!context) throw new Error("useAdminAccess deve ser usado dentro de AdminAccessProvider.");
  return context;
}
