"use client";

import { BookOpen, Boxes, Building2, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAdminAccess } from "@/auth/AdminAccessProvider";

export type SettingsSection = "usuarios" | "clientes" | "cadastros" | "permissoes" | "tutoriais";

interface SettingsNavigationProps {
  active: SettingsSection;
  onSelect?: (section: "usuarios" | "clientes" | "cadastros" | "permissoes") => void;
}

export default function SettingsNavigation({ active, onSelect }: SettingsNavigationProps) {
  const router = useRouter();
  const { isAdmin, canManageTutorials } = useAdminAccess();

  function navigate(section: SettingsSection) {
    if (section === "tutoriais") {
      router.push("/configuracoes/tutoriais");
      return;
    }
    if (onSelect) onSelect(section);
    else router.push(`/configuracoes?aba=${section}`);
  }

  const items = [
    { id: "usuarios" as const, label: "Usuários", icon: Users, visible: true },
    { id: "clientes" as const, label: "Clientes", icon: Building2, visible: true },
    { id: "cadastros" as const, label: "Cadastros", icon: Boxes, visible: isAdmin },
    { id: "permissoes" as const, label: "Perfis e Permissões", icon: ShieldCheck, visible: isAdmin },
    { id: "tutoriais" as const, label: "Tutoriais", icon: BookOpen, visible: canManageTutorials },
  ].filter((item) => item.visible);

  return <nav className="settings-navigation" aria-label="Seções de Configurações" data-tour="settings-navigation">
    {items.map((item) => {
      const Icon = item.icon;
      return <button key={item.id} type="button" aria-current={active === item.id ? "page" : undefined} className={active === item.id ? "is-active" : undefined} onClick={() => navigate(item.id)}><Icon size={17} />{item.label}</button>;
    })}
  </nav>;
}
