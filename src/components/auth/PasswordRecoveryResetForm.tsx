"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type ApiResult = {
  data?: { message?: string } | null;
  error?: { message?: string } | null;
};

export default function PasswordRecoveryResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/session/recover/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirmation }),
      });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error?.message ?? "Não foi possível atualizar a senha.");

      setMessage(result.data?.message ?? "Senha atualizada. Entre novamente.");
      setPassword("");
      setPasswordConfirmation("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível atualizar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle} aria-labelledby="reset-title">
        <div style={contentStyle}>
          <div style={brandStyle}>ROBOT CENTER</div>
          <h1 id="reset-title" style={titleStyle}>Definir nova senha</h1>
          <p style={subtitleStyle}>Escolha uma senha com pelo menos 8 caracteres.</p>

          {!token ? (
            <p role="alert" style={errorStyle}>O link está incompleto. Solicite uma nova recuperação.</p>
          ) : message ? (
            <>
              <p role="status" style={successStyle}>{message}</p>
              <Link href="/login" style={backLinkStyle}>Ir para o login</Link>
            </>
          ) : (
            <form onSubmit={submit} style={formStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Nova senha</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Confirme a nova senha</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  style={inputStyle}
                />
              </label>
              {error && <p role="alert" style={errorStyle}>{error}</p>}
              <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.65 : 1 }}>
                {loading ? "Salvando…" : "Atualizar senha"}
              </button>
            </form>
          )}

          {!message && <Link href="/recuperar-senha" style={backLinkStyle}>Solicitar outro link</Link>}
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center",
  padding: 24, background: "var(--bg)",
};
const cardStyle: React.CSSProperties = {
  width: "100%", maxWidth: 430, border: "1px solid var(--border)", borderRadius: 14,
  overflow: "hidden", background: "var(--card)", boxShadow: "var(--shadow)",
};
const contentStyle: React.CSSProperties = { padding: 30 };
const brandStyle: React.CSSProperties = { color: "var(--accent)", fontSize: 12, fontWeight: 800, letterSpacing: "0.14em" };
const titleStyle: React.CSSProperties = { margin: "10px 0 0", color: "var(--text-strong)", fontSize: 28 };
const subtitleStyle: React.CSSProperties = { margin: "8px 0 0", color: "var(--muted)", fontSize: 14, lineHeight: 1.5 };
const formStyle: React.CSSProperties = { display: "grid", gap: 16, marginTop: 28 };
const fieldStyle: React.CSSProperties = { display: "grid", gap: 7 };
const labelStyle: React.CSSProperties = { color: "var(--text-2)", fontSize: 12, fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: "100%", height: 44, boxSizing: "border-box", border: "1px solid var(--border)",
  borderRadius: 8, padding: "0 12px", outline: "none", background: "var(--surface)", color: "var(--text)", fontSize: 14,
};
const buttonStyle: React.CSSProperties = {
  minHeight: 44, border: 0, borderRadius: 8, background: "var(--accent)", color: "var(--on-accent)",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
};
const errorStyle: React.CSSProperties = { margin: 0, color: "var(--danger)", fontSize: 13, lineHeight: 1.5 };
const successStyle: React.CSSProperties = { margin: "20px 0 0", color: "var(--success)", fontSize: 13, lineHeight: 1.5 };
const backLinkStyle: React.CSSProperties = {
  display: "block", marginTop: 20, textAlign: "center", color: "var(--accent)", fontSize: 13,
  fontWeight: 600, textDecoration: "none",
};
