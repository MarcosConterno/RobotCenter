"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";

type ApiResult = {
  data?: { message?: string; developmentResetUrl?: string | null } | null;
  error?: { message?: string } | null;
};

export default function PasswordRecoveryRequestForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [developmentResetUrl, setDevelopmentResetUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setDevelopmentResetUrl(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/session/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error?.message ?? "Não foi possível preparar a recuperação.");

      setMessage(result.data?.message ?? "Se a conta estiver cadastrada, siga as instruções de recuperação.");
      setDevelopmentResetUrl(result.data?.developmentResetUrl ?? null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível preparar a recuperação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <Image
        src="/images/robot-center-system-logo-transparent.png"
        alt="Logo do Robot Center"
        width={180}
        height={180}
        priority
        style={logoStyle}
      />
      <section style={cardStyle} aria-labelledby="recovery-title">
        <div style={contentStyle}>
          <div style={brandStyle}>ROBOT CENTER</div>
          <h1 id="recovery-title" style={titleStyle}>Recuperar senha</h1>
          <p style={subtitleStyle}>Informe o email cadastrado para preparar a redefinição da senha.</p>

          <form onSubmit={submit} style={formStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                maxLength={320}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@empresa.com"
                style={inputStyle}
              />
            </label>

            {error && <p role="alert" style={errorStyle}>{error}</p>}
            {message && <p role="status" style={successStyle}>{message}</p>}
            {developmentResetUrl && <a href={developmentResetUrl} style={resetLinkStyle}>Abrir link local de redefinição</a>}

            <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.65 : 1 }}>
              {loading ? "Preparando…" : "Preparar recuperação"}
            </button>
          </form>

          <Link href="/login" style={backLinkStyle}>Voltar ao login</Link>
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", minHeight: "100vh", alignItems: "center",
  justifyContent: "center", gap: 18, padding: 24, background: "var(--bg)",
};
const logoStyle: React.CSSProperties = {
  width: 180, height: 180, objectFit: "contain", filter: "drop-shadow(0 16px 32px rgba(0, 119, 255, 0.22))",
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
const errorStyle: React.CSSProperties = { margin: 0, color: "var(--danger)", fontSize: 13 };
const successStyle: React.CSSProperties = { margin: 0, color: "var(--success)", fontSize: 13, lineHeight: 1.5 };
const resetLinkStyle: React.CSSProperties = { color: "var(--accent)", fontSize: 13, fontWeight: 700, textDecoration: "none" };
const backLinkStyle: React.CSSProperties = {
  display: "block", marginTop: 20, textAlign: "center", color: "var(--accent)", fontSize: 13,
  fontWeight: 600, textDecoration: "none",
};
