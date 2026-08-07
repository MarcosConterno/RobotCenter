"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AccessStatus = "loading" | "ready";

interface AdminAccessContextValue {
  isAdmin: boolean;
  status: AccessStatus;
  error: string;
}

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/access", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { allowed?: boolean; error?: string };
        if (!active) return;
        setIsAdmin(response.ok && payload.allowed === true);
        setError(response.status === 401 || response.status === 403 ? "" : payload.error ?? "");
      })
      .catch(() => {
        if (active) setError("Não foi possível validar as permissões da sessão.");
      })
      .finally(() => {
        if (active) setStatus("ready");
      });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({ isAdmin, status, error }), [error, isAdmin, status]);
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const context = useContext(AdminAccessContext);
  if (!context) throw new Error("useAdminAccess deve ser usado dentro de AdminAccessProvider.");
  return context;
}
