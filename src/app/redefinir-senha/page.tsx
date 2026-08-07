interface ResetPasswordPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { error } = await searchParams;

  return (
    <main style={pageStyle}>
      <section style={cardStyle} aria-labelledby="reset-title">
        <div style={brandStyle}>ROBOT CENTER</div>
        <h1 id="reset-title" style={titleStyle}>Criar nova senha</h1>
        <p style={subtitleStyle}>Defina uma nova senha para sua conta.</p>

        <form action="/auth/update-password" method="post" style={formStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Nova senha</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Confirmar nova senha</span>
            <input
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              style={inputStyle}
            />
          </label>

          {error && <p role="alert" style={errorStyle}>{error}</p>}

          <button type="submit" style={buttonStyle}>Salvar nova senha</button>
        </form>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  minHeight: "100vh",
  placeItems: "center",
  padding: 24,
  background: "var(--bg)",
};
const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  boxSizing: "border-box",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 32,
  background: "var(--card)",
  boxShadow: "0 20px 50px rgba(2, 6, 23, 0.35)",
};
const brandStyle: React.CSSProperties = { color: "#A78BFA", fontSize: 12, fontWeight: 800, letterSpacing: "0.14em" };
const titleStyle: React.CSSProperties = { margin: "10px 0 0", color: "var(--text-strong)", fontSize: 28 };
const subtitleStyle: React.CSSProperties = { margin: "8px 0 0", color: "var(--muted)", fontSize: 14 };
const formStyle: React.CSSProperties = { display: "grid", gap: 18, marginTop: 28 };
const fieldStyle: React.CSSProperties = { display: "grid", gap: 7 };
const labelStyle: React.CSSProperties = { color: "var(--text-2)", fontSize: 12, fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  boxSizing: "border-box",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0 12px",
  outline: "none",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
};
const buttonStyle: React.CSSProperties = {
  minHeight: 44,
  border: 0,
  borderRadius: 8,
  background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
  color: "#FFF",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
const errorStyle: React.CSSProperties = { margin: 0, color: "#FCA5A5", fontSize: 13 };
