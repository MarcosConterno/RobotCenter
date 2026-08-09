export const DOCUMENT_SECTION_KEYS = [
  "objective",
  "reference_materials",
  "overview",
  "limitations",
  "scope",
  "execution_errors",
] as const;

export type DocumentSectionKey = (typeof DOCUMENT_SECTION_KEYS)[number];
export type RequirementCategory = "documentacao" | "fora_documentacao";
export type DocumentationBlockType = "text" | "image" | "caption" | "note" | "page_break";
export type ImageSizePreset = "small" | "medium" | "large" | "full";
export type ImageAlignment = "left" | "center" | "right";

export interface DocumentationImageMetadata {
  storagePath: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  originalFileName: string;
  fileSize: number;
  width: number;
  height: number;
  sizePreset: ImageSizePreset;
  alignment: ImageAlignment;
  previewUrl?: string;
}

export interface DocumentationRobotReference {
  id: string;
  name: string;
  technicalName: string;
  system: string;
  clientName: string | null;
}

export interface DocumentationSection {
  id: string;
  key: DocumentSectionKey;
  order: number;
  content: string;
}

export interface DocumentationRequirement {
  id: string;
  robotId: string;
  parentId: string | null;
  category: RequirementCategory;
  order: number;
  content: string;
}

export interface DocumentationBlock {
  id: string;
  requirementId: string | null;
  sectionId: string | null;
  relatedBlockId: string | null;
  type: DocumentationBlockType;
  order: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface RobotCenterDocumentSchema {
  documentationId: string;
  draftId: string;
  status: "draft";
  revision: number;
  robot: DocumentationRobotReference;
  sections: DocumentationSection[];
  requirements: DocumentationRequirement[];
  nonFunctionalRequirements: DocumentationRequirement[];
  blocks: DocumentationBlock[];
  metadata: {
    updatedAt: string;
    schemaVersion: 1;
    currentVersion?: number | null;
  };
}

export interface PublishedRequirementSnapshot {
  requirementId: string;
  parentId: string | null;
  generatedCode: string;
  order: number;
  text: string;
}

export interface PublishedDocumentationBlockSnapshot extends DocumentationBlock {
  image?: DocumentationImageMetadata;
}

export interface RobotCenterDocumentationSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  robot: DocumentationRobotReference;
  sections: DocumentationSection[];
  requirements: PublishedRequirementSnapshot[];
  nonFunctionalRequirements: PublishedRequirementSnapshot[];
  blocks: PublishedDocumentationBlockSnapshot[];
  metadata: { draftRevision: number };
}

export function formatDocumentationVersion(version: number) {
  return `v1.${Math.max(0, version - 1)}`;
}

export const DOCUMENT_SECTION_LABELS: Record<DocumentSectionKey, string> = {
  objective: "1.1 Objetivo",
  reference_materials: "1.2 Materiais de Referência",
  overview: "2.1 Visão Geral",
  limitations: "2.2 Limitações e Restrições",
  scope: "3. Escopo do Sistema",
  execution_errors: "Possíveis Erros durante Execução",
};

export function formatRequirementCode(
  requirement: DocumentationRequirement,
  allRequirements: DocumentationRequirement[],
) {
  const prefix = requirement.category === "documentacao" ? "RF" : "RNF";
  const siblings = allRequirements
    .filter((item) => item.category === requirement.category && item.parentId === requirement.parentId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const position = siblings.findIndex((item) => item.id === requirement.id) + 1;
  if (!requirement.parentId) return `${prefix}${String(position).padStart(3, "0")}`;
  const parent = allRequirements.find((item) => item.id === requirement.parentId);
  if (!parent) return `${prefix}${String(position).padStart(3, "0")}`;
  const parentCode = formatRequirementCode(parent, allRequirements);
  return `${parentCode}.${String(position).padStart(3, "0")}`;
}
