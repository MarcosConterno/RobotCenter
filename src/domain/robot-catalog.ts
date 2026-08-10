import type { CorBadgeRobo } from "./entities";

export type RobotCatalogKind = "packages" | "stacks" | "queues" | "commands";

export interface RobotCatalogItem {
  id: string;
  name: string;
  active: boolean;
  color?: CorBadgeRobo;
  command?: string;
}

export const ROBOT_CATALOGS: Record<RobotCatalogKind, { label: string; singular: string; table: "robot_packages" | "robot_stacks" | "robot_queues" | "robot_commands" }> = {
  packages: { label: "Pacotes", singular: "Pacote", table: "robot_packages" },
  stacks: { label: "Stacks", singular: "Stack", table: "robot_stacks" },
  queues: { label: "Filas", singular: "Fila", table: "robot_queues" },
  commands: { label: "Commands", singular: "Command", table: "robot_commands" },
};
