interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    message?: string;
    redirectTo?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message, redirectTo = "/robos" } = await searchParams;

  return (
    <main style={pageStyle}>
      <section style={cardStyle} aria-labelledby="login-title">
        <div style={brandStyle}>ROBOT CENTER</div>
        <h1 id="login-title" style={titleStyle}>Acessar o sistema</h1>
        <p style={subtitleStyle}>Entre com seu email e senha.</p>

        <form action="/auth/login" method="post" style={formStyle}>
          <input type="hidden" name="redirectTo" value={redirectTo} />

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

          <label style={fieldStyle}>
            <span style={labelStyle}>Senha</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              placeholder="Digite sua senha"
              style={inputStyle}
            />
          </label>

          <a href="/recuperar-senha" style={forgotPasswordStyle}>
            Esqueci minha senha
          </a>

          {error && <p role="alert" style={errorStyle}>{error}</p>}
          {message && <p role="status" style={successStyle}>{message}</p>}

          <button type="submit" style={buttonStyle}>Entrar</button>
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
  background: "#0F172A",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  border: "1px solid #273449",
  borderRadius: 14,
  padding: 32,
  background: "#111827",
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
  color: "#F8FAFC",
  fontSize: 28,
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#94A3B8",
  fontSize: 14,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
  marginTop: 28,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
};

const labelStyle: React.CSSProperties = {
  color: "#CBD5E1",
  fontSize: 12,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  boxSizing: "border-box",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "0 12px",
  outline: "none",
  background: "#162130",
  color: "#FFF",
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

const errorStyle: React.CSSProperties = {
  margin: 0,
  color: "#FCA5A5",
  fontSize: 13,
};

const successStyle: React.CSSProperties = {
  margin: 0,
  color: "#86EFAC",
  fontSize: 13,
};

const forgotPasswordStyle: React.CSSProperties = {
  justifySelf: "end",
  marginTop: -8,
  color: "#C4B5FD",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};
