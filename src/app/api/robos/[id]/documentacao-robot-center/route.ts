import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DocumentationBlockType, RequirementCategory } from "@/domain/robot-center-documentation";
import type { Json } from "@/types/database.types";

const IMAGE_BUCKET = "robot-documentation";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function roleCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(roleCodes);
  if (value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string") return [value.codigo];
  return [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Não foi possível salvar.";
}

function isCategory(value: unknown): value is RequirementCategory {
  return value === "documentacao" || value === "fora_documentacao";
}

function isBlockType(value: unknown): value is DocumentationBlockType {
  return value === "text" || value === "note" || value === "image" || value === "caption" || value === "page_break";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: robotId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [{ data: userRoles }, { data: robot }] = await Promise.all([
    supabase.from("user_roles").select("roles(codigo)").eq("user_id", user.id),
    supabase.from("robos").select("id").eq("id", robotId).is("deleted_at", null).maybeSingle(),
  ]);
  const isAdmin = [...new Set(userRoles?.flatMap((item) => roleCodes(item.roles)) ?? [])].includes("admin");
  if (!isAdmin || !robot) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { data: documentation } = await supabase
    .from("robot_center_documentations")
    .select("id,robot_center_documentation_drafts(id,revision)")
    .eq("robo_id", robotId)
    .is("deleted_at", null)
    .maybeSingle();
  const draftRelation = documentation?.robot_center_documentation_drafts;
  const draft = Array.isArray(draftRelation) ? draftRelation[0] : draftRelation;
  if (!documentation || !draft) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 409 });
  const { count: generatingVersions } = await supabase.from("robot_center_documentation_versions")
    .select("id", { count: "exact", head: true })
    .eq("documentation_id", documentation.id)
    .eq("status", "generating");
  if (generatingVersions) {
    return NextResponse.json({ error: "A documentação está sendo publicada. Aguarde a conclusão antes de editar." }, { status: 409 });
  }

  const touchDraft = async () => {
    const { error } = await supabase.from("robot_center_documentation_drafts")
      .update({ revision: draft.revision + 1 })
      .eq("id", draft.id);
    if (error) throw error;
  };

  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = text(form.get("action"));
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 });
      if (!IMAGE_MIME_TYPES.has(file.type)) return NextResponse.json({ error: "Formato não suportado. Use PNG, JPG, JPEG ou WEBP." }, { status: 400 });
      if (file.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: "A imagem deve ter no máximo 10 MB." }, { status: 400 });

      const width = Number(form.get("width"));
      const height = Number(form.get("height"));
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        return NextResponse.json({ error: "Não foi possível identificar as dimensões da imagem." }, { status: 400 });
      }

      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const blockId = action === "replace-image" ? text(form.get("blockId")) : crypto.randomUUID();
      const storagePath = `${robotId}/draft/images/${blockId}-${crypto.randomUUID()}.${extension}`;
      const metadata = {
        storagePath,
        mimeType: file.type,
        originalFileName: file.name || `clipboard-${blockId}.${extension}`,
        fileSize: file.size,
        width: Math.round(width),
        height: Math.round(height),
        sizePreset: "large",
        alignment: "center",
      };

      const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      if (action === "upload-image") {
        const requirementId = text(form.get("requirementId"));
        const { data: requirement } = await supabase.from("regras_robo").select("id")
          .eq("id", requirementId).eq("robo_id", robotId).is("deleted_at", null).maybeSingle();
        if (!requirement) {
          await supabase.storage.from(IMAGE_BUCKET).remove([storagePath]);
          return NextResponse.json({ error: "Regra não pertence ao robô." }, { status: 404 });
        }
        const { data, error } = await supabase.rpc("append_robot_documentation_image_block", {
          target_robot_id: robotId,
          target_draft_id: draft.id,
          target_requirement_id: requirementId,
          target_block_id: blockId,
          target_metadata: metadata as Json,
        });
        if (error) {
          await supabase.storage.from(IMAGE_BUCKET).remove([storagePath]);
          throw error;
        }
        const { data: signed } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(storagePath, 3600);
        await touchDraft();
        const created = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
        return NextResponse.json({ block: { ...created, metadata: { ...metadata, previewUrl: signed?.signedUrl } } });
      }

      if (action === "replace-image") {
        const { data: existing } = await supabase.from("robot_center_documentation_blocks")
          .select("id,metadata").eq("id", blockId).eq("draft_id", draft.id).eq("type", "image")
          .is("deleted_at", null).maybeSingle();
        if (!existing) {
          await supabase.storage.from(IMAGE_BUCKET).remove([storagePath]);
          return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
        }
        const currentMetadata = typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
          ? existing.metadata as Record<string, unknown> : {};
        const nextMetadata = {
          ...metadata,
          sizePreset: currentMetadata.sizePreset ?? metadata.sizePreset,
          alignment: currentMetadata.alignment ?? metadata.alignment,
        };
        const { error } = await supabase.from("robot_center_documentation_blocks")
          .update({ metadata: nextMetadata as Json }).eq("id", blockId).eq("draft_id", draft.id);
        if (error) {
          await supabase.storage.from(IMAGE_BUCKET).remove([storagePath]);
          throw error;
        }
        const oldPath = typeof currentMetadata.storagePath === "string" ? currentMetadata.storagePath : null;
        const { count: publishedReferences } = await supabase.from("robot_center_documentation_versions")
          .select("id", { count: "exact", head: true }).eq("documentation_id", documentation.id);
        if (oldPath && !publishedReferences) await supabase.storage.from(IMAGE_BUCKET).remove([oldPath]);
        const { data: signed } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(storagePath, 3600);
        await touchDraft();
        return NextResponse.json({ metadata: { ...nextMetadata, previewUrl: signed?.signedUrl } });
      }

      await supabase.storage.from(IMAGE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "Ação de upload desconhecida." }, { status: 400 });
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const action = text(body?.action);
    if (!body) return NextResponse.json({ error: "Payload inválido." }, { status: 400 });

    if (action === "save-section") {
      const sectionId = text(body.sectionId);
      const { error } = await supabase.from("robot_center_documentation_sections")
        .update({ content: text(body.content) })
        .eq("id", sectionId)
        .eq("draft_id", draft.id);
      if (error) throw error;
      await touchDraft();
      return NextResponse.json({ ok: true });
    }

    if (action === "create-requirement") {
      if (!isCategory(body.category)) return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
      const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
      if (parentId) {
        const { data: parent } = await supabase.from("regras_robo").select("id,tipo,parent_id")
          .eq("id", parentId).eq("robo_id", robotId).is("deleted_at", null).maybeSingle();
        if (!parent || parent.tipo !== body.category || parent.parent_id) {
          return NextResponse.json({ error: "Regra pai inválida." }, { status: 400 });
        }
      }
      let orderQuery = supabase.from("regras_robo").select("ordem")
        .eq("robo_id", robotId).eq("tipo", body.category).is("deleted_at", null);
      orderQuery = parentId ? orderQuery.eq("parent_id", parentId) : orderQuery.is("parent_id", null);
      const { data: siblings } = await orderQuery.order("ordem", { ascending: false }).limit(1);
      const { data, error } = await supabase.from("regras_robo").insert({
        robo_id: robotId,
        descricao: text(body.content).trim() || "Nova regra",
        ordem: (siblings?.[0]?.ordem ?? -1) + 1,
        tipo: body.category,
        parent_id: parentId,
      }).select("id,robo_id,parent_id,tipo,ordem,descricao").single();
      if (error) throw error;
      return NextResponse.json({ requirement: data });
    }

    if (action === "save-requirement") {
      const requirementId = text(body.requirementId);
      const content = text(body.content).trim();
      if (!content) return NextResponse.json({ error: "A regra não pode ficar vazia." }, { status: 400 });
      const { data, error } = await supabase.from("regras_robo")
        .update({ descricao: content })
        .eq("id", requirementId).eq("robo_id", robotId).is("deleted_at", null)
        .select("id").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Regra não pertence ao robô." }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (action === "reorder-requirements") {
      if (!isCategory(body.category) || !Array.isArray(body.orderedIds) || !body.orderedIds.every((item) => typeof item === "string")) {
        return NextResponse.json({ error: "Ordenação inválida." }, { status: 400 });
      }
      const { error } = await supabase.rpc("reorder_robot_requirements", {
        target_robot_id: robotId,
        target_type: body.category,
        target_parent_id: typeof body.parentId === "string" && body.parentId ? body.parentId : null,
        ordered_ids: body.orderedIds,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "delete-requirement") {
      const { error } = await supabase.rpc("archive_robot_requirement", {
        target_robot_id: robotId,
        target_requirement_id: text(body.requirementId),
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "create-block") {
      if (!isBlockType(body.blockType) || !["text", "note"].includes(body.blockType)) {
        return NextResponse.json({ error: "Tipo de bloco indisponível nesta etapa." }, { status: 400 });
      }
      const requirementId = text(body.requirementId);
      const { data: requirement } = await supabase.from("regras_robo").select("id")
        .eq("id", requirementId).eq("robo_id", robotId).is("deleted_at", null).maybeSingle();
      if (!requirement) return NextResponse.json({ error: "Regra não pertence ao robô." }, { status: 404 });
      const { data: lastBlocks } = await supabase.from("robot_center_documentation_blocks").select("ordem")
        .eq("draft_id", draft.id).eq("requirement_id", requirementId).is("deleted_at", null)
        .order("ordem", { ascending: false }).limit(1);
      const { data, error } = await supabase.from("robot_center_documentation_blocks").insert({
        draft_id: draft.id,
        requirement_id: requirementId,
        type: body.blockType,
        ordem: (lastBlocks?.[0]?.ordem ?? -1) + 1,
        content: "",
      }).select("id,requirement_id,section_id,related_block_id,type,ordem,content,metadata").single();
      if (error) throw error;
      await touchDraft();
      return NextResponse.json({ block: data });
    }

    if (action === "save-block") {
      const { error } = await supabase.from("robot_center_documentation_blocks")
        .update({ content: text(body.content) })
        .eq("id", text(body.blockId)).eq("draft_id", draft.id).is("deleted_at", null);
      if (error) throw error;
      await touchDraft();
      return NextResponse.json({ ok: true });
    }

    if (action === "save-image-metadata") {
      const alignment = text(body.alignment);
      const sizePreset = text(body.sizePreset);
      if (!["left", "center", "right"].includes(alignment) || !["small", "medium", "large", "full"].includes(sizePreset)) {
        return NextResponse.json({ error: "Configuração de imagem inválida." }, { status: 400 });
      }
      const { data: current } = await supabase.from("robot_center_documentation_blocks").select("metadata")
        .eq("id", text(body.blockId)).eq("draft_id", draft.id).eq("type", "image").is("deleted_at", null).maybeSingle();
      if (!current) return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
      const currentMetadata = typeof current.metadata === "object" && current.metadata && !Array.isArray(current.metadata)
        ? current.metadata as Record<string, unknown> : {};
      const { error } = await supabase.from("robot_center_documentation_blocks")
        .update({ metadata: { ...currentMetadata, alignment, sizePreset } as Json })
        .eq("id", text(body.blockId)).eq("draft_id", draft.id);
      if (error) throw error;
      await touchDraft();
      return NextResponse.json({ ok: true });
    }

    if (action === "add-caption") {
      const imageId = text(body.imageId);
      const { data: image } = await supabase.from("robot_center_documentation_blocks")
        .select("id,requirement_id,ordem").eq("id", imageId).eq("draft_id", draft.id)
        .eq("type", "image").is("deleted_at", null).maybeSingle();
      if (!image?.requirement_id) return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
      const { data: existingCaption } = await supabase.from("robot_center_documentation_blocks")
        .select("id,requirement_id,section_id,related_block_id,type,ordem,content,metadata")
        .eq("related_block_id", imageId).eq("type", "caption").is("deleted_at", null).maybeSingle();
      if (existingCaption) return NextResponse.json({ block: existingCaption });
      const { data: currentBlocks } = await supabase.from("robot_center_documentation_blocks").select("id,ordem")
        .eq("draft_id", draft.id).eq("requirement_id", image.requirement_id).is("deleted_at", null).order("ordem");
      const { data: caption, error } = await supabase.from("robot_center_documentation_blocks").insert({
        draft_id: draft.id,
        requirement_id: image.requirement_id,
        related_block_id: imageId,
        type: "caption",
        ordem: currentBlocks?.length ? currentBlocks[currentBlocks.length - 1].ordem + 1 : 0,
        content: "",
      }).select("id,requirement_id,section_id,related_block_id,type,ordem,content,metadata").single();
      if (error) throw error;
      const ids = [...(currentBlocks ?? []).map((item) => item.id)];
      const imageIndex = ids.indexOf(imageId);
      ids.splice(imageIndex + 1, 0, caption.id);
      const { error: reorderError } = await supabase.rpc("reorder_robot_documentation_blocks", {
        target_robot_id: robotId, target_requirement_id: image.requirement_id, ordered_ids: ids,
      });
      if (reorderError) throw reorderError;
      await touchDraft();
      return NextResponse.json({ block: { ...caption, ordem: imageIndex + 1 } });
    }

    if (action === "reorder-blocks") {
      if (!Array.isArray(body.orderedIds) || !body.orderedIds.every((item) => typeof item === "string")) {
        return NextResponse.json({ error: "Ordenação inválida." }, { status: 400 });
      }
      const requirementId = text(body.requirementId);
      const { error } = await supabase.rpc("reorder_robot_documentation_blocks", {
        target_robot_id: robotId, target_requirement_id: requirementId, ordered_ids: body.orderedIds,
      });
      if (error) throw error;
      await touchDraft();
      return NextResponse.json({ ok: true });
    }

    if (action === "delete-block") {
      const blockId = text(body.blockId);
      const { data: target } = await supabase.from("robot_center_documentation_blocks")
        .select("id,type,requirement_id,metadata").eq("id", blockId).eq("draft_id", draft.id)
        .is("deleted_at", null).maybeSingle();
      if (!target) return NextResponse.json({ error: "Bloco não encontrado." }, { status: 404 });
      const deletedAt = new Date().toISOString();
      const { error } = await supabase.from("robot_center_documentation_blocks")
        .update({ deleted_at: deletedAt, deleted_by: user.id })
        .or(`id.eq.${blockId},related_block_id.eq.${blockId}`)
        .eq("draft_id", draft.id).is("deleted_at", null);
      if (error) throw error;
      if (target.requirement_id) {
        const { data: remaining } = await supabase.from("robot_center_documentation_blocks").select("id")
          .eq("draft_id", draft.id).eq("requirement_id", target.requirement_id).is("deleted_at", null).order("ordem");
        const { error: reorderError } = await supabase.rpc("reorder_robot_documentation_blocks", {
          target_robot_id: robotId, target_requirement_id: target.requirement_id,
          ordered_ids: (remaining ?? []).map((item) => item.id),
        });
        if (reorderError) throw reorderError;
      }
      if (target.type === "image") {
        const metadata = typeof target.metadata === "object" && target.metadata && !Array.isArray(target.metadata)
          ? target.metadata as Record<string, unknown> : {};
        const storagePath = typeof metadata.storagePath === "string" ? metadata.storagePath : null;
        const { count: publishedReferences } = await supabase.from("robot_center_documentation_versions")
          .select("id", { count: "exact", head: true }).eq("documentation_id", documentation.id);
        if (storagePath && !publishedReferences) await supabase.storage.from(IMAGE_BUCKET).remove([storagePath]);
      }
      await touchDraft();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (error) {
    console.error("Falha ao salvar a documentação Robot Center", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: robotId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [{ data: userRoles }, { data: documentation }] = await Promise.all([
    supabase.from("user_roles").select("roles(codigo)").eq("user_id", user.id),
    supabase.from("robot_center_documentations").select("id")
      .eq("robo_id", robotId).is("deleted_at", null).maybeSingle(),
  ]);
  const isAdmin = [...new Set(userRoles?.flatMap((item) => roleCodes(item.roles)) ?? [])].includes("admin");
  const isMaster = [...new Set(userRoles?.flatMap((item) => roleCodes(item.roles)) ?? [])].includes("master");
  if (!isAdmin || !isMaster) {
    return NextResponse.json({ error: "Somente o usuário autorizado pode excluir esta documentação." }, { status: 403 });
  }
  if (!documentation) return NextResponse.json({ error: "Documentação não encontrada." }, { status: 404 });

  const { count: generatingVersions, error: generationError } = await supabase
    .from("robot_center_documentation_versions")
    .select("id", { count: "exact", head: true })
    .eq("documentation_id", documentation.id)
    .eq("status", "generating");
  if (generationError) return NextResponse.json({ error: errorMessage(generationError) }, { status: 500 });
  if (generatingVersions) {
    return NextResponse.json({ error: "Aguarde a publicação em andamento antes de excluir a documentação." }, { status: 409 });
  }

  const deletedAt = new Date().toISOString();
  const { error } = await supabase.from("robot_center_documentations")
    .update({ deleted_at: deletedAt, deleted_by: user.id })
    .eq("id", documentation.id)
    .is("deleted_at", null);
  if (error) {
    console.error("Falha ao excluir a documentação Robot Center", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
