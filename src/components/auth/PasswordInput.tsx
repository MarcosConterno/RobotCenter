"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type CSSProperties } from "react";

interface PasswordInputProps {
  inputStyle: CSSProperties;
}

export default function PasswordInput({ inputStyle }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={wrapperStyle}>
      <input
        name="password"
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        required
        minLength={6}
        placeholder="Digite sua senha"
        style={{ ...inputStyle, paddingRight: 44 }}
      />
      <button
        type="button"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        title={visible ? "Ocultar senha" : "Mostrar senha"}
        style={toggleStyle}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

const wrapperStyle: CSSProperties = {
  position: "relative",
};

const toggleStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: 12,
  display: "inline-flex",
  width: 28,
  height: 28,
  alignItems: "center",
  justifyContent: "center",
  transform: "translateY(-50%)",
  border: 0,
  padding: 0,
  color: "var(--muted)",
  background: "transparent",
  cursor: "pointer",
};
