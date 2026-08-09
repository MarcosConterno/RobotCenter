import AppShell from "@/components/layout/AppShell";
import RobotDocumentationEditor from "@/components/robos/documentation/RobotDocumentationEditor";
import { createClient } from "@/lib/supabase/server";
import type {
  DocumentSectionKey,
  DocumentationBlockType,
  RequirementCategory,
  RobotCenterDocumentSchema,
} from "@/domain/robot-center-documentation";

function roleCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(roleCodes);
  if (value && typeof value === "object" && "codigo" in value && typeof value.codigo === "string") return [value.codigo];
  return [];
}

export default async function RobotDocumentationEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <Denied />;

  const [{ data: userRoles }, { data: robot }] = await Promise.all([
    supabase.from("user_roles").select("roles(codigo)").eq("user_id", user.id),
    supabase.from("robos")
      .select("id,nome,court_name,sistema,updated_at,clientes(nome)")
      .eq("id", id).is("deleted_at", null).maybeSingle(),
  ]);
  const isAdmin = [...new Set(userRoles?.flatMap((item) => roleCodes(item.roles)) ?? [])].includes("admin");
  if (!isAdmin || !robot) return <Denied message="Robô não encontrado ou acesso negado." />;

  const { data: initialized, error: initializeError } = await supabase
    .rpc("initialize_robot_center_documentation", { target_robot_id: id });
  if (initializeError || !initialized?.[0]) {
    return <Denied message={initializeError?.message ?? "Não foi possível preparar o rascunho."} />;
  }
  const { documentation_id: documentationId, draft_id: draftId } = initialized[0];

  const [{ data: draft }, { data: sections }, { data: requirements }, { data: blocks }, { data: currentVersion }] = await Promise.all([
    supabase.from("robot_center_documentation_drafts").select("revision,updated_at").eq("id", draftId).single(),
    supabase.from("robot_center_documentation_sections").select("id,section_key,ordem,content").eq("draft_id", draftId).order("ordem"),
    supabase.from("regras_robo").select("id,robo_id,parent_id,tipo,ordem,descricao")
      .eq("robo_id", id).is("deleted_at", null).order("ordem"),
    supabase.from("robot_center_documentation_blocks")
      .select("id,requirement_id,section_id,related_block_id,type,ordem,content,metadata")
      .eq("draft_id", draftId).is("deleted_at", null).order("ordem"),
    supabase.from("robot_center_documentation_versions").select("version")
      .eq("documentation_id", documentationId).eq("status", "published")
      .order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const mappedBlocks = await Promise.all((blocks ?? []).map(async (item) => {
    const baseMetadata = typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)
      ? item.metadata as Record<string, unknown>
      : {};
    const storagePath = typeof baseMetadata.storagePath === "string" ? baseMetadata.storagePath : null;
    let previewUrl: string | undefined;
    if (item.type === "image" && storagePath) {
      const { data } = await supabase.storage.from("robot-documentation").createSignedUrl(storagePath, 3600);
      previewUrl = data?.signedUrl;
    }
    return {
      id: item.id,
      requirementId: item.requirement_id,
      sectionId: item.section_id,
      relatedBlockId: item.related_block_id,
      type: item.type as DocumentationBlockType,
      order: item.ordem,
      content: item.content,
      metadata: previewUrl ? { ...baseMetadata, previewUrl } : baseMetadata,
    };
  }));

  const clientRelation = robot.clientes;
  const client = Array.isArray(clientRelation) ? clientRelation[0] : clientRelation;
  const mappedRequirements = (requirements ?? []).map((item) => ({
    id: item.id,
    robotId: item.robo_id,
    parentId: item.parent_id,
    category: item.tipo as RequirementCategory,
    order: item.ordem,
    content: item.descricao,
  }));
  const schema: RobotCenterDocumentSchema = {
    documentationId,
    draftId,
    status: "draft",
    revision: draft?.revision ?? 0,
    robot: {
      id: robot.id,
      name: robot.nome,
      technicalName: robot.court_name,
      system: robot.sistema,
      clientName: client?.nome ?? null,
    },
    sections: (sections ?? []).map((item) => ({
      id: item.id,
      key: item.section_key as DocumentSectionKey,
      order: item.ordem,
      content: item.content,
    })),
    requirements: mappedRequirements.filter((item) => item.category === "documentacao"),
    nonFunctionalRequirements: mappedRequirements.filter((item) => item.category === "fora_documentacao"),
    blocks: mappedBlocks,
    metadata: { updatedAt: draft?.updated_at ?? robot.updated_at, schemaVersion: 1, currentVersion: currentVersion?.version ?? null },
  };

  return <AppShell title="Documentação Robot Center"><RobotDocumentationEditor initialSchema={schema} /></AppShell>;
}

function Denied({ message = "Acesso negado. Somente Admin pode editar a Documentação Robot Center." }: { message?: string }) {
  return <AppShell title="Documentação Robot Center"><div style={{ margin: 24, padding: 18, border: "1px solid var(--danger)", borderRadius: 12, color: "var(--danger)", background: "var(--card)" }}>{message}</div></AppShell>;
}
