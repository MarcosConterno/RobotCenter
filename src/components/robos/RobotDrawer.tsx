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
  background: "rgba(2, 6, 23, 0.72)",
};

const modalStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflow: "hidden",
  border: "1px solid #273449",
  borderRadius: 16,
  background: "#111B2B",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "16px 20px",
  borderBottom: "1px solid #273449",
  background: "linear-gradient(135deg, rgba(124,58,237,.1), rgba(79,70,229,.025))",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#FFF",
  fontSize: 19,
  lineHeight: 1.2,
};

const eyebrowStyle: React.CSSProperties = {
  color: "#8B9CB3",
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
  color: "#A78BFA",
  background: "rgba(124,58,237,.14)",
  border: "1px solid rgba(167,139,250,.2)",
};

const closeButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  width: 36,
  height: 36,
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "rgba(15,23,42,.65)",
  color: "#FFF",
  cursor: "pointer",
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: 20,
};
