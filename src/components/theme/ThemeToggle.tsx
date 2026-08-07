"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Ativar tema claro" : "Ativar tema escuro";

  return (
    <button
      type="button"
      className={`theme-toggle${floating ? " theme-toggle--floating" : ""}`}
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
      <span className="sr-only">{label}</span>
    </button>
  );
}
