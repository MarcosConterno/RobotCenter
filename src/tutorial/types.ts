export const ONBOARDING_KEY = "robot-center-onboarding";
export const ONBOARDING_VERSION = 2;

export type TutorialStatus = "not_started" | "in_progress" | "completed" | "skipped";

export interface TutorialProgress {
  tutorialKey: string;
  tutorialVersion: number;
  status: TutorialStatus;
  currentStep: number;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface TutorialStepDefinition {
  id: string;
  route: string;
  targets: string[];
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
}

export interface TutorialCapabilities {
  canAccessRobots: boolean;
  canAccessFlows: boolean;
  canAccessSettings: boolean;
}
