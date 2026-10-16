export function relationValue(value: unknown, property: string): unknown {
  if (typeof value !== "object" || value === null || !(property in value)) return undefined;
  return (value as Record<string, unknown>)[property];
}

export function relationString(value: unknown, property: string, fallback: string): string {
  const field = relationValue(value, property);
  return typeof field === "string" ? field : fallback;
}

export function extractRelationRows<T>(
  rows: unknown,
  property: string,
  extract: (relation: unknown) => T[],
): T[] {
  const sourceRows: unknown[] = Array.isArray(rows) ? rows : [];
  return sourceRows.flatMap((row) => extract(relationValue(row, property)));
}
