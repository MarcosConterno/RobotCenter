interface RecoverPasswordPageProps {
  searchParams: Promise<{
    error?: string;
    sent?: string;
  }>;
}

export default async function RecoverPasswordPage({ searchParams }: RecoverPasswordPageProps) {
  const { error, sent } = await searchParams;

  return (
    <main style={pageStyle}>
      <section style={cardStyle} aria-labelledby="recover-title">
        <div style={brandStyle}>ROBOT CENTER</div>
        <h1 id="recover-title" style={titleStyle}>Recuperar acesso</h1>
        <p style={subtitleStyle}>
          Informe seu email para receber o link de redefinição de senha.
        </p>

        {sent ? (
          <div style={successStyle} role="status">
            Se o email estiver cadastrado, você receberá as instruções de recuperação.
          </div>
        ) : (
          <form action="/auth/recover" method="post" style={formStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                placeholder="nome@empresa.com"
                style={inputStyle}
              />
            </label>

            {error && <p role="alert" style={errorStyle}>{error}</p>}

            <button type="submit" style={buttonStyle}>Enviar link</button>
          </form>
        )}

        <a href="/login" style={backLinkStyle}>Voltar para o login</a>
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

const brandStyle: React.CSSProperties = {
  color: "#A78BFA",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.14em",
};

const titleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "var(--text-strong)",
  fontSize: 28,
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.5,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
  marginTop: 28,
};

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

const successStyle: React.CSSProperties = {
  marginTop: 24,
  border: "1px solid rgba(34, 197, 94, 0.35)",
  borderRadius: 8,
  padding: 14,
  background: "rgba(34, 197, 94, 0.1)",
  color: "#86EFAC",
  fontSize: 13,
  lineHeight: 1.5,
};

const errorStyle: React.CSSProperties = { margin: 0, color: "#FCA5A5", fontSize: 13 };

const backLinkStyle: React.CSSProperties = {
  display: "block",
  marginTop: 22,
  color: "#C4B5FD",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "center",
  textDecoration: "none",
};
