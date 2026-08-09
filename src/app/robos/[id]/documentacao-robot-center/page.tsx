import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";

import AppShell from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";

function extractRoleCodes(roleRelation: unknown) {
  if (Array.isArray(roleRelation)) {
    return roleRelation.flatMap((role) => (
      typeof role === "object" && role !== null && "codigo" in role && typeof role.codigo === "string"
        ? [role.codigo]
        : []
    ));
  }
  return typeof roleRelation === "object"
    && roleRelation !== null
    && "codigo" in roleRelation
    && typeof roleRelation.codigo === "string"
    ? [roleRelation.codigo]
    : [];
}

export default async function RobotCenterDocumentationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <AccessDenied />;

  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("roles(codigo)")
    .eq("user_id", user.id);
  const roles = [...new Set(userRoles?.flatMap((item) => extractRoleCodes(item.roles)) ?? [])];
  if (!roles.includes("admin")) return <AccessDenied />;

  const [{ data: robot }, { data: documentation }] = await Promise.all([
    supabase.from("robos").select("id,nome").eq("id", id).is("deleted_at", null).single(),
    supabase.from("robot_center_documentations")
      .select("id,status,updated_at,robot_center_documentation_drafts(revision)")
      .eq("robo_id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!robot) return <AccessDenied message="Robô não encontrado ou não autorizado." />;

  const draftRelation = documentation?.robot_center_documentation_drafts;
  const draft = Array.isArray(draftRelation) ? draftRelation[0] : draftRelation;

  return (
    <AppShell title="Documentação Robot Center">
      <main style={pageStyle}>
        <Link href="/robos" style={backLinkStyle}><ArrowLeft size={15} /> Robôs</Link>
        <header style={headerStyle}>
          <div style={iconStyle}><FileText size={22} /></div>
          <div>
            <div style={eyebrowStyle}>DOCUMENTAÇÃO ROBOT CENTER</div>
            <h1 style={titleStyle}>{robot.nome}</h1>
            <p style={subtitleStyle}>Base interna independente da Documentação Upada.</p>
          </div>
        </header>
        <section style={cardStyle}>
          <strong style={cardTitleStyle}>{documentation ? "Estrutura preparada" : "Documentação ainda não iniciada"}</strong>
          <p style={cardTextStyle}>
            {documentation
              ? `Status: ${documentation.status}. Revisão do rascunho: ${draft?.revision ?? 0}.`
              : "O banco já está preparado para documento, rascunho e versões imutáveis. O editor e a publicação serão adicionados em uma próxima etapa."}
          </p>
        </section>
      </main>
    </AppShell>
  );
}

function AccessDenied({ message = "Acesso negado. Somente Admin pode editar a Documentação Robot Center." }: { message?: string }) {
  return <AppShell title="Documentação Robot Center"><div style={deniedStyle}>{message}</div></AppShell>;
}

const pageStyle = { display: "grid", gap: 18, padding: "22px clamp(18px, 3vw, 36px) 36px" } as const;
const backLinkStyle = { width: "fit-content", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12, textDecoration: "none" } as const;
const headerStyle = { display: "flex", alignItems: "center", gap: 14 } as const;
const iconStyle = { width: 44, height: 44, display: "grid", placeItems: "center", border: "1px solid var(--border)", borderRadius: 12, color: "var(--accent)", background: "var(--accent-soft)" } as const;
const eyebrowStyle = { color: "var(--accent)", fontSize: 10, fontWeight: 800, letterSpacing: ".12em" } as const;
const titleStyle = { margin: "4px 0 0", color: "var(--text-strong)", fontSize: 25 } as const;
const subtitleStyle = { margin: "5px 0 0", color: "var(--muted)", fontSize: 12.5 } as const;
const cardStyle = { maxWidth: 720, padding: 18, border: "1px solid var(--border)", borderRadius: 12, background: "var(--card)" } as const;
const cardTitleStyle = { color: "var(--text-strong)", fontSize: 13 } as const;
const cardTextStyle = { margin: "8px 0 0", color: "var(--muted)", fontSize: 12, lineHeight: 1.6 } as const;
const deniedStyle = { margin: 24, padding: 18, border: "1px solid var(--danger)", borderRadius: 12, color: "var(--danger)", background: "var(--card)" } as const;
