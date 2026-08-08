import ThemeToggle from "@/components/theme/ThemeToggle";
import Image from "next/image";

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    message?: string;
    redirectTo?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;

  return (
    <main style={pageStyle}>
      <ThemeToggle floating />
      <Image
        src="/images/robot-center-system-logo-transparent.png"
        alt="Logo do Robot Center"
        width={230}
        height={230}
        priority
        style={logoStyle}
      />
      <section style={cardStyle} aria-labelledby="login-title">
        <div style={contentStyle}>
          <div style={brandStyle}>ROBOT CENTER</div>
          <h1 id="login-title" style={titleStyle}>Bem-vindo</h1>
          <p style={subtitleStyle}>Entre com seu email e senha.</p>

          <form action="/auth/login" method="post" style={formStyle}>
          <input type="hidden" name="redirectTo" value="/dashboard" />

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
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
  alignItems: "center",
  justifyContent: "center",
  gap: 18,
  padding: 24,
  background: "var(--bg)",
};

const logoStyle: React.CSSProperties = {
  width: 230,
  height: 230,
  objectFit: "contain",
  filter: "drop-shadow(0 16px 32px rgba(0, 119, 255, 0.22))",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 430,
  border: "1px solid var(--border)",
  borderRadius: 14,
  overflow: "hidden",
  background: "var(--card)",
  boxShadow: "var(--shadow)",
};

const contentStyle: React.CSSProperties = {
  padding: 30,
};

const brandStyle: React.CSSProperties = {
  color: "var(--accent)",
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
  color: "var(--text-2)",
  fontSize: 12,
  fontWeight: 600,
};

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
  background: "var(--accent)",
  color: "var(--on-accent)",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--danger)",
  fontSize: 13,
};

const successStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--success)",
  fontSize: 13,
};

const forgotPasswordStyle: React.CSSProperties = {
  justifySelf: "end",
  marginTop: -8,
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};
