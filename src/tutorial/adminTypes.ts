export type TutorialPlacement = "top" | "right" | "bottom" | "left";

export interface TutorialDraftStep {
  id: string;
  pageKey: string;
  targetKey: string;
  title: string;
  description: string;
  placement: TutorialPlacement;
  conditionKey: string | null;
  enabled: boolean;
}

export interface TutorialEditorData {
  id: string;
  key: string;
  name: string;
  status: "draft" | "published" | "inactive";
  audienceRoleId: string;
  audienceRoleCode: string;
  audienceRoleName: string;
  currentVersion: number | null;
  draftRevision: number;
  steps: TutorialDraftStep[];
  versions: Array<{ id: string; version: number; publishedAt: string; publishedBy: string }>;
}
