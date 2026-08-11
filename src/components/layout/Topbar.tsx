"use client";

import { BookOpen, ChevronDown, KeyRound, LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme/ThemeToggle";

interface TopbarProps { title: string; bare?: boolean; }

const ROLE_LABELS: Record<string, string> = {
  master: "Master",
  admin: "Admin",
  head_setor: "Head Setor",
  operador: "Operador",
  dev: "Dev",
  cliente: "Cliente",
  suporte: "Suporte",
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "US";
}

export default function Topbar({ title, bare = false }: TopbarProps) {
  const router = useRouter();
  const { displayName, roles, status } = useAdminAccess();
  const roleName = roles.includes("master")
    ? ROLE_LABELS.master
    : ROLE_LABELS[roles[0] ?? ""] ?? "";
  const accountReady = status === "ready" && Boolean(displayName);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  async function logout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: "local" });
    window.location.assign("/login");
  }

  function openPasswordDialog() {
    setUserMenuOpen(false);
    setNewPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordDialogOpen(true);
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve possuir pelo menos 6 caracteres.");
      return;
    }

    setUpdatingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);

    if (error) {
      setPasswordError(error.message || "Não foi possível atualizar a senha.");
      return;
    }

    setNewPassword("");
    setPasswordSuccess("Senha atualizada com sucesso.");
  }

  return (
    <header className={`app-topbar${bare ? " is-bare" : ""}`}>
      <h1 className="sr-only">{title}</h1>

      <div className="topbar-actions">
        <ThemeToggle />

        <div className="topbar-divider" />
        <div className="topbar-user-menu">
          <button
            type="button"
            className={`topbar-user${accountReady ? "" : " is-loading"}`}
            aria-label={accountReady ? `Abrir opções da conta de ${displayName}` : "Carregando dados da conta"}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            disabled={!accountReady}
            onClick={() => setUserMenuOpen((current) => !current)}
          >
            <span className="topbar-avatar">{accountReady ? getInitials(displayName) : ""}</span>
            <span className="topbar-user-copy">
              <strong>{accountReady ? displayName : "\u00a0"}</strong>
              <small>{accountReady ? roleName : "\u00a0"}</small>
            </span>
            <ChevronDown className={userMenuOpen ? "is-open" : undefined} size={15} aria-hidden="true" />
          </button>

          {userMenuOpen && (
            <div className="topbar-user-dropdown" role="menu">
              {roleName === "Master" && <button type="button" role="menuitem" onClick={() => { setUserMenuOpen(false); router.push("/documentacao"); }}>
                <BookOpen size={15} /> Documentação
              </button>}
              <button type="button" role="menuitem" onClick={openPasswordDialog}>
                <KeyRound size={15} /> Trocar senha
              </button>
              <button type="button" role="menuitem" className="is-danger" onClick={() => void logout()}>
                <LogOut size={15} /> Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {passwordDialogOpen && (
        <div className="password-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPasswordDialogOpen(false);
        }}>
          <section className="password-dialog" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title">
            <header>
              <div>
                <span>Segurança da conta</span>
                <h2 id="password-dialog-title">Nova senha</h2>
              </div>
              <button type="button" aria-label="Fechar alteração de senha" onClick={() => setPasswordDialogOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={updatePassword}>
              <label>
                <span>Nova senha</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setPasswordError("");
                    setPasswordSuccess("");
                  }}
                  placeholder="Digite a nova senha"
                  autoFocus
                  required
                />
              </label>
              {passwordError && <p className="password-dialog__error" role="alert">{passwordError}</p>}
              {passwordSuccess && <p className="password-dialog__success" role="status">{passwordSuccess}</p>}
              <footer>
                <button type="button" className="is-secondary" onClick={() => setPasswordDialogOpen(false)}>Cancelar</button>
                <button type="submit" disabled={updatingPassword}>{updatingPassword ? "Atualizando..." : "Atualizar senha"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </header>
  );
}
