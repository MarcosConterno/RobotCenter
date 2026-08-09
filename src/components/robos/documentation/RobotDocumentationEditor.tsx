"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  AlignCenter,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  GripVertical,
  ImageIcon,
  Link2,
  LoaderCircle,
  MoreHorizontal,
  NotebookPen,
  Eye,
  ExternalLink,
  History,
  Plus,
  Rocket,
  StickyNote,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DOCUMENT_SECTION_LABELS,
  formatRequirementCode,
  type DocumentationBlock,
  type DocumentationBlockType,
  type DocumentationImageMetadata,
  type ImageAlignment,
  type ImageSizePreset,
  type DocumentationRequirement,
  type DocumentationSection,
  type RequirementCategory,
  type RobotCenterDocumentSchema,
} from "@/domain/robot-center-documentation";
import styles from "./RobotDocumentationEditor.module.css";

type SaveState = "saved" | "pending" | "saving" | "error";

export default function RobotDocumentationEditor({ initialSchema }: { initialSchema: RobotCenterDocumentSchema }) {
  const [sections, setSections] = useState(initialSchema.sections);
  const [requirements, setRequirements] = useState([
    ...initialSchema.requirements,
    ...initialSchema.nonFunctionalRequirements,
  ]);
  const [blocks, setBlocks] = useState(initialSchema.blocks);
  const [selection, setSelection] = useState(`section:${initialSchema.sections[0]?.key ?? "objective"}`);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [uploadStates, setUploadStates] = useState<Record<string, string>>({});
  const [imageFeedback, setImageFeedback] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishedPdf, setPublishedPdf] = useState<{ url: string | null; versionLabel: string; warning?: string | null } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const saveStateRef = useRef<SaveState>("saved");
  const activeSaves = useRef(0);

  const markSaveState = useCallback((state: SaveState) => {
    saveStateRef.current = state;
    setSaveState(state);
  }, []);

  const request = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch(`/api/robos/${initialSchema.robot.id}/documentacao-robot-center`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
    return result;
  }, [initialSchema.robot.id]);

  const persist = useCallback(async (payload: Record<string, unknown>) => {
    activeSaves.current += 1;
    markSaveState("saving");
    try {
      const result = await request(payload);
      activeSaves.current -= 1;
      markSaveState(activeSaves.current === 0 && timers.current.size === 0 ? "saved" : "pending");
      return result;
    } catch (error) {
      activeSaves.current -= 1;
      console.error(error);
      markSaveState("error");
      throw error;
    }
  }, [markSaveState, request]);

  const schedule = useCallback((key: string, payload: Record<string, unknown>) => {
    const current = timers.current.get(key);
    if (current) clearTimeout(current);
    markSaveState("pending");
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      void persist(payload).catch(() => undefined);
    }, 750));
  }, [markSaveState, persist]);

  useEffect(() => {
    const referenceSection = initialSchema.sections.find((section) => section.key === "reference_materials");
    if (!referenceSection || referenceSection.content.trim()) return;
    const defaultContent = "URL: \nLogin: \nSenha: ";
    setSections((current) => current.map((section) => section.id === referenceSection.id ? { ...section, content: defaultContent } : section));
    schedule(`section:${referenceSection.id}`, { action: "save-section", sectionId: referenceSection.id, content: defaultContent });
  }, [initialSchema.sections, schedule]);

  useEffect(() => {
    const activeTimers = timers.current;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (saveStateRef.current === "saved") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      activeTimers.forEach(clearTimeout);
    };
  }, []);

  const orderedRequirements = useMemo(
    () => [...requirements].sort((a, b) => a.category.localeCompare(b.category) || (a.parentId ?? "").localeCompare(b.parentId ?? "") || a.order - b.order),
    [requirements],
  );
  const selectedSection = selection.startsWith("section:")
    ? sections.find((item) => item.key === selection.slice(8))
    : undefined;
  const selectedRequirement = !selection.startsWith("section:")
    ? requirements.find((item) => item.id === selection)
    : undefined;

  const updateSection = (section: DocumentationSection, content: string) => {
    setSections((current) => current.map((item) => item.id === section.id ? { ...item, content } : item));
    schedule(`section:${section.id}`, { action: "save-section", sectionId: section.id, content });
  };

  const updateRequirement = (requirement: DocumentationRequirement, content: string) => {
    setRequirements((current) => current.map((item) => item.id === requirement.id ? { ...item, content } : item));
    schedule(`requirement:${requirement.id}`, { action: "save-requirement", requirementId: requirement.id, content });
  };

  const createRequirement = async (category: RequirementCategory, parentId: string | null = null) => {
    try {
      const result = await persist({ action: "create-requirement", category, parentId, content: parentId ? "Nova sub-regra" : "Nova regra" });
      const row = result.requirement;
      const created: DocumentationRequirement = {
        id: row.id, robotId: row.robo_id, parentId: row.parent_id,
        category: row.tipo, order: row.ordem, content: row.descricao,
      };
      setRequirements((current) => [...current, created]);
      setSelection(created.id);
    } catch { /* feedback is represented by saveState */ }
  };

  const moveRequirement = async (requirement: DocumentationRequirement, direction: -1 | 1) => {
    const siblings = requirements
      .filter((item) => item.category === requirement.category && item.parentId === requirement.parentId)
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((item) => item.id === requirement.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const previous = requirements;
    const orders = new Map(reordered.map((item, order) => [item.id, order]));
    setRequirements((current) => current.map((item) => orders.has(item.id) ? { ...item, order: orders.get(item.id)! } : item));
    try {
      await persist({
        action: "reorder-requirements",
        category: requirement.category,
        parentId: requirement.parentId,
        orderedIds: reordered.map((item) => item.id),
      });
    } catch { setRequirements(previous); }
  };

  const deleteRequirement = async (requirement: DocumentationRequirement) => {
    const code = formatRequirementCode(requirement, requirements);
    const confirmed = window.confirm(`Esta ${code} está vinculada ao cadastro do robô. Ao excluí-la aqui, ela e suas sub-regras também serão removidas do cadastro. Deseja continuar?`);
    if (!confirmed) return;
    try {
      await persist({ action: "delete-requirement", requirementId: requirement.id });
      const removedIds = new Set([requirement.id, ...requirements.filter((item) => item.parentId === requirement.id).map((item) => item.id)]);
      setRequirements((current) => current.filter((item) => !removedIds.has(item.id)));
      setBlocks((current) => current.filter((item) => !removedIds.has(item.requirementId)));
      setSelection("section:objective");
    } catch { /* feedback is represented by saveState */ }
  };

  const addBlock = async (requirementId: string, type: "text" | "note") => {
    try {
      const result = await persist({ action: "create-block", requirementId, blockType: type });
      setBlocks((current) => [...current, mapBlock(result.block)]);
    } catch { /* feedback is represented by saveState */ }
  };

  const updateBlock = (block: DocumentationBlock, content: string) => {
    setBlocks((current) => current.map((item) => item.id === block.id ? { ...item, content } : item));
    schedule(`block:${block.id}`, { action: "save-block", blockId: block.id, content });
  };

  const deleteBlock = async (block: DocumentationBlock) => {
    try {
      await persist({ action: "delete-block", blockId: block.id });
      setBlocks((current) => current.filter((item) => item.id !== block.id && item.relatedBlockId !== block.id));
    } catch { /* feedback is represented by saveState */ }
  };

  const uploadImage = async (file: File, requirementId: string, replaceBlockId?: string) => {
    const uploadId = crypto.randomUUID();
    setImageFeedback("");
    try {
      validateImageFile(file);
      setUploadStates((current) => ({ ...current, [uploadId]: replaceBlockId ? "Substituindo imagem..." : "Enviando imagem..." }));
      const dimensions = await readImageDimensions(file);
      const form = new FormData();
      form.set("action", replaceBlockId ? "replace-image" : "upload-image");
      form.set("file", file, file.name || `clipboard-${uploadId}.png`);
      form.set("requirementId", requirementId);
      form.set("width", String(dimensions.width));
      form.set("height", String(dimensions.height));
      if (replaceBlockId) form.set("blockId", replaceBlockId);
      const response = await fetch(`/api/robos/${initialSchema.robot.id}/documentacao-robot-center`, { method: "POST", body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Não foi possível enviar a imagem.");
      if (replaceBlockId) {
        setBlocks((current) => current.map((item) => item.id === replaceBlockId ? { ...item, metadata: result.metadata } : item));
      } else {
        setBlocks((current) => [...current, mapBlock(result.block)]);
      }
      markSaveState(activeSaves.current === 0 && timers.current.size === 0 ? "saved" : "pending");
    } catch (error) {
      setImageFeedback(error instanceof Error ? error.message : "Erro ao enviar a imagem.");
    } finally {
      setUploadStates((current) => {
        const next = { ...current };
        delete next[uploadId];
        return next;
      });
    }
  };

  const addCaption = async (image: DocumentationBlock) => {
    try {
      const result = await persist({ action: "add-caption", imageId: image.id });
      const caption = mapBlock(result.block);
      setBlocks((current) => {
        if (current.some((item) => item.id === caption.id)) return current;
        const next = [...current, caption];
        const siblings = next.filter((item) => item.requirementId === image.requirementId).sort((a, b) => a.order - b.order);
        const withoutCaption = siblings.filter((item) => item.id !== caption.id);
        const imageIndex = withoutCaption.findIndex((item) => item.id === image.id);
        withoutCaption.splice(imageIndex + 1, 0, caption);
        const orders = new Map(withoutCaption.map((item, order) => [item.id, order]));
        return next.map((item) => orders.has(item.id) ? { ...item, order: orders.get(item.id)! } : item);
      });
    } catch { /* state already shows the error */ }
  };

  const updateImageMetadata = (block: DocumentationBlock, alignment: ImageAlignment, sizePreset: ImageSizePreset) => {
    const metadata = { ...block.metadata, alignment, sizePreset };
    setBlocks((current) => current.map((item) => item.id === block.id ? { ...item, metadata } : item));
    schedule(`image:${block.id}`, { action: "save-image-metadata", blockId: block.id, alignment, sizePreset });
  };

  const reorderBlocks = async (requirementId: string, orderedIds: string[]) => {
    const previous = blocks;
    const orders = new Map(orderedIds.map((id, order) => [id, order]));
    setBlocks((current) => current.map((item) => item.requirementId === requirementId && orders.has(item.id) ? { ...item, order: orders.get(item.id)! } : item));
    try {
      await persist({ action: "reorder-blocks", requirementId, orderedIds });
    } catch { setBlocks(previous); }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const image = [...event.clipboardData.items].find((item) => item.kind === "file" && item.type.startsWith("image/"));
    if (!image) return;
    event.preventDefault();
    if (!selectedRequirement) {
      setImageFeedback("Selecione uma RF para inserir a imagem.");
      return;
    }
    const file = image.getAsFile();
    if (file) void uploadImage(file, selectedRequirement.id);
  };

  const handleWorkspaceDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
    if (!file) return;
    if (!selectedRequirement) {
      setImageFeedback("Selecione uma RF para inserir a imagem.");
      return;
    }
    void uploadImage(file, selectedRequirement.id);
  };

  const leaveEditor = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (saveState === "saved" || window.confirm("Ainda existem alterações não confirmadas. Deseja sair mesmo assim?")) return;
    event.preventDefault();
  };

  const publishDocumentation = async () => {
    if (saveState !== "saved") {
      setPublishError("Aguarde o salvamento de todas as alterações antes de publicar.");
      return;
    }
    setPublishing(true);
    setPublishError("");
    try {
      const response = await fetch(`/api/robos/${initialSchema.robot.id}/documentacao-robot-center/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationToken: crypto.randomUUID() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Não foi possível publicar.");
      setPublishDialogOpen(false);
      setPublishedPdf({ url: result.pdfPreviewUrl ?? null, versionLabel: result.versionLabel, warning: result.previewWarning });
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Não foi possível publicar.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href={`/robos/${initialSchema.robot.id}`} onClick={leaveEditor}><ArrowLeft size={14} /> Robôs</Link>
        <span>/</span><span>{initialSchema.robot.name}</span><span>/</span><strong>Editar documentação</strong>
      </div>

      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>DOCUMENTAÇÃO ROBOT CENTER</div>
          <h1>{initialSchema.robot.name}</h1>
          <p>{initialSchema.robot.technicalName} · {initialSchema.robot.system}</p>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/robos/${initialSchema.robot.id}/documentacao-robot-center`} onClick={leaveEditor} className={styles.secondaryAction}><History size={14} /> Histórico</Link>
          <button type="button" className={styles.secondaryAction} onClick={() => setPreviewOpen(true)}><Eye size={14} /> Pré-visualizar</button>
          <button type="button" className={styles.publishAction} disabled={publishing || saveState !== "saved"} onClick={() => { setPublishError(""); setPublishDialogOpen(true); }}>
            {publishing ? <LoaderCircle className={styles.spin} size={14} /> : <Rocket size={14} />}{publishing ? "Publicando..." : "Publicar"}
          </button>
          <div className={`${styles.saveState} ${styles[saveState]}`} role="status">
            {saveState === "saved" ? "Salvo" : saveState === "pending" ? "Alterações pendentes" : saveState === "saving" ? "Salvando..." : "Falha ao salvar — edite para tentar novamente"}
          </div>
        </div>
      </header>

      {publishError && <div className={styles.publishError} role="alert">{publishError}</div>}

      <div className={styles.workspace} onPaste={handlePaste} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDrop={handleWorkspaceDrop}>
        <aside className={styles.structure} aria-label="Estrutura do documento">
          <div className={styles.panelTitle}><BookOpen size={15} /> Estrutura do documento</div>
          <button className={styles.cover} type="button" disabled><FileText size={14} /> Capa <span>Automática</span></button>
          <div className={styles.structureGroup}>
            <div className={styles.groupLabel}>Seções</div>
            {[...sections].sort((a, b) => a.order - b.order).map((section) => (
              <button key={section.id} type="button" className={selection === `section:${section.key}` ? styles.selectedItem : ""} onClick={() => setSelection(`section:${section.key}`)}>
                {DOCUMENT_SECTION_LABELS[section.key]}
              </button>
            ))}
          </div>
          <RequirementTree title="Requisitos Funcionais" category="documentacao" requirements={orderedRequirements} selection={selection} onSelect={setSelection} onAdd={createRequirement} />
          <RequirementTree title="Requisitos Não Funcionais" category="fora_documentacao" requirements={orderedRequirements} selection={selection} onSelect={setSelection} onAdd={createRequirement} />
        </aside>

        <section className={styles.content} aria-live="polite">
          {selectedSection && (
            <SectionEditor section={selectedSection} onChange={(content) => updateSection(selectedSection, content)} />
          )}
          {selectedRequirement && (
            <RequirementEditor
              requirement={selectedRequirement}
              requirements={requirements}
              blocks={blocks.filter((item) => item.requirementId === selectedRequirement.id).sort((a, b) => a.order - b.order)}
              onChange={(content) => updateRequirement(selectedRequirement, content)}
              onMove={(direction) => void moveRequirement(selectedRequirement, direction)}
              onAddChild={() => void createRequirement(selectedRequirement.category, selectedRequirement.id)}
              onDelete={() => void deleteRequirement(selectedRequirement)}
              onAddBlock={(type) => void addBlock(selectedRequirement.id, type)}
              onUpdateBlock={updateBlock}
              onDeleteBlock={(block) => void deleteBlock(block)}
              onImage={(file) => void uploadImage(file, selectedRequirement.id)}
              onReplaceImage={(block, file) => void uploadImage(file, selectedRequirement.id, block.id)}
              onAddCaption={(block) => void addCaption(block)}
              onUpdateImageMetadata={updateImageMetadata}
              onReorderBlocks={(ids) => void reorderBlocks(selectedRequirement.id, ids)}
              uploadingMessages={Object.values(uploadStates)}
              imageFeedback={imageFeedback}
            />
          )}
        </section>
      </div>
      {previewOpen && <DocumentationPreview schema={initialSchema} sections={sections} requirements={requirements} blocks={blocks} onClose={() => setPreviewOpen(false)} />}
      {publishDialogOpen && <PublishConfirmation
        currentVersion={initialSchema.metadata.currentVersion ?? 0}
        publishing={publishing}
        error={publishError}
        onCancel={() => { if (!publishing) setPublishDialogOpen(false); }}
        onConfirm={() => void publishDocumentation()}
      />}
      {publishedPdf && <PublishedPdfPreview
        robotName={initialSchema.robot.name}
        versionLabel={publishedPdf.versionLabel}
        url={publishedPdf.url}
        warning={publishedPdf.warning}
        onClose={() => window.location.reload()}
      />}
    </main>
  );
}

function PublishConfirmation({ currentVersion, publishing, error, onCancel, onConfirm }: {
  currentVersion: number; publishing: boolean; error: string; onCancel: () => void; onConfirm: () => void;
}) {
  const currentLabel = currentVersion ? `v1.${currentVersion - 1}` : "Nenhuma versão";
  const nextLabel = `v1.${currentVersion}`;
  return <div className={styles.dialogBackdrop} role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !publishing) onCancel(); }}>
    <div className={styles.publishDialog}>
      <header><div className={styles.dialogIcon}><Rocket size={18} /></div><div><span>PUBLICAÇÃO</span><h2 id="publish-dialog-title">Publicar documentação?</h2><p>Uma nova versão imutável será criada e preservada no histórico.</p></div><button type="button" onClick={onCancel} disabled={publishing} aria-label="Fechar"><X size={16} /></button></header>
      <div className={styles.versionComparison}><div><span>Versão atual</span><strong>{currentLabel}</strong></div><div className={styles.versionArrow}>→</div><div><span>Nova versão</span><strong>{nextLabel}</strong></div></div>
      <div className={styles.dialogNotice}><FileText size={15} /><p>O DOCX e o PDF serão gerados a partir do estado atual do rascunho. A versão anterior não será alterada.</p></div>
      {error && <div className={styles.dialogError} role="alert">{error}</div>}
      <footer><button type="button" className={styles.dialogCancel} onClick={onCancel} disabled={publishing}>Cancelar</button><button type="button" className={styles.dialogConfirm} onClick={onConfirm} disabled={publishing}>{publishing ? <LoaderCircle className={styles.spin} size={14} /> : <Rocket size={14} />}{publishing ? "Gerando documentos..." : "Publicar versão"}</button></footer>
    </div>
  </div>;
}

function PublishedPdfPreview({ robotName, versionLabel, url, warning, onClose }: {
  robotName: string; versionLabel: string; url: string | null; warning?: string | null; onClose: () => void;
}) {
  return <div className={styles.pdfBackdrop} role="dialog" aria-modal="true" aria-labelledby="published-preview-title">
    <div className={styles.pdfDialog}>
      <header><div><span><CheckCircle2 size={15} /> PUBLICAÇÃO CONCLUÍDA</span><h2 id="published-preview-title">{robotName} · {versionLabel}</h2></div><div><a href={url ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!url}><ExternalLink size={14} /> Abrir em nova aba</a><button type="button" onClick={onClose}><X size={16} /></button></div></header>
      {url ? <iframe src={url} title={`Pré-visualização ${versionLabel}`} /> : <div className={styles.pdfUnavailable}><FileText size={24} /><strong>Versão publicada com sucesso.</strong><p>{warning ?? "A pré-visualização não está disponível neste momento."}</p></div>}
    </div>
  </div>;
}

function DocumentationPreview({ schema, sections, requirements, blocks, onClose }: {
  schema: RobotCenterDocumentSchema; sections: DocumentationSection[]; requirements: DocumentationRequirement[]; blocks: DocumentationBlock[]; onClose: () => void;
}) {
  const ordered = (category: RequirementCategory) => requirements.filter((item) => item.category === category)
    .sort((a, b) => (a.parentId ?? "").localeCompare(b.parentId ?? "") || a.order - b.order);
  return <div className={styles.previewBackdrop} role="dialog" aria-modal="true" aria-label="Pré-visualização da documentação" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.previewPanel}>
      <div className={styles.previewHeader}><div><span>PRÉ-VISUALIZAÇÃO</span><h2>{schema.robot.name}</h2><p>{schema.robot.system}</p></div><button type="button" onClick={onClose}>Fechar</button></div>
      <div className={styles.previewContent}>
        {[...sections].sort((a, b) => a.order - b.order).map((section) => section.content.trim() && <section key={section.id}><h3>{DOCUMENT_SECTION_LABELS[section.key]}</h3><SectionPreviewContent section={section} /></section>)}
        {(["documentacao", "fora_documentacao"] as RequirementCategory[]).map((category) => <section key={category}>
          <h3>{category === "documentacao" ? "Requisitos Funcionais" : "Requisitos Não Funcionais"}</h3>
          {ordered(category).map((requirement) => <article key={requirement.id} className={styles.previewRequirement}>
            <strong>{formatRequirementCode(requirement, requirements)}</strong><p>{requirement.content}</p>
            {blocks.filter((block) => block.requirementId === requirement.id).sort((a, b) => a.order - b.order).map((block) => block.type === "image" && typeof block.metadata.previewUrl === "string"
              ? <Image key={block.id} src={block.metadata.previewUrl} alt={String(block.metadata.originalFileName ?? "Imagem documental")} width={Number(block.metadata.width ?? 900)} height={Number(block.metadata.height ?? 600)} unoptimized />
              : block.content.trim() ? <p key={block.id} className={block.type === "note" ? styles.previewNote : ""}>{block.content}</p> : null)}
          </article>)}
        </section>)}
      </div>
    </div>
  </div>;
}

function RequirementTree({ title, category, requirements, selection, onSelect, onAdd }: {
  title: string; category: RequirementCategory; requirements: DocumentationRequirement[]; selection: string;
  onSelect: (id: string) => void; onAdd: (category: RequirementCategory) => void;
}) {
  const roots = requirements.filter((item) => item.category === category && !item.parentId).sort((a, b) => a.order - b.order);
  return <div className={styles.structureGroup}>
    <div className={styles.treeHeader}><span><ChevronDown size={13} /> {title}</span><button type="button" onClick={() => onAdd(category)} aria-label={`Adicionar ${title}`}><Plus size={13} /></button></div>
    {roots.length === 0 && <div className={styles.emptyTree}>Nenhum requisito cadastrado.</div>}
    {roots.map((root) => <div key={root.id}>
      <button type="button" className={selection === root.id ? styles.selectedItem : ""} onClick={() => onSelect(root.id)}>
        <strong>{formatRequirementCode(root, requirements)}</strong><span>{root.content}</span>
      </button>
      {requirements.filter((item) => item.parentId === root.id).sort((a, b) => a.order - b.order).map((child) => (
        <button key={child.id} type="button" className={`${styles.childItem} ${selection === child.id ? styles.selectedItem : ""}`} onClick={() => onSelect(child.id)}>
          <strong>{formatRequirementCode(child, requirements)}</strong><span>{child.content}</span>
        </button>
      ))}
    </div>)}
  </div>;
}

function SectionPreviewContent({ section }: { section: DocumentationSection }) {
  const lines = section.content.split("\n").map((line) => line.trim()).filter(Boolean);
  if (section.key === "overview") {
    return <ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul>;
  }
  if (section.key === "limitations") {
    return <ul>{lines.map((line, index) => {
      const checked = /^\[x\]\s*/i.test(line);
      const text = line.replace(/^\[(?:x| )\]\s*/i, "");
      return <li key={index}>{checked ? <del>☒ {text}</del> : <>☐ {text}</>}</li>;
    })}</ul>;
  }
  return <p>{section.content}</p>;
}

function SectionEditor({ section, onChange }: { section: DocumentationSection; onChange: (content: string) => void }) {
  if (section.key === "reference_materials") {
    const lines = section.content.split("\n");
    const readValue = (label: string) => lines.find((line) => line.toLocaleLowerCase("pt-BR").startsWith(`${label.toLocaleLowerCase("pt-BR")}:`))?.slice(label.length + 1).trim() ?? "";
    const values = {
      url: readValue("URL") || lines.find((line) => /^https?:\/\//i.test(line.trim()))?.trim() || "",
      login: readValue("Login"),
      password: readValue("Senha"),
    };
    const save = (next: typeof values) => onChange(`URL: ${next.url}\nLogin: ${next.login}\nSenha: ${next.password}`);
    return <div className={styles.editorCard}>
      <div className={styles.contentEyebrow}>SEÇÃO DO DOCUMENTO</div>
      <h2>{DOCUMENT_SECTION_LABELS[section.key]}</h2>
      <p>Dados de acesso utilizados como referência técnica do robô.</p>
      <div className={styles.referenceFields}>
        <label><span>URL</span><input type="url" value={values.url} onChange={(event) => save({ ...values, url: event.target.value })} placeholder="https://sistema.exemplo.com" /></label>
        <label><span>Login</span><input value={values.login} onChange={(event) => save({ ...values, login: event.target.value })} placeholder="Login de acesso" /></label>
        <label><span>Senha</span><input value={values.password} onChange={(event) => save({ ...values, password: event.target.value })} placeholder="Senha de acesso" /></label>
      </div>
    </div>;
  }

  if (section.key === "overview") {
    const items = section.content ? section.content.split("\n") : [""];
    const updateItem = (index: number, value: string) => onChange(items.map((item, itemIndex) => itemIndex === index ? value : item).join("\n"));
    const removeItem = (index: number) => onChange(items.filter((_, itemIndex) => itemIndex !== index).join("\n"));
    return <div className={styles.editorCard}>
      <div className={styles.contentEyebrow}>SEÇÃO DO DOCUMENTO</div>
      <h2>{DOCUMENT_SECTION_LABELS[section.key]}</h2>
      <p>Cada linha será apresentada como um item da lista no documento.</p>
      <div className={styles.structuredList}>
        {items.map((item, index) => <div className={styles.structuredItem} key={index}>
          <span className={styles.listMarker} aria-hidden="true">•</span>
          <input value={item} onChange={(event) => updateItem(index, event.target.value)} placeholder="Novo item da visão geral" />
          <button type="button" onClick={() => removeItem(index)} title="Remover item"><Trash2 size={14} /></button>
        </div>)}
      </div>
      <button type="button" className={styles.addStructuredItem} onClick={() => onChange([...items, ""].join("\n"))}><Plus size={14} /> Adicionar item</button>
    </div>;
  }

  if (section.key === "limitations") {
    const items = section.content ? section.content.split("\n").map((line) => ({
      checked: /^\s*\[x\]\s*/i.test(line),
      text: line.replace(/^\s*\[(?:x| )\]\s*/i, ""),
    })) : [{ checked: false, text: "" }];
    const saveItems = (next: typeof items) => onChange(next.map((item) => `[${item.checked ? "x" : " "}] ${item.text}`).join("\n"));
    return <div className={styles.editorCard}>
      <div className={styles.contentEyebrow}>SEÇÃO DO DOCUMENTO</div>
      <h2>{DOCUMENT_SECTION_LABELS[section.key]}</h2>
      <p>Marque uma restrição para sinalizá-la como atendida e riscá-la no documento.</p>
      <div className={styles.structuredList}>
        {items.map((item, index) => <div className={`${styles.structuredItem} ${item.checked ? styles.checkedItem : ""}`} key={index}>
          <input type="checkbox" checked={item.checked} onChange={(event) => saveItems(items.map((current, itemIndex) => itemIndex === index ? { ...current, checked: event.target.checked } : current))} />
          <input value={item.text} onChange={(event) => saveItems(items.map((current, itemIndex) => itemIndex === index ? { ...current, text: event.target.value } : current))} placeholder="Nova limitação ou restrição" />
          <button type="button" onClick={() => saveItems(items.filter((_, itemIndex) => itemIndex !== index))} title="Remover item"><Trash2 size={14} /></button>
        </div>)}
      </div>
      <button type="button" className={styles.addStructuredItem} onClick={() => saveItems([...items, { checked: false, text: "" }])}><Plus size={14} /> Adicionar restrição</button>
    </div>;
  }

  return <div className={styles.editorCard}>
    <div className={styles.contentEyebrow}>SEÇÃO DO DOCUMENTO</div>
    <h2>{DOCUMENT_SECTION_LABELS[section.key]}</h2>
    <p>Conteúdo exclusivo do rascunho Robot Center.</p>
    <label><span>Conteúdo</span><textarea value={section.content} onChange={(event) => onChange(event.target.value)} rows={14} placeholder="Escreva o conteúdo desta seção..." /></label>
  </div>;
}

function RequirementEditor({ requirement, requirements, blocks, onChange, onMove, onAddChild, onDelete, onAddBlock, onUpdateBlock, onDeleteBlock, onImage, onReplaceImage, onAddCaption, onUpdateImageMetadata, onReorderBlocks, uploadingMessages, imageFeedback }: {
  requirement: DocumentationRequirement; requirements: DocumentationRequirement[]; blocks: DocumentationBlock[];
  onChange: (content: string) => void; onMove: (direction: -1 | 1) => void; onAddChild: () => void; onDelete: () => void;
  onAddBlock: (type: "text" | "note") => void; onUpdateBlock: (block: DocumentationBlock, content: string) => void; onDeleteBlock: (block: DocumentationBlock) => void;
  onImage: (file: File) => void; onReplaceImage: (block: DocumentationBlock, file: File) => void; onAddCaption: (block: DocumentationBlock) => void;
  onUpdateImageMetadata: (block: DocumentationBlock, alignment: ImageAlignment, sizePreset: ImageSizePreset) => void;
  onReorderBlocks: (ids: string[]) => void; uploadingMessages: string[]; imageFeedback: string;
}) {
  const code = formatRequirementCode(requirement, requirements);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const visibleBlocks = blocks.filter((block) => block.type !== "caption" || !block.relatedBlockId);

  const groupedBlockIds = () => {
    const groups: string[][] = [];
    const consumed = new Set<string>();
    const blockIds = new Set(blocks.map((item) => item.id));
    const linkedCaptionIds = new Set(blocks
      .filter((item) => item.type === "caption" && item.relatedBlockId && blockIds.has(item.relatedBlockId))
      .map((item) => item.id));

    for (const item of blocks) {
      if (consumed.has(item.id)) continue;
      if (linkedCaptionIds.has(item.id)) continue;
      const group = [item.id];
      if (item.type === "image") {
        const caption = blocks.find((candidate) => candidate.type === "caption"
          && candidate.relatedBlockId === item.id
          && !consumed.has(candidate.id));
        if (caption) { group.push(caption.id); consumed.add(caption.id); }
      }
      consumed.add(item.id);
      groups.push(group);
    }

    // Uma legenda órfã continua participando da ordenação para que o payload
    // sempre represente exatamente o conjunto persistido no banco.
    for (const item of blocks) {
      if (!consumed.has(item.id)) {
        consumed.add(item.id);
        groups.push([item.id]);
      }
    }
    return groups;
  };

  const moveDocumentBlock = (block: DocumentationBlock, direction: -1 | 1) => {
    const groups = groupedBlockIds();
    const groupIndex = groups.findIndex((group) => group.includes(block.id));
    const target = groupIndex + direction;
    if (groupIndex < 0 || target < 0 || target >= groups.length) return;
    [groups[groupIndex], groups[target]] = [groups[target], groups[groupIndex]];
    onReorderBlocks(groups.flat());
  };

  const dropDocumentBlock = (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    const groups = groupedBlockIds();
    const sourceIndex = groups.findIndex((group) => group.includes(sourceId));
    const targetIndex = groups.findIndex((group) => group.includes(targetId));
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [sourceGroup] = groups.splice(sourceIndex, 1);
    groups.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, sourceGroup);
    onReorderBlocks(groups.flat());
  };

  const dropFile = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingFile(false);
    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
    if (file) onImage(file);
  };
  return <div className={styles.editorCard}>
    <div className={styles.requirementHeader}>
      <div><div className={styles.contentEyebrow}>{requirement.category === "documentacao" ? "REQUISITO FUNCIONAL" : "REQUISITO NÃO FUNCIONAL"}</div><h2>{code}</h2></div>
      <div className={styles.iconActions}>
        <button type="button" onClick={() => onMove(-1)} title="Mover para cima"><ArrowUp size={15} /></button>
        <button type="button" onClick={() => onMove(1)} title="Mover para baixo"><ArrowDown size={15} /></button>
        {!requirement.parentId && <button type="button" onClick={onAddChild} title="Adicionar sub-regra"><Plus size={15} /></button>}
        <button type="button" onClick={onDelete} title="Excluir do cadastro"><Trash2 size={15} /></button>
      </div>
    </div>
    <div className={styles.linkedHint}><Link2 size={13} /> Vinculada ao cadastro do robô</div>
    <label><span>Regra</span><textarea value={requirement.content} onChange={(event) => onChange(event.target.value)} rows={6} /></label>

    <div className={styles.documentContentHeader}>
      <div><h3>Conteúdo da documentação</h3><p>Estes blocos não alteram o texto da regra.</p></div>
      <div><button type="button" onClick={() => onAddBlock("text")}><NotebookPen size={14} /> Texto</button><button type="button" onClick={() => onAddBlock("note")}><StickyNote size={14} /> Nota</button><button type="button" onClick={() => fileInputRef.current?.click()}><ImageIcon size={14} /> Imagem</button></div>
    </div>
    <input ref={fileInputRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={(event) => {
      const file = event.target.files?.[0];
      if (file) onImage(file);
      event.currentTarget.value = "";
    }} />
    {blocks.length === 0 && <div className={styles.emptyBlocks}>Nenhum conteúdo documental complementar.</div>}
    {visibleBlocks.map((block) => block.type === "image" ? (
      <ImageBlock key={block.id} block={block} caption={blocks.find((item) => item.type === "caption" && item.relatedBlockId === block.id)} onReplace={onReplaceImage} onCaption={onAddCaption} onUpdateMetadata={onUpdateImageMetadata} onUpdateBlock={onUpdateBlock} onDelete={onDeleteBlock} onMove={(direction) => moveDocumentBlock(block, direction)} onDropBlock={dropDocumentBlock} />
    ) : (
      <div key={block.id} className={`${styles.block} ${block.type === "note" ? styles.noteBlock : ""}`} draggable onDragStart={(event) => event.dataTransfer.setData("text/robot-documentation-block", block.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        const source = event.dataTransfer.getData("text/robot-documentation-block");
        if (!source || source === block.id) return;
        dropDocumentBlock(source, block.id);
      }}>
        <div><span><GripVertical size={13} /> {block.type === "note" ? "Nota" : block.type === "caption" ? "Legenda" : "Texto complementar"}</span><span className={styles.blockActions}><button type="button" onClick={() => moveDocumentBlock(block, -1)} aria-label="Mover para cima"><ArrowUp size={13} /></button><button type="button" onClick={() => moveDocumentBlock(block, 1)} aria-label="Mover para baixo"><ArrowDown size={13} /></button><button type="button" onClick={() => onDeleteBlock(block)} aria-label="Excluir bloco"><Trash2 size={13} /></button></span></div>
        <textarea rows={5} value={block.content} onChange={(event) => onUpdateBlock(block, event.target.value)} placeholder={block.type === "note" ? "Adicione uma observação documental..." : "Adicione o texto complementar..."} />
      </div>
    ))}
    <div className={`${styles.imageDropzone} ${draggingFile ? styles.dragging : ""}`} onDragEnter={(event) => { event.preventDefault(); setDraggingFile(true); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingFile(false); }} onDrop={dropFile}>
      <Upload size={16} /><span>Solte uma imagem aqui ou cole um print com CTRL + V.</span>
    </div>
    {uploadingMessages.map((message, index) => <div key={`${message}-${index}`} className={styles.uploadState}><LoaderCircle size={14} /> {message}</div>)}
    {imageFeedback && <div className={styles.uploadError} role="alert">{imageFeedback}</div>}
  </div>;
}

function ImageBlock({ block, caption, onReplace, onCaption, onUpdateMetadata, onUpdateBlock, onDelete, onMove, onDropBlock }: {
  block: DocumentationBlock; caption?: DocumentationBlock; onReplace: (block: DocumentationBlock, file: File) => void; onCaption: (block: DocumentationBlock) => void;
  onUpdateMetadata: (block: DocumentationBlock, alignment: ImageAlignment, sizePreset: ImageSizePreset) => void;
  onUpdateBlock: (block: DocumentationBlock, content: string) => void; onDelete: (block: DocumentationBlock) => void; onMove: (direction: -1 | 1) => void;
  onDropBlock: (sourceId: string, targetId: string) => void;
}) {
  const replaceRef = useRef<HTMLInputElement>(null);
  const metadata = block.metadata as Partial<DocumentationImageMetadata>;
  const alignment = metadata.alignment ?? "center";
  const sizePreset = metadata.sizePreset ?? "large";
  return <figure className={styles.imageBlock} data-alignment={alignment} data-size={sizePreset} draggable onDragStart={(event) => event.dataTransfer.setData("text/robot-documentation-block", block.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropBlock(event.dataTransfer.getData("text/robot-documentation-block"), block.id)}>
    <div className={styles.imageToolbar}><span><GripVertical size={13} /> Imagem</span><details><summary aria-label="Ações da imagem"><MoreHorizontal size={16} /></summary><div role="menu">
      <button type="button" role="menuitem" onClick={() => replaceRef.current?.click()}>Substituir</button>
      <button type="button" role="menuitem" onClick={() => onMove(-1)}>Mover para cima</button>
      <button type="button" role="menuitem" onClick={() => onMove(1)}>Mover para baixo</button>
      {!caption && <button type="button" role="menuitem" onClick={() => onCaption(block)}>Adicionar legenda</button>}
      <button type="button" role="menuitem" className={styles.dangerAction} onClick={() => onDelete(block)}>Excluir imagem</button>
    </div></details></div>
    <div className={styles.imagePreview}>{metadata.previewUrl ? <Image src={metadata.previewUrl} alt={caption?.content || metadata.originalFileName || "Imagem da documentação"} width={metadata.width ?? 1200} height={metadata.height ?? 800} sizes="(max-width: 850px) 90vw, 65vw" unoptimized /> : <div>Preview indisponível</div>}</div>
    <div className={styles.imageOptions}>
      <label><span><AlignCenter size={13} /> Alinhamento</span><select value={alignment} onChange={(event) => onUpdateMetadata(block, event.target.value as ImageAlignment, sizePreset)}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
      <label><span>Tamanho</span><select value={sizePreset} onChange={(event) => onUpdateMetadata(block, alignment, event.target.value as ImageSizePreset)}><option value="small">Pequena</option><option value="medium">Média</option><option value="large">Grande</option><option value="full">Largura máxima</option></select></label>
    </div>
    {caption ? <label className={styles.captionEditor}><span>Legenda</span><input value={caption.content} onChange={(event) => onUpdateBlock(caption, event.target.value)} placeholder="Figura — Descreva esta imagem." /></label> : <button type="button" className={styles.addCaption} onClick={() => onCaption(block)}>+ Adicionar legenda</button>}
    <input ref={replaceRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onReplace(block, file); event.currentTarget.value = ""; }} />
  </figure>;
}

function mapBlock(row: { id: string; requirement_id: string | null; section_id?: string | null; related_block_id?: string | null; type: DocumentationBlockType; ordem: number; content: string; metadata: Record<string, unknown> }): DocumentationBlock {
  return { id: row.id, requirementId: row.requirement_id, sectionId: row.section_id ?? null, relatedBlockId: row.related_block_id ?? null, type: row.type, order: row.ordem, content: row.content, metadata: row.metadata ?? {} };
}

function validateImageFile(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Formato não suportado. Use PNG, JPG, JPEG ou WEBP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 10 MB.");
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url); };
    image.onerror = () => { reject(new Error("Não foi possível ler a imagem.")); URL.revokeObjectURL(url); };
    image.src = url;
  });
}
