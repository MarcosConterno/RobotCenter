"use client";

import { ArrowLeft, BookOpen, Boxes, Braces, Building2, Database, FileCode2, GitFork, LockKeyhole, ScrollText, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "@/components/layout/AppShell";
import ReadmeDocument from "./ReadmeDocument";
import styles from "./SystemDocumentation.module.css";

type DocumentId = "readme" | "architecture" | "database" | "domain" | "rules" | "permissions" | "usersApi" | "flowsApi" | "personalApi" | "versionsApi" | "robotDocumentationApi";
type DocumentationSources = Record<DocumentId, string>;

const documents = [
  { id: "readme", title: "README", shortTitle: "Visão geral", description: "Produto, recursos, tecnologias e execução.", icon: FileCode2 },
  { id: "architecture", title: "Arquitetura", shortTitle: "Arquitetura", description: "Camadas, segurança e fluxos técnicos.", icon: Boxes },
  { id: "database", title: "Modelagem do banco", shortTitle: "Banco", description: "Entidades, relações e persistência.", icon: Database },
  { id: "domain", title: "Domínio", shortTitle: "Domínio", description: "Conceitos e linguagem do sistema.", icon: Building2 },
  { id: "rules", title: "Regras de negócio", shortTitle: "Regras", description: "Comportamentos e decisões funcionais.", icon: ScrollText },
  { id: "permissions", title: "Papéis e permissões", shortTitle: "Permissões", description: "RBAC, RLS e escopos de acesso.", icon: ShieldCheck },
  { id: "usersApi", title: "API de usuários", shortTitle: "Usuários", description: "Contratos administrativos de usuários.", icon: Users },
  { id: "flowsApi", title: "API de fluxos", shortTitle: "Fluxos", description: "Persistência e publicação de fluxos.", icon: GitFork },
  { id: "personalApi", title: "API da Minha página", shortTitle: "Minha página", description: "Tarefas, reuniões, notas e preferências.", icon: BookOpen },
  { id: "versionsApi", title: "API de versões de robôs", shortTitle: "Versões", description: "Consulta e persistência das versões dos pacotes.", icon: Braces },
  { id: "robotDocumentationApi", title: "Documentação Robot Center", shortTitle: "Documentação", description: "Editor e publicação documental dos robôs.", icon: Braces },
] as const satisfies ReadonlyArray<{ id: DocumentId; title: string; shortTitle: string; description: string; icon: typeof FileCode2 }>;

const markdownTargetToDocument: Record<string, DocumentId> = {
  README: "readme",
  ARCHITECTURE: "architecture",
  "docs/modelagem-banco": "database",
  "docs/dominio": "domain",
  "docs/regras-negocio": "rules",
  "docs/permissoes": "permissions",
  "docs/api-usuarios": "usersApi",
  "docs/api-fluxos": "flowsApi",
  "docs/api-minha-pagina": "personalApi",
  "docs/api-versoes-robos": "versionsApi",
  "docs/api-documentacao-robot-center": "robotDocumentationApi",
};

export default function SystemDocumentation({ sources }: { sources: DocumentationSources }) {
  const [active, setActive] = useState<DocumentId>("readme");
  const selected = documents.find((document) => document.id === active) ?? documents[0];
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  function openMarkdownDocument(target: string) {
    const normalized = target.replace(/^\.\//, "").replace(/\.md$/, "");
    const documentId = markdownTargetToDocument[normalized];
    if (!documentId) return false;
    setActive(documentId);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }

  return <AppShell title="Documentação do Sistema">
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroIcon}><LockKeyhole size={20} aria-hidden="true" /></span>
          <div><span className={styles.eyebrow}>ROBOT CENTER · CENTRAL TÉCNICA</span><h1>Documentação do Sistema</h1><p>Conteúdo oficial do projeto, sincronizado diretamente com os documentos versionados no repositório.</p></div>
        </div>
        <Link href="/minha-pagina" className={styles.back}><ArrowLeft size={14} aria-hidden="true" /> Voltar ao sistema</Link>
      </header>

      <nav className={styles.documentTabs} aria-label="Documentos técnicos">
        {documents.map((document) => {
          const Icon = document.icon;
          return <button key={document.id} type="button" className={`${styles.documentTab} ${active === document.id ? styles.activeTab : ""}`} onClick={() => setActive(document.id)} title={document.description} aria-pressed={active === document.id}>
            <span className={styles.tabIcon}><Icon size={14} aria-hidden="true" /></span>
            <span className={styles.tabLabel}>{document.shortTitle}</span>
          </button>;
        })}
      </nav>

      <section className={styles.documentSummary}>
        <span className={styles.summaryIcon}><SelectedIcon size={21} aria-hidden="true" /></span>
        <div className={styles.summaryCopy}><small>DOCUMENTO ATIVO</small><h2>{selected.title}</h2><p>{selected.description}</p></div>
      </section>

      <ReadmeDocument source={sources[active]} onOpenDocument={openMarkdownDocument} />
    </div>
  </AppShell>;
}
