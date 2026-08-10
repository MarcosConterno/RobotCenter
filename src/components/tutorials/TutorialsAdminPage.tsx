"use client";

import { BookOpen, Clock3, PauseCircle, Pencil, Play, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import SettingsNavigation from "@/components/settings/SettingsNavigation";

interface RoleOption { id: string; codigo: string; nome: string }
interface TutorialItem { id: string; name: string; audienceRoleName: string; status: string; currentVersion: number | null; stepCount: number; updatedAt: string }

export default function TutorialsAdminPage() {
  const router = useRouter(); const [items, setItems] = useState<TutorialItem[]>([]); const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [creating, setCreating] = useState(false);
  const [name, setName] = useState(""); const [audienceRoleId, setAudienceRoleId] = useState(""); const [saving, setSaving] = useState(false);

  useEffect(() => { void fetch("/api/admin/tutorials", { cache: "no-store" }).then(async (response) => {
    const payload = await response.json() as { tutorials?: TutorialItem[]; roles?: RoleOption[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os tutoriais."); setItems(payload.tutorials ?? []); setRoles(payload.roles ?? []); setAudienceRoleId(payload.roles?.[0]?.id ?? "");
  }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os tutoriais.")).finally(() => setLoading(false)); }, []);

  async function createTutorial(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { const response = await fetch("/api/admin/tutorials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, audienceRoleId }) }); const payload = await response.json() as { id?: string; error?: string }; if (!response.ok || !payload.id) throw new Error(payload.error ?? "Não foi possível criar."); router.push(`/configuracoes/tutoriais/${payload.id}`); }
    catch (createError) { setError(createError instanceof Error ? createError.message : "Não foi possível criar o tutorial."); setSaving(false); }
  }
  async function toggleStatus(item: TutorialItem) {
    const status = item.status === "inactive" ? "published" : "inactive"; setError("");
    const response = await fetch(`/api/admin/tutorials/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setError(payload.error ?? "Não foi possível alterar o estado."); return; }
    setItems((current) => current.map((tutorial) => tutorial.id === item.id ? { ...tutorial, status } : tutorial));
  }

  return <AppShell title="Tutoriais">
    <section className="tutorial-admin-page">
      <header className="tutorial-admin-heading"><div><span>TUTORIAIS</span><h1>Administração dos tutoriais</h1><p>Crie, teste e publique orientações para cada perfil do Robot Center.</p></div><button className="tutorial-primary-button" onClick={() => setCreating(true)}><Plus size={15} /> Novo tutorial</button></header>
      <SettingsNavigation active="tutoriais" />
      {creating && <form className="tutorial-create-panel" onSubmit={createTutorial}><label>Nome<input required minLength={3} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Tutorial de Administrador" /></label><label>Público<select required value={audienceRoleId} onChange={(event) => setAudienceRoleId(event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.nome}</option>)}</select></label><button className="tutorial-primary-button" disabled={saving}>{saving ? "Criando..." : "Criar tutorial"}</button><button type="button" className="tutorial-secondary-button" onClick={() => setCreating(false)}><X size={14} /> Cancelar</button></form>}
      {error && <div className="tutorial-message is-error">{error}</div>}
      {loading ? <div className="tutorial-message">Carregando tutoriais...</div> : items.length === 0 ? <div className="tutorial-empty"><BookOpen size={25} /><strong>Nenhum tutorial administrativo</strong><span>O onboarding atual continuará usando a configuração da Fase 1 até a primeira publicação.</span></div> : <div className="tutorial-list">{items.map((item) => <article className="tutorial-list-card" key={item.id}><div className="tutorial-list-icon"><BookOpen size={18} /></div><div className="tutorial-list-copy"><div><span className="tutorial-audience">{item.audienceRoleName}</span><h2>{item.name}</h2></div><p><Clock3 size={12} /> Atualizado em {new Date(item.updatedAt).toLocaleString("pt-BR")}</p></div><div className="tutorial-list-facts"><span><strong>{item.stepCount}</strong> passos</span><span><strong>{item.currentVersion ? `v${item.currentVersion}` : "—"}</strong> versão</span><span className={`tutorial-status is-${item.status}`}>{item.status === "published" ? "Publicado" : item.status === "inactive" ? "Inativo" : "Rascunho"}</span></div><div className="tutorial-list-actions"><button onClick={() => router.push(`/configuracoes/tutoriais/${item.id}`)}><Pencil size={14} /> Editar</button><button onClick={() => router.push(`/configuracoes/tutoriais/${item.id}?testar=1`)}><Play size={14} /> Testar</button>{item.currentVersion && <button onClick={() => void toggleStatus(item)}>{item.status === "inactive" ? <Play size={14} /> : <PauseCircle size={14} />} {item.status === "inactive" ? "Ativar" : "Inativar"}</button>}</div></article>)}</div>}
    </section>
  </AppShell>;
}
