"use client";

import {
  Bot,
  BadgeCheck,
  Boxes,
  Building2,
  CalendarDays,
  CalendarClock,
  CirclePower,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  Layers3,
  Package,
  Pencil,
  Server,
  Upload,
  UserRound,
  Workflow,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { formatarData, formatarDataHora } from "@/domain/formatters";
import type { Cliente, RegraRobo, Robo } from "@/domain/entities";
import { createClient } from "@/lib/supabase/client";

import styles from "./RobotDetails.module.css";

type MainTab = "general" | "documentation" | "redmine";
type DocumentationTab = "functional" | "outside" | "files";
const EMPTY_CLIENTES: Cliente[] = [];
const EMPTY_ROBOS: Robo[] = [];
const REQUIREMENT_CODE_PATTERN = /^\s*\[?((?:RF|RNF|RFD)\d+(?:\.\d+)*)\]?\s*/i;
const REQUIREMENT_PREFIX_PATTERN = /^\s*\[?(?:RF|RNF|RFD)\d+(?:\.\d+)*\]?\s*/i;

interface RobotDetailsProps {
  robot: Robo;
  clientes?: Cliente[];
  robos?: Robo[];
}

export default function RobotDetails({ robot, clientes = EMPTY_CLIENTES, robos = EMPTY_ROBOS }: RobotDetailsProps) {
  const { isAdmin } = useAdminAccess();
  const [activeTab, setActiveTab] = useState<MainTab>("general");
  const [documentationTab, setDocumentationTab] = useState<DocumentationTab>("functional");
  const [uploadedDocumentationBusy, setUploadedDocumentationBusy] = useState<"view" | "download" | null>(null);
  const [uploadedDocumentationError, setUploadedDocumentationError] = useState("");

  const cliente = clientes.find((item) => item.id === robot.clienteId);
  const gatilhoDe = robos.find((item) => item.id === robot.gatilhoDeRoboId);
  const gatilhoPara = robos.find((item) => item.id === robot.gatilhoParaRoboId);
  const robotCenterDocumentation = robot.robotCenterDocumentation;
  const publishedRobotCenterDocumentation = robotCenterDocumentation?.status === "published"
    ? robotCenterDocumentation
    : null;
  const environmentClass = robot.ambiente === "Produção"
    ? styles.productionEnvironment
    : robot.ambiente === "Teste"
      ? styles.testEnvironment
      : styles.developmentEnvironment;

  async function openUploadedDocumentation(download: boolean) {
    if (!robot.uploadedDocumentationPath) return;
    setUploadedDocumentationBusy(download ? "download" : "view");
    setUploadedDocumentationError("");
    const { data, error } = await createClient().storage
      .from("robot-manuals")
      .createSignedUrl(
        robot.uploadedDocumentationPath,
        900,
        download ? { download: robot.uploadedDocumentationName ?? "documentacao-upada.pdf" } : undefined,
      );
    setUploadedDocumentationBusy(null);
    if (error) {
      setUploadedDocumentationError("Não foi possível acessar a Documentação Upada.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function openRobotCenterArtifact(kind: "pdf" | "docx", download: boolean) {
    const path = kind === "pdf" ? publishedRobotCenterDocumentation?.pdfPath : publishedRobotCenterDocumentation?.docxPath;
    if (!path) return;
    const extension = kind === "pdf" ? "pdf" : "docx";
    const { data, error } = await createClient().storage.from("robot-documentation")
      .createSignedUrl(path, 900, download ? { download: `${robot.nome}-documentacao.${extension}` } : undefined);
    if (error) return setUploadedDocumentationError("Não foi possível acessar a Documentação Robot Center.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={styles.pageContent}>
      <header className={styles.robotHeader}>
        <div className={styles.identity}>
          <span className={styles.robotIcon}><Bot size={23} /></span>
          <div>
            <span className={styles.eyebrow}>ROBÔ INTEGRADOR</span>
            <h1>{robot.nome}</h1>
            <p>{robot.courtName}</p>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span className={environmentClass}>{robot.ambiente}</span>
          <StatusPill active={robot.ativo} />
          <span><Package size={12} /> {robot.pacote}</span>
          <span><GitBranch size={12} /> {robot.versao}</span>
          <span><CalendarClock size={12} /> Att Versão: {robot.versionCheckedAt ? formatarDataHora(robot.versionCheckedAt) : "—"}</span>
          <span><Server size={12} /> {robot.fila}</span>
          <span><Layers3 size={12} /> {robot.stack}</span>
        </div>
        {isAdmin && (
          <Link href={`/robos/${robot.id}/editar`} className={`${styles.primaryAction} ${styles.headerAction}`}>
            <Pencil size={14} /> Editar robô
          </Link>
        )}
      </header>

      <nav className={styles.mainTabs} role="tablist" aria-label="Seções do robô">
        <TabButton active={activeTab === "general"} onClick={() => setActiveTab("general")}>Detalhes Gerais</TabButton>
        <TabButton active={activeTab === "documentation"} onClick={() => setActiveTab("documentation")}>Documentação</TabButton>
        <TabButton active={activeTab === "redmine"} onClick={() => setActiveTab("redmine")}>Redmine</TabButton>
      </nav>

      {activeTab === "general" && (
        <div className={styles.tabPanel}>
          <Section title="Descrição">
            <p className={styles.longText}>{robot.descricao || "Nenhuma descrição cadastrada."}</p>
          </Section>

          <Section title="Informações do Robô">
            <div className={styles.fieldsGrid}>
              <Field icon={<Bot size={16} />} label="Nome" value={robot.nome} />
              <Field icon={<Cpu size={16} />} label="Nome técnico" value={robot.courtName} />
              <Field icon={<GitBranch size={16} />} label="Sistema" value={robot.sistema} />
              <Field icon={<Building2 size={16} />} label="Cliente" value={cliente?.nome ?? "Não informado"} />
              <Field icon={<Boxes size={16} />} label="Ambiente" value={robot.ambiente} />
              <Field icon={<CirclePower size={16} />} label="Status" value={robot.ativo ? "Ativo" : "Inativo"} />
              <Field icon={<Package size={16} />} label="Pacote" value={robot.pacote} />
              <Field icon={<Layers3 size={16} />} label="Stack" value={robot.stack} />
              <Field icon={<GitBranch size={16} />} label="Versão" value={robot.versao} />
              <Field icon={<CalendarClock size={16} />} label="Att Versão" value={robot.versionCheckedAt ? formatarDataHora(robot.versionCheckedAt) : "—"} />
              <Field icon={<Server size={16} />} label="Fila" value={robot.fila} />
              <Field icon={<Zap size={16} />} label="Disparo" value={robot.disparo === "Gatilho" ? "Por Gatilho" : robot.disparo ?? "Manual"} />
              <Field icon={<UserRound size={16} />} label="Responsável" value={robot.responsavel} />
              <Field icon={<Workflow size={16} />} label="Gatilho de" value={gatilhoDe?.nome ?? "Nenhum"} />
              <Field icon={<Workflow size={16} />} label="Gatilho para" value={gatilhoPara?.nome ?? "Nenhum"} />
              <Field icon={<Bot size={16} />} label="Ideal" value={robot.ideal} />
              <Field icon={<Bot size={16} />} label="Máximo" value={robot.max} />
            </div>
          </Section>

          <Section title="Histórico de alterações">
            {robot.alteracoes.length ? (
              <div className={styles.changeList}>
                {robot.alteracoes.map((alteracao) => (
                  <div key={alteracao.id} className={styles.changeItem}>
                    <History size={15} />
                    <div><time>{formatarData(alteracao.realizadaEm)}</time><p>{alteracao.descricao}</p></div>
                  </div>
                ))}
              </div>
            ) : <EmptyText>Nenhuma alteração registrada.</EmptyText>}
          </Section>
        </div>
      )}

      {activeTab === "documentation" && (
        <div className={styles.tabPanel}>
          <nav className={styles.secondaryTabs} role="tablist" aria-label="Conteúdo da documentação">
            <TabButton active={documentationTab === "functional"} onClick={() => setDocumentationTab("functional")}>Requisitos Funcionais</TabButton>
            <TabButton active={documentationTab === "outside"} onClick={() => setDocumentationTab("outside")}>Regras Fora da Documentação</TabButton>
            <TabButton active={documentationTab === "files"} onClick={() => setDocumentationTab("files")}>Arquivos</TabButton>
          </nav>

          {documentationTab === "functional" ? (
            <RequirementSection title="Requisitos Funcionais" prefix="RF" rules={robot.regras} />
          ) : documentationTab === "outside" ? (
            <RequirementSection title="Regras Fora da Documentação" prefix="RFD" rules={robot.regrasForaDocumentacao} description="Regras cadastradas separadamente da documentação técnica." />
          ) : (
            <div className={styles.fileGrid}>
              <Section title="Documentação Upada" description="Arquivo externo anexado manualmente ao robô.">
                {robot.uploadedDocumentationPath ? (
                  <div className={styles.fileContent}>
                    <div className={styles.fileIdentity}><FileText size={20} /><div><strong>{robot.uploadedDocumentationName ?? "Documentação.pdf"}</strong><span>PDF externo</span></div></div>
                    <div className={styles.actions}>
                      <button type="button" onClick={() => void openUploadedDocumentation(false)} disabled={uploadedDocumentationBusy !== null}><ExternalLink size={14} /> {uploadedDocumentationBusy === "view" ? "Abrindo..." : "Visualizar"}</button>
                      <button type="button" onClick={() => void openUploadedDocumentation(true)} disabled={uploadedDocumentationBusy !== null}><Download size={14} /> {uploadedDocumentationBusy === "download" ? "Preparando..." : "Baixar"}</button>
                      {isAdmin && <Link href={`/robos/${robot.id}/editar`}><Upload size={14} /> Substituir</Link>}
                    </div>
                    {uploadedDocumentationError && <p className={styles.errorText}>{uploadedDocumentationError}</p>}
                  </div>
                ) : <EmptyText>Nenhum arquivo externo anexado.</EmptyText>}
              </Section>

              <Section
                title="Documentação Robot Center"
                description="Documento estruturado, editado e versionado pelo Robot Center."
                headerMeta={publishedRobotCenterDocumentation ? (
                  <div className={styles.sectionHeaderMeta} aria-label="Informações da documentação publicada">
                    <span><FileText size={12} /> v1.{publishedRobotCenterDocumentation.currentVersion - 1}</span>
                    <span><BadgeCheck size={12} /> Publicado</span>
                    <span><CalendarDays size={12} /> {formatarData(publishedRobotCenterDocumentation.updatedAt)}</span>
                  </div>
                ) : undefined}
              >
                {publishedRobotCenterDocumentation ? (
                  <div className={styles.fileContent}>
                    <div className={styles.fileIdentity}>
                      <FileText size={20} />
                      <div>
                        <strong>{robot.nome}</strong>
                        <span>PDF e DOCX oficiais</span>
                      </div>
                    </div>
                    <div className={styles.actions}>
                      {publishedRobotCenterDocumentation.pdfPath && <button type="button" onClick={() => void openRobotCenterArtifact("pdf", false)}><ExternalLink size={14} /> Visualizar PDF</button>}
                      {publishedRobotCenterDocumentation.pdfPath && <button type="button" onClick={() => void openRobotCenterArtifact("pdf", true)}><Download size={14} /> Baixar PDF</button>}
                      {publishedRobotCenterDocumentation.docxPath && <button type="button" onClick={() => void openRobotCenterArtifact("docx", true)}><Download size={14} /> Baixar DOCX</button>}
                      {isAdmin && <Link href={`/robos/${robot.id}/documentacao-robot-center/editar`} prefetch={false}><Pencil size={14} /> Editar</Link>}
                      {isAdmin && <Link href={`/robos/${robot.id}/documentacao-robot-center`}><History size={14} /> Histórico</Link>}
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyAction}>
                    <EmptyText>Nenhuma documentação Robot Center publicada.</EmptyText>
                    {isAdmin && <Link href={`/robos/${robot.id}/documentacao-robot-center/editar`} prefetch={false} className={styles.primaryAction}>{robotCenterDocumentation ? "Continuar preparação" : "Criar documentação"}</Link>}
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>
      )}

      {activeTab === "redmine" && (
        <div className={styles.tabPanel}>
          <Section title="Integração Redmine" description="Esta área será utilizada para exibir informações relacionadas ao robô no Redmine.">
            <div className={styles.redmineEmpty}>
              <span className={styles.robotIcon}><ExternalLink size={20} /></span>
              <strong>Nenhum dado do Redmine conectado ainda.</strong>
              <p>A integração será configurada futuramente.</p>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" role="tab" className={active ? styles.activeTab : ""} aria-selected={active} onClick={onClick}>{children}</button>;
}

function Section({ title, description, headerMeta, children }: { title: string; description?: string; headerMeta?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {headerMeta}
      </header>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Field({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return <div className={icon ? `${styles.field} ${styles.fieldWithIcon}` : styles.field}>{icon ? <span className={styles.fieldIcon}>{icon}</span> : null}<span className={styles.fieldLabel}>{label}</span><strong>{value === "" || value == null ? "Não informado" : value}</strong></div>;
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={active ? styles.activeStatus : styles.inactiveStatus}>{active ? "Ativo" : "Inativo"}</span>;
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className={styles.emptyText}>{children}</p>;
}

function RequirementSection({ title, prefix, rules, description }: { title: string; prefix: "RF" | "RNF" | "RFD"; rules: RegraRobo[]; description?: string }) {
  return (
    <Section title={title} description={description}>
      {rules.length ? <div className={styles.requirementList}>{rules.map((rule, index) => {
        const explicitCode = rule.descricao.match(REQUIREMENT_CODE_PATTERN)?.[1]?.toUpperCase();
        const code = explicitCode ?? `${prefix}${String(index + 1).padStart(3, "0")}`;
        const descriptionText = explicitCode ? rule.descricao.replace(REQUIREMENT_PREFIX_PATTERN, "") : rule.descricao;
        const isChild = code.includes(".");
        return <article key={`${code}-${index}`} className={isChild ? styles.childRequirement : styles.requirement}><strong>{code}</strong><p>{descriptionText}</p></article>;
      })}</div> : <EmptyText>Nenhum requisito cadastrado.</EmptyText>}
    </Section>
  );
}
