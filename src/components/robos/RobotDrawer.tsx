import { Bot, X } from "lucide-react";

interface RobotDrawerProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function RobotDrawer({
  open,
  title = "Modal",
  onClose,
  children,
}: RobotDrawerProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={overlayStyle}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        style={modalStyle}
      >
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span style={headerIconStyle}><Bot size={19} /></span>
            <div>
              <div style={eyebrowStyle}>ROBÔ INTEGRADOR</div>
              <h2 style={titleStyle}>{title}</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            style={closeButtonStyle}
          >
            <X size={18} />
          </button>
        </header>

        <div style={contentStyle}>{children}</div>
      </section>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "var(--overlay)",
};

const modalStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflow: "hidden",
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "var(--card)",
  boxShadow: "var(--shadow)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "16px 20px",
  borderBottom: "1px solid var(--separator)",
  background: "var(--surface)",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--text-strong)",
  fontSize: 19,
  lineHeight: 1.2,
};

const eyebrowStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 1.2,
  marginBottom: 3,
};

const headerIconStyle: React.CSSProperties = {
  display: "inline-flex",
  width: 38,
  height: 38,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  color: "var(--accent)",
  background: "var(--accent-soft)",
  border: "1px solid var(--accent)",
};

const closeButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  width: 36,
  height: 36,
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--text)",
  cursor: "pointer",
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: 20,
};
