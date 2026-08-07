"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme/ThemeToggle";

interface TopbarProps { title: string; }

function getRoleName(roleRelation: unknown) {
  if (Array.isArray(roleRelation)) {
    const firstRole = roleRelation[0];
    return typeof firstRole === "object" && firstRole && "nome" in firstRole
      ? String(firstRole.nome)
      : null;
  }

  return typeof roleRelation === "object" && roleRelation && "nome" in roleRelation
    ? String(roleRelation.nome)
    : null;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "US";
}

export default function Topbar({ title }: TopbarProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Usuário");
  const [roleName, setRoleName] = useState("Usuário");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadAuthenticatedUser() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user || !active) return;

      const [{ data: profile }, { data: userRoles }] = await Promise.all([
        supabase.from("profiles").select("login").eq("id", user.id).maybeSingle(),
        supabase
          .from("user_roles")
          .select("roles(nome)")
          .eq("user_id", user.id)
          .limit(1),
      ]);

      if (!active) return;

      setDisplayName(profile?.login || user.email || "Usuário");
      setRoleName(getRoleName(userRoles?.[0]?.roles) || "Usuário");
    }

    void loadAuthenticatedUser();

    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="app-topbar">
      <div>
        <div className="topbar-context">ROBOT CENTER</div>
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-actions">
        <label className="topbar-search">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input type="text" placeholder="Pesquisar no sistema" aria-label="Pesquisar no sistema" />
          <span>⌘ K</span>
        </label>

        <ThemeToggle />

        <div className="topbar-divider" />
        <button
          type="button"
          className="topbar-user"
          title="Sair do sistema"
          aria-label={`Sair da conta de ${displayName}`}
          onClick={logout}
          style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer", textAlign: "left" }}
        >
          <span className="topbar-avatar">{getInitials(displayName)}</span>
          <span className="topbar-user-copy">
            <strong>{displayName}</strong>
            <small>{roleName}</small>
          </span>
        </button>
      </div>
    </header>
  );
}
