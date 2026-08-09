import { ArrowLeft, Download, ExternalLink, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { formatDocumentationVersion } from "@/domain/robot-center-documentation";
import { createClient } from "@/lib/supabase/server";

function roleCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(roleCodes);
  if (value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string") return [value.codigo];
  return [];
}

export default async function RobotCenterDocumentationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <Denied />;

  const [{ data: userRoles }, { data: robot }, { data: documentation }] = await Promise.all([
    supabase.from("user_roles").select("roles(codigo)").eq("user_id", user.id),
    supabase.from("robos").select("id,nome,sistema").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("robot_center_documentations").select("id,status").eq("robo_id", id).is("deleted_at", null).maybeSingle(),
  ]);
  if (!robot || !documentation) return <Denied message="Documentação não encontrada ou acesso negado." />;
  const isAdmin = [...new Set(userRoles?.flatMap((item) => roleCodes(item.roles)) ?? [])].includes("admin");
  const { data: versions } = await supabase.from("robot_center_documentation_versions")
    .select("id,version,status,published_at,created_at,created_by,docx_path,pdf_path,error_message")
    .eq("documentation_id", documentation.id).order("version", { ascending: false });
  const creatorIds = [...new Set((versions ?? []).map((item) => item.created_by))];
  const { data: creators } = creatorIds.length
    ? await supabase.from("profiles").select("id,nome,email").in("id", creatorIds)
    : { data: [] };

  const items = await Promise.all((versions ?? []).map(async (version) => {
    const [pdfView, pdfDownload, docxDownload] = await Promise.all([
      version.pdf_path ? supabase.storage.from("robot-documentation").createSignedUrl(version.pdf_path, 900) : null,
      version.pdf_path ? supabase.storage.from("robot-documentation").createSignedUrl(version.pdf_path, 900, { download: `${robot.nome}-${formatDocumentationVersion(version.version)}.pdf` }) : null,
      version.docx_path ? supabase.storage.from("robot-documentation").createSignedUrl(version.docx_path, 900, { download: `${robot.nome}-${formatDocumentationVersion(version.version)}.docx` }) : null,
    ]);
    return { ...version, creator: creators?.find((item) => item.id === version.created_by), pdfView: pdfView?.data?.signedUrl, pdfDownload: pdfDownload?.data?.signedUrl, docxDownload: docxDownload?.data?.signedUrl };
  }));
  const currentPublishedId = items.find((item) => item.status === "published")?.id;

  return <AppShell title="Documentação Robot Center"><main style={pageStyle}>
    <div style={breadcrumbStyle}><Link href={`/robos/${id}`}><ArrowLeft size={14} /> Robôs</Link><span>/</span><span>{robot.nome}</span><span>/</span><strong>Histórico</strong></div>
    <header style={headerStyle}><div><span style={eyebrowStyle}>DOCUMENTAÇÃO ROBOT CENTER</span><h1 style={titleStyle}>Histórico de versões</h1><p style={subtitleStyle}>{robot.nome} · {robot.sistema}</p></div>{isAdmin && <Link href={`/robos/${id}/documentacao-robot-center/editar`} style={editStyle}><Pencil size={14} /> Editar documentação</Link>}</header>
    <section style={listStyle}>
      {!items.length && <div style={emptyStyle}>Nenhuma versão publicada.</div>}
      {items.map((version) => <article key={version.id} style={versionCardStyle}>
        <div style={versionIdentityStyle}><span style={iconStyle}><FileText size={18} /></span><div><strong style={versionTitleStyle}>{formatDocumentationVersion(version.version)}{version.id === currentPublishedId ? " · Atual" : ""}</strong><p style={metaStyle}>{version.status === "published" ? `Publicado em ${new Date(version.published_at ?? version.created_at).toLocaleString("pt-BR")}` : version.status === "failed" ? "Falha na geração" : "Geração em andamento"}</p><p style={metaStyle}>Responsável: {version.creator?.nome ?? version.creator?.email ?? "Não informado"}</p>{version.error_message && <p style={errorStyle}>{version.error_message}</p>}</div></div>
        {version.status === "published" && <div style={actionsStyle}>{version.pdfView && <a href={version.pdfView} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Visualizar PDF</a>}{version.pdfDownload && <a href={version.pdfDownload}><Download size={14} /> Baixar PDF</a>}{version.docxDownload && <a href={version.docxDownload}><Download size={14} /> Baixar DOCX</a>}</div>}
      </article>)}
    </section>
  </main></AppShell>;
}

function Denied({ message = "Acesso negado." }: { message?: string }) { return <AppShell title="Documentação Robot Center"><div style={deniedStyle}>{message}</div></AppShell>; }
const pageStyle = { display: "grid", gap: 18, padding: "20px clamp(16px, 2.8vw, 34px) 36px" } as const;
const breadcrumbStyle = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, color: "var(--muted)", fontSize: 11.5 } as const;
const headerStyle = { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 } as const;
const eyebrowStyle = { color: "var(--accent)", fontSize: 9.5, fontWeight: 800, letterSpacing: ".13em" } as const;
const titleStyle = { margin: "5px 0 0", color: "var(--text-strong)", fontSize: 27 } as const;
const subtitleStyle = { margin: "5px 0 0", color: "var(--muted)", fontSize: 12 } as const;
const editStyle = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, padding: "0 11px", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-2)", background: "var(--surface)", fontSize: 11, fontWeight: 700, textDecoration: "none" } as const;
const listStyle = { display: "grid", gap: 9 } as const;
const versionCardStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: 15, border: "1px solid var(--border)", borderRadius: 11, background: "var(--card)" } as const;
const versionIdentityStyle = { display: "flex", alignItems: "flex-start", gap: 11 } as const;
const iconStyle = { width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 8, color: "var(--accent)", background: "var(--accent-soft)" } as const;
const versionTitleStyle = { color: "var(--text-strong)", fontSize: 13 } as const;
const metaStyle = { margin: "4px 0 0", color: "var(--muted)", fontSize: 10.5 } as const;
const errorStyle = { margin: "6px 0 0", color: "var(--danger)", fontSize: 10.5 } as const;
const actionsStyle = { display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 6 } as const;
const emptyStyle = { padding: 20, border: "1px dashed var(--border)", borderRadius: 10, color: "var(--muted)", background: "var(--card)", fontSize: 12 } as const;
const deniedStyle = { margin: 24, padding: 18, border: "1px solid var(--danger)", borderRadius: 12, color: "var(--danger)", background: "var(--card)" } as const;
