export interface BudgetAction {
  id: string;
  code: string;
  category: string;
  description: string;
  defaultHours: number;
  sortOrder: number;
  active: boolean;
}

export interface BudgetActionAlias {
  id: string;
  actionId: string;
  alias: string;
  priority: number;
  active: boolean;
}

export interface BudgetItemDraft {
  id: string;
  actionId: string | null;
  description: string;
  hours: number;
  sourceLine: number | null;
  sourceText: string | null;
  recognized: boolean;
}

export interface BudgetSummary {
  id: string;
  projectName: string;
  source: "manual" | "txt";
  status: BudgetStatus;
  totalHours: number;
  estimatedValue: number;
  clientId: string | null;
  clientName: string | null;
  systemId: string | null;
  systemName: string | null;
  robotId: string | null;
  createdAt: string;
}

export interface BudgetSystem { id: string; name: string; }

export interface BudgetClient {
  id: string;
  name: string;
}

export function normalizeBudgetText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

export function parseBudgetText(content: string, actions: BudgetAction[], aliases: BudgetActionAlias[]) {
  const actionById = new Map(actions.filter((action) => action.active).map((action) => [action.id, action]));
  const orderedAliases = aliases
    .filter((alias) => alias.active && actionById.has(alias.actionId))
    .map((alias) => ({ ...alias, normalized: normalizeBudgetText(alias.alias) }))
    .sort((a, b) => b.priority - a.priority || b.normalized.length - a.normalized.length);

  return content.split(/\r?\n/).flatMap((rawLine, index): BudgetItemDraft[] => {
    const normalized = normalizeBudgetText(rawLine);
    if (!normalized || normalized.startsWith("---")) return [];
    const match = orderedAliases.find((alias) => normalized.includes(alias.normalized));
    const action = match ? actionById.get(match.actionId) : undefined;
    return [{
      id: crypto.randomUUID(),
      actionId: action?.id ?? null,
      description: action?.description ?? "Outra ação não catalogada",
      hours: action?.defaultHours ?? 0,
      sourceLine: index + 1,
      sourceText: rawLine.trim(),
      recognized: Boolean(action),
    }];
  });
}
export const BUDGET_STATUS_VALUES = ["novo", "enviado_comercial", "projeto_rejeitado", "arquivado", "aprovado"] as const;

export const BUDGET_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "enviado_comercial", label: "Enviado ao Comercial" },
  { value: "projeto_rejeitado", label: "Projeto Rejeitado" },
  { value: "arquivado", label: "Arquivado" },
  { value: "aprovado", label: "Aprovado" },
] as const;

export type BudgetStatus = (typeof BUDGET_STATUS_VALUES)[number];
