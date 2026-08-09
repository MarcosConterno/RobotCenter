import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  formatRequirementCode,
  formatDocumentationVersion,
  type DocumentationImageMetadata,
  type DocumentationRequirement,
  type RobotCenterDocumentationSnapshot,
} from "@/domain/robot-center-documentation";
import { generateOfficialDocx } from "@/server/documentation/official-docx-generator.cjs";
import { convertDocxToPdf } from "@/server/documentation/convert-api";
import type { Json } from "@/types/database.types";

export const runtime = "nodejs";
export const maxDuration = 300;

const FILE_BUCKET = "robot-documentation";
const TEMPLATE_BUCKET = "robot-documentation-templates";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function roleCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(roleCodes);
  if (value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string") return [value.codigo];
  return [];
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function safeFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "documentacao";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: robotId } = await params;
  const body = await request.json().catch(() => ({})) as { generationToken?: string };
  if (!body.generationToken || !/^[0-9a-f-]{36}$/i.test(body.generationToken)) {
    return NextResponse.json({ error: "Token de publicação inválido." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const [{ data: userRoles }, { data: robot }] = await Promise.all([
    supabase.from("user_roles").select("roles(codigo)").eq("user_id", user.id),
    supabase.from("robos").select("id,nome,court_name,sistema,updated_at,clientes(nome)")
      .eq("id", robotId).is("deleted_at", null).maybeSingle(),
  ]);
  const isAdmin = [...new Set(userRoles?.flatMap((item) => roleCodes(item.roles)) ?? [])].includes("admin");
  if (!isAdmin || !robot) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  let versionId = "";
  try {
    const { data: started, error: startError } = await supabase.rpc("begin_robot_center_documentation_publication", {
      target_robot_id: robotId,
      target_generation_token: body.generationToken,
    });
    if (startError || !started?.[0]) throw startError ?? new Error("Não foi possível iniciar a publicação.");
    const publication = started[0];
    versionId = publication.version_id;
    const versionNumber = publication.version_number;
    const versionLabel = formatDocumentationVersion(versionNumber);

    const [{ data: draft }, { data: sections }, { data: requirements }, { data: blocks }, templateDownload] = await Promise.all([
      supabase.from("robot_center_documentation_drafts").select("id,revision,updated_at")
        .eq("id", publication.draft_id).single(),
      supabase.from("robot_center_documentation_sections").select("id,section_key,ordem,content")
        .eq("draft_id", publication.draft_id).order("ordem"),
      supabase.from("regras_robo").select("id,robo_id,parent_id,tipo,ordem,descricao")
        .eq("robo_id", robotId).is("deleted_at", null).order("ordem"),
      supabase.from("robot_center_documentation_blocks")
        .select("id,requirement_id,section_id,related_block_id,type,ordem,content,metadata")
        .eq("draft_id", publication.draft_id).is("deleted_at", null).order("ordem"),
      supabase.storage.from(TEMPLATE_BUCKET).download(publication.template_storage_path),
    ]);
    if (!draft) throw new Error("Rascunho da Documentação Robot Center não encontrado.");
    if (templateDownload.error || !templateDownload.data) {
      const storageDetail = templateDownload.error?.message ? ` Motivo: ${templateDownload.error.message}` : "";
      throw new Error(`Template mestre não encontrado no Storage (${publication.template_storage_path}).${storageDetail}`);
    }
    const templateFile = templateDownload.data;
    if (!robot.nome?.trim() || !robot.sistema?.trim()) throw new Error("Nome e sistema do robô são obrigatórios para publicar.");

    const mappedRequirements: DocumentationRequirement[] = (requirements ?? []).map((item) => ({
      id: item.id, robotId: item.robo_id, parentId: item.parent_id,
      category: item.tipo as "documentacao" | "fora_documentacao",
      order: item.ordem, content: item.descricao,
    }));
    const requirementIds = new Set(mappedRequirements.map((item) => item.id));
    for (const item of blocks ?? []) {
      if (item.requirement_id && !requirementIds.has(item.requirement_id)) throw new Error("Existe bloco vinculado a uma regra inválida.");
    }

    const ordered = (category: "documentacao" | "fora_documentacao") => {
      const result: DocumentationRequirement[] = [];
      const append = (parentId: string | null) => {
        mappedRequirements.filter((item) => item.category === category && item.parentId === parentId)
          .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
          .forEach((item) => { result.push(item); append(item.id); });
      };
      append(null);
      return result;
    };
    const functional = ordered("documentacao");
    const nonFunctional = ordered("fora_documentacao");
    if (!functional.length) throw new Error("Cadastre ao menos uma RF antes de publicar o documento oficial.");
    const clientRelation = robot.clientes;
    const client = Array.isArray(clientRelation) ? clientRelation[0] : clientRelation;
    const images = new Map<string, Buffer>();
    const snapshotBlocks: RobotCenterDocumentationSnapshot["blocks"] = [];
    const versionBase = `${robotId}/versions/${versionLabel}`;

    for (const block of blocks ?? []) {
      const metadata = object(block.metadata);
      let image: DocumentationImageMetadata | undefined;
      if (block.type === "image") {
        const draftPath = typeof metadata.storagePath === "string" ? metadata.storagePath : "";
        if (!draftPath) throw new Error(`Imagem ${block.id} sem arquivo associado.`);
        const extension = draftPath.split(".").pop()?.toLowerCase() || "png";
        const versionPath = `${versionBase}/images/${block.id}.${extension}`;
        const { error: copyError } = await supabase.storage.from(FILE_BUCKET).copy(draftPath, versionPath);
        if (copyError && !/already exists|duplicate/i.test(copyError.message)) throw copyError;
        const { data: imageFile, error: imageError } = await supabase.storage.from(FILE_BUCKET).download(versionPath);
        if (imageError || !imageFile) throw imageError ?? new Error(`Imagem ${block.id} não encontrada.`);
        images.set(block.id, Buffer.from(await imageFile.arrayBuffer()));
        image = {
          storagePath: versionPath,
          mimeType: metadata.mimeType as DocumentationImageMetadata["mimeType"],
          originalFileName: String(metadata.originalFileName ?? "imagem"),
          fileSize: Number(metadata.fileSize ?? imageFile.size),
          width: Number(metadata.width), height: Number(metadata.height),
          sizePreset: metadata.sizePreset as DocumentationImageMetadata["sizePreset"],
          alignment: metadata.alignment as DocumentationImageMetadata["alignment"],
        };
        if (!image.width || !image.height || !image.mimeType) throw new Error(`Metadados da imagem ${block.id} são inválidos.`);
      }
      snapshotBlocks.push({
        id: block.id, requirementId: block.requirement_id, sectionId: block.section_id,
        relatedBlockId: block.related_block_id,
        type: block.type as RobotCenterDocumentationSnapshot["blocks"][number]["type"],
        order: block.ordem,
        content: block.content, metadata: image ? { ...metadata, storagePath: image.storagePath } : metadata,
        image,
      });
    }

    const snapshot: RobotCenterDocumentationSnapshot = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      robot: { id: robot.id, name: robot.nome, technicalName: robot.court_name, system: robot.sistema, clientName: client?.nome ?? null },
      sections: (sections ?? []).map((item) => ({
        id: item.id,
        key: item.section_key as RobotCenterDocumentationSnapshot["sections"][number]["key"],
        order: item.ordem,
        content: item.content,
      })),
      requirements: functional.map((item) => ({ requirementId: item.id, parentId: item.parentId, generatedCode: formatRequirementCode(item, mappedRequirements), order: item.order, text: item.content })),
      nonFunctionalRequirements: nonFunctional.map((item) => ({ requirementId: item.id, parentId: item.parentId, generatedCode: formatRequirementCode(item, mappedRequirements), order: item.order, text: item.content })),
      blocks: snapshotBlocks,
      metadata: { draftRevision: draft.revision },
    };

    const template = Buffer.from(await templateFile.arrayBuffer());
    const docx = await generateOfficialDocx({ template, snapshot, images });
    const baseName = `${safeFileName(robot.nome)}-${versionLabel}`;
    const pdf = await convertDocxToPdf(docx, `${baseName}.docx`);
    const docxPath = `${versionBase}/${baseName}.docx`;
    const pdfPath = `${versionBase}/${baseName}.pdf`;
    const { error: docxUploadError } = await supabase.storage.from(FILE_BUCKET).upload(docxPath, docx, { contentType: DOCX_MIME, upsert: true });
    if (docxUploadError) throw docxUploadError;
    const { error: pdfUploadError } = await supabase.storage.from(FILE_BUCKET).upload(pdfPath, pdf, { contentType: "application/pdf", upsert: true });
    if (pdfUploadError) throw pdfUploadError;

    const { error: completeError } = await supabase.rpc("complete_robot_center_documentation_publication", {
      target_version_id: versionId,
      target_generation_token: body.generationToken,
      target_snapshot: snapshot as unknown as Json,
      target_docx_path: docxPath,
      target_pdf_path: pdfPath,
    });
    if (completeError) throw completeError;
    const { data: preview, error: previewError } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(pdfPath, 1800);
    return NextResponse.json({
      ok: true,
      version: versionNumber,
      versionLabel,
      pdfPreviewUrl: previewError ? null : preview?.signedUrl ?? null,
      previewWarning: previewError ? "A versão foi publicada, mas a pré-visualização não pôde ser aberta automaticamente." : null,
    });
  } catch (error) {
    console.error("Falha ao publicar a documentação Robot Center", error);
    if (versionId) await supabase.rpc("fail_robot_center_documentation_publication", {
      target_version_id: versionId,
      target_generation_token: body.generationToken,
      target_error_message: error instanceof Error ? error.message : "Falha desconhecida.",
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar a documentação." }, { status: 500 });
  }
}
