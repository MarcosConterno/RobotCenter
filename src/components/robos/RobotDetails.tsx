"use client";

import {
  Bot,
  BadgeCheck,
  Boxes,
  Building2,
  CalendarDays,
  CalendarClock,
  Check,
  CirclePower,
  Cpu,
  Download,
  Copy,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  Layers3,
  Package,
  Pencil,
  Plus,
  Server,
  Terminal,
  Trash2,
  Upload,
  UserRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { formatarData, formatarDataHora } from "@/domain/formatters";
import type { Cliente, RegraRobo, Robo, RobotUploadedDocument } from "@/domain/entities";
import { getRobotProductByType } from "@/domain/robot-products";
import { createClient } from "@/lib/supabase/client";
import StackRequestsPanel from "./StackRequestsPanel";

import styles from "./RobotDetails.module.css";

type MainTab = "general" | "documentation" | "stackRequests" | "redmine";
type DocumentationTab = "functional" | "outside" | "files";
const EMPTY_CLIENTES: Cliente[] = [];
const EMPTY_ROBOS: Robo[] = [];
const REQUIREMENT_CODE_PATTERN = /^\s*\[?((?:RF|RNF|RFD)\d+(?:\.\d+)*)\]?\s*/i;
const REQUIREMENT_PREFIX_PATTERN = /^\s*\[?(?:RF|RNF|RFD)\d+(?:\.\d+)*\]?\s*/i;

interface RobotDetailsProps {
  robot: Robo;
  clientes?: Cliente[];
  robos?: Robo[];
  initialTab?: MainTab;
}

export default function RobotDetails({ robot, clientes = EMPTY_CLIENTES, robos = EMPTY_ROBOS, initialTab = "general" }: RobotDetailsProps) {
  const { isAdmin, isClient, canDuplicateRobots, canEditClientRobots, clientId, canViewStackRequests } = useAdminAccess();
  const canEditRobot = isAdmin || (isClient && canEditClientRobots && Boolean(clientId) && robot.clienteId === clientId);
  const [activeTab, setActiveTab] = useState<MainTab>(() => initialTab === "stackRequests" && !canViewStackRequests ? "general" : initialTab);
  const [documentationTab, setDocumentationTab] = useState<DocumentationTab>("functional");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<RobotUploadedDocument[]>(robot.uploadedDocuments ?? []);
  const [uploadedDocumentationBusy, setUploadedDocumentationBusy] = useState<string | null>(null);
  const [uploadedDocumentationError, setUploadedDocumentationError] = useState("");
  const [uploadingDocuments, setUploadingDocuments] = useState(false);

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

  useEffect(() => { setUploadedDocuments(robot.uploadedDocuments ?? []); }, [robot.uploadedDocuments]);

  async function openUploadedDocumentation(document: RobotUploadedDocument, download: boolean) {
    setUploadedDocumentationBusy(`${document.id}:${download ? "download" : "view"}`);
    setUploadedDocumentationError("");
    const { data, error } = await createClient().storage
      .from("robot-manuals")
      .createSignedUrl(
        document.storagePath,
        900,
        download ? { download: document.fileName } : undefined,
      );
    setUploadedDocumentationBusy(null);
    if (error) {
      setUploadedDocumentationError("Não foi possível acessar a Documentação Upada.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function uploadDocuments(files: FileList | null) {
    if (!files?.length || !isAdmin) return;
    const allowedTypes = new Map([
      ["pdf", "application/pdf"],
      ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ]);
    setUploadingDocuments(true);
    setUploadedDocumentationError("");
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        const extension = file.name.split(".").pop()?.toLocaleLowerCase("pt-BR") ?? "";
        const mimeType = allowedTypes.get(extension);
        if (!mimeType) throw new Error(`O arquivo “${file.name}” deve ser PDF, DOCX ou XLSX.`);
        if (file.size > 20 * 1024 * 1024) throw new Error(`O arquivo “${file.name}” deve ter no máximo 20 MB.`);
        const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
        const storagePath = `${robot.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("robot-manuals").upload(storagePath, file, { contentType: mimeType, upsert: false });
        if (uploadError) throw uploadError;
        const { data, error: metadataError } = await supabase.from("robot_uploaded_documents").insert({
          robot_id: robot.id,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: mimeType,
          size_bytes: file.size,
        }).select("id,robot_id,storage_path,file_name,mime_type,size_bytes,created_at").single();
        if (metadataError) {
          await supabase.storage.from("robot-manuals").remove([storagePath]);
          throw metadataError;
        }
        setUploadedDocuments((current) => [{ id: data.id, robotId: data.robot_id, storagePath: data.storage_path, fileName: data.file_name, mimeType: data.mime_type, sizeBytes: data.size_bytes, createdAt: data.created_at }, ...current]);
      }
    } catch (cause) {
      setUploadedDocumentationError(cause instanceof Error ? cause.message : "Não foi possível enviar os arquivos.");
    } finally {
      setUploadingDocuments(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  async function deleteUploadedDocument(document: RobotUploadedDocument) {
    if (!isAdmin || !window.confirm(`Excluir o arquivo “${document.fileName}”?`)) return;
    setUploadedDocumentationBusy(`${document.id}:delete`);
    setUploadedDocumentationError("");
    const supabase = createClient();
    const { error: metadataError } = await supabase.from("robot_uploaded_documents").update({ deleted_at: new Date().toISOString() }).eq("id", document.id).eq("robot_id", robot.id);
    if (metadataError) {
      setUploadedDocumentationError("Não foi possível excluir o arquivo.");
      setUploadedDocumentationBusy(null);
      return;
    }
    const { error: storageError } = await supabase.storage.from("robot-manuals").remove([document.storagePath]);
    if (storageError) console.error("Falha ao remover objeto arquivado", { message: storageError.message });
    setUploadedDocuments((current) => current.filter((item) => item.id !== document.id));
    setUploadedDocumentationBusy(null);
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
            <span className={styles.eyebrow}>{getRobotProductByType(robot.productType).label.toLocaleUpperCase("pt-BR")}</span>
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
          <span><Layers3 size={12} /> {robot.stack || "Sem Stack"}</span>
        </div>
        <div className={styles.headerActions}>
          {canDuplicateRobots && <Link href={`/robos/novo?copiarDe=${robot.id}`} className={styles.secondaryAction}><Copy size={14} /> Criar cópia</Link>}
          {canEditRobot && <Link href={`/robos/${robot.id}/editar`} className={styles.primaryAction}><Pencil size={14} /> Editar robô</Link>}
        </div>
      </header>

      <nav className={styles.mainTabs} role="tablist" aria-label="Seções do robô">
        <TabButton active={activeTab === "general"} onClick={() => setActiveTab("general")}>Detalhes Gerais</TabButton>
        <TabButton active={activeTab === "documentation"} onClick={() => setActiveTab("documentation")}>Documentação</TabButton>
        {canViewStackRequests && <TabButton active={activeTab === "stackRequests"} onClick={() => setActiveTab("stackRequests")}>Solicitações de Stack</TabButton>}
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
              <Field icon={<Building2 size={16} />} label="Cliente" value={cliente?.nome ?? (robot.productType === "INTEGRADOR" ? "Não informado" : "Não se aplica")} />
              <Field icon={<Boxes size={16} />} label="Ambiente" value={robot.ambiente} />
              <Field icon={<CirclePower size={16} />} label="Status" value={robot.ativo ? "Ativo" : "Inativo"} />
              <Field icon={<Bot size={16} />} label="Kortex" value={robot.kortex ? "true" : "false"} />
              <Field icon={<Package size={16} />} label="Pacote" value={robot.pacote} />
              <Field icon={<Layers3 size={16} />} label="Stack" value={robot.stack} />
              <Field icon={<GitBranch size={16} />} label="Versão" value={robot.versao} />
              <Field icon={<Terminal size={16} />} label="Command" value={robot.command} />
              {robot.productType !== "INTEGRADOR" && <Field icon={<Building2 size={16} />} label="Tribunal" value={robot.tribunal} />}
              {robot.productType !== "INTEGRADOR" && <Field icon={<Building2 size={16} />} label="Sistema Tribunal" value={robot.tribunalSystem} />}
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
            <RequirementSection title="Requisitos Funcionais" prefix="RF" rules={robot.regras} robotId={robot.id} canEdit={isAdmin} />
          ) : documentationTab === "outside" ? (
            <RequirementSection title="Regras Fora da Documentação" prefix="RFD" rules={robot.regrasForaDocumentacao} robotId={robot.id} canEdit={isAdmin} description="Regras cadastradas separadamente da documentação técnica." />
          ) : (
            <div className={styles.fileGrid}>
              <Section
                title="Documentação Upada"
                description="Documentos e anexos enviados manualmente para este robô."
                headerMeta={isAdmin ? <button className={styles.uploadAction} type="button" disabled={uploadingDocuments} onClick={() => uploadInputRef.current?.click()}><Upload size={13} /> {uploadingDocuments ? "Enviando..." : "Adicionar arquivos"}</button> : undefined}
              >
                <input ref={uploadInputRef} type="file" multiple hidden accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void uploadDocuments(event.target.files)} />
                {uploadedDocuments.length ? <div className={styles.uploadedFileList}>{uploadedDocuments.map((document) => <article className={styles.uploadedFileItem} key={document.id}>
                  <div className={styles.fileIdentity}><FileText size={18} /><div><strong>{document.fileName}</strong><span>{document.mimeType.includes("spreadsheet") ? "Planilha XLSX" : document.mimeType.includes("wordprocessing") ? "Documento DOCX" : "Documento PDF"}{document.sizeBytes ? ` · ${(document.sizeBytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : ""}</span></div></div>
                  <div className={styles.actions}>
                    <button type="button" onClick={() => void openUploadedDocumentation(document, false)} disabled={uploadedDocumentationBusy !== null}><ExternalLink size={14} /> {uploadedDocumentationBusy === `${document.id}:view` ? "Abrindo..." : "Visualizar"}</button>
                    <button type="button" onClick={() => void openUploadedDocumentation(document, true)} disabled={uploadedDocumentationBusy !== null}><Download size={14} /> {uploadedDocumentationBusy === `${document.id}:download` ? "Preparando..." : "Baixar"}</button>
                    {isAdmin && <button className={styles.dangerAction} type="button" onClick={() => void deleteUploadedDocument(document)} disabled={uploadedDocumentationBusy !== null}><Trash2 size={14} /> {uploadedDocumentationBusy === `${document.id}:delete` ? "Excluindo..." : "Excluir"}</button>}
                  </div>
                </article>)}</div> : <EmptyText>Nenhum arquivo externo anexado.</EmptyText>}
                {uploadedDocumentationError && <p className={styles.errorText}>{uploadedDocumentationError}</p>}
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

      {activeTab === "stackRequests" && <div className={styles.tabPanel}><StackRequestsPanel robotId={robot.id} /></div>}

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

function RequirementSection({ title, prefix, rules, robotId, canEdit, description }: { title: string; prefix: "RF" | "RNF" | "RFD"; rules: RegraRobo[]; robotId: string; canEdit: boolean; description?: string }) {
  const [currentRules, setCurrentRules] = useState(rules);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [newRuleDraft, setNewRuleDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setCurrentRules(rules); }, [rules]);

  async function createRule() {
    const description = newRuleDraft.trim();
    if (!description) return;
    setSaving(true); setError("");
    const nextOrder = currentRules.reduce((highest, rule) => Math.max(highest, rule.ordem ?? -1), -1) + 1;
    const { data, error: mutationError } = await createClient().from("regras_robo").insert({
      robo_id: robotId,
      descricao: description,
      ordem: nextOrder,
      tipo: prefix === "RFD" ? "fora_documentacao" : "documentacao",
    }).select("id,parent_id,ordem,descricao").single();
    setSaving(false);
    if (mutationError || !data) { setError("Não foi possível adicionar a regra."); return; }
    setCurrentRules((current) => [...current, {
      id: data.id,
      parentId: data.parent_id,
      ordem: data.ordem,
      descricao: data.descricao,
    }]);
    setCreating(false); setNewRuleDraft("");
  }

  async function saveRule(rule: RegraRobo) {
    if (!rule.id || !draft.trim()) return;
    setSaving(true); setError("");
    const { error: mutationError } = await createClient().from("regras_robo").update({ descricao: draft.trim() }).eq("id", rule.id).eq("robo_id", robotId);
    setSaving(false);
    if (mutationError) { setError("Não foi possível editar a regra."); return; }
    setCurrentRules((current) => current.map((item) => item.id === rule.id ? { ...item, descricao: draft.trim() } : item));
    setEditingId(null); setDraft("");
  }

  async function deleteRule(rule: RegraRobo) {
    if (!rule.id || !window.confirm("Excluir esta regra?")) return;
    setSaving(true); setError("");
    const { error: mutationError } = await createClient().from("regras_robo").update({ deleted_at: new Date().toISOString() }).eq("id", rule.id).eq("robo_id", robotId);
    setSaving(false);
    if (mutationError) { setError("Não foi possível excluir a regra."); return; }
    setCurrentRules((current) => current.filter((item) => item.id !== rule.id));
    if (editingId === rule.id) { setEditingId(null); setDraft(""); }
  }

  return (
    <Section title={title} description={description} headerMeta={canEdit ? <button className={styles.uploadAction} type="button" disabled={saving || creating} onClick={() => { setCreating(true); setEditingId(null); setDraft(""); setError(""); }}><Plus size={13} /> Adicionar regra</button> : undefined}>
      {creating && <article className={styles.requirement}>
        <strong>{`${prefix}${String(currentRules.length + 1).padStart(3, "0")}`}</strong>
        <textarea className={styles.requirementEditor} value={newRuleDraft} autoFocus placeholder="Escreva a nova regra" onChange={(event) => setNewRuleDraft(event.target.value)} />
        <div className={styles.requirementActions}>
          <button type="button" title="Salvar regra" disabled={saving || !newRuleDraft.trim()} onClick={() => void createRule()}><Check size={14} /></button>
          <button type="button" title="Cancelar" disabled={saving} onClick={() => { setCreating(false); setNewRuleDraft(""); }}><X size={14} /></button>
        </div>
      </article>}
      {currentRules.length ? <div className={styles.requirementList}>{currentRules.map((rule, index) => {
        const explicitCode = rule.descricao.match(REQUIREMENT_CODE_PATTERN)?.[1]?.toUpperCase();
        const code = explicitCode ?? `${prefix}${String(index + 1).padStart(3, "0")}`;
        const descriptionText = explicitCode ? rule.descricao.replace(REQUIREMENT_PREFIX_PATTERN, "") : rule.descricao;
        const isChild = code.includes(".");
        const editing = Boolean(rule.id && editingId === rule.id);
        return <article key={rule.id ?? `${code}-${index}`} className={isChild ? styles.childRequirement : styles.requirement}>
          <strong>{code}</strong>
          {editing ? <textarea className={styles.requirementEditor} value={draft} autoFocus onChange={(event) => setDraft(event.target.value)} /> : <p>{descriptionText}</p>}
          {canEdit && rule.id ? <div className={styles.requirementActions}>{editing ? <>
            <button type="button" title="Salvar" disabled={saving || !draft.trim()} onClick={() => void saveRule(rule)}><Check size={14} /></button>
            <button type="button" title="Cancelar" disabled={saving} onClick={() => { setEditingId(null); setDraft(""); }}><X size={14} /></button>
          </> : <>
            <button type="button" title="Editar regra" disabled={saving} onClick={() => { setEditingId(rule.id ?? null); setDraft(rule.descricao); }}><Pencil size={14} /></button>
            <button type="button" className={styles.dangerAction} title="Excluir regra" disabled={saving} onClick={() => void deleteRule(rule)}><Trash2 size={14} /></button>
          </>}</div> : null}
        </article>;
      })}</div> : !creating ? <EmptyText>{prefix === "RFD" ? "Nenhuma regra fora da documentação cadastrada." : "Nenhum requisito cadastrado."}</EmptyText> : null}
      {error && <p className={styles.errorText}>{error}</p>}
    </Section>
  );
}
