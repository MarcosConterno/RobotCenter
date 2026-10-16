import type { PoolClient } from "pg";

import type { DataFilter, DataRequest } from "./client-core";

const TABLES = new Set([
  "alteracoes_robo", "budget_action_aliases", "budget_action_catalog", "budget_items", "budgets",
  "clientes", "dashboard_chart_preferences", "flow_edges", "flow_nodes", "flow_versions", "flows",
  "permissions", "personal_meetings", "personal_notes", "personal_page_flows", "personal_page_preferences",
  "personal_tasks", "profiles", "publicacoes", "regras_robo", "robos", "robot_center_documentation_blocks",
  "robot_center_documentation_drafts", "robot_center_documentation_sections", "robot_center_documentation_templates",
  "robot_center_documentation_versions", "robot_center_documentations", "robot_commands", "robot_packages",
  "robot_queues", "robot_stacks", "robot_systems", "robot_uploaded_documents", "role_permissions", "roles",
  "stack_request_history", "stack_requests", "tutorial_drafts", "tutorial_steps", "tutorial_versions", "tutorials",
  "user_roles", "user_tutorial_progress",
]);

const RPCS = new Set([
  "append_robot_documentation_image_block", "archive_client_with_user_reassignment", "archive_robot_requirement",
  "begin_robot_center_documentation_publication", "complete_robot_center_documentation_publication", "create_tutorial",
  "fail_robot_center_documentation_publication", "get_flow_creator_name", "publish_flow", "publish_tutorial",
  "reorder_robot_documentation_blocks", "reorder_robot_requirements", "save_budget", "save_tutorial_draft",
  "update_flow_metadata", "update_robot_capacity", "update_role_permission_matrix",
]);

interface ProjectionColumn {
  column: string;
  alias?: string;
}

interface ProjectionRelation {
  name: string;
  alias: string;
  foreignKey?: string;
  projection: Projection;
}

interface Projection {
  all: boolean;
  columns: ProjectionColumn[];
  relations: ProjectionRelation[];
}

interface ForeignKeyRelation {
  constraint_name: string;
  child_table: string;
  child_column: string;
  parent_table: string;
  parent_column: string;
}

function quoteIdentifier(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Identificador PostgreSQL inválido: ${value}`);
  }
  return `"${value}"`;
}

function assertTable(table: string) {
  if (!TABLES.has(table)) throw new Error(`Tabela não disponível pela API: ${table}`);
  return `public.${quoteIdentifier(table)}`;
}

function splitTopLevel(value: string) {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      items.push(value.slice(start, index).trim());
      start = index + 1;
    }
    if (depth < 0) throw new Error("Projeção de dados inválida.");
  }
  if (depth !== 0) throw new Error("Projeção de dados inválida.");
  const last = value.slice(start).trim();
  if (last) items.push(last);
  return items;
}

function parseProjection(value = "*"): Projection {
  const projection: Projection = { all: false, columns: [], relations: [] };
  for (const item of splitTopLevel(value)) {
    if (item === "*") {
      projection.all = true;
      continue;
    }

    const open = item.indexOf("(");
    if (open >= 0 && item.endsWith(")")) {
      const relationToken = item.slice(0, open).trim();
      const nestedSelection = item.slice(open + 1, -1);
      const [aliasOrName, path = ""] = relationToken.includes(":")
        ? relationToken.split(/:([\s\S]*)/).slice(0, 2)
        : [relationToken, relationToken];
      const [relationName, foreignKey] = path.split("!");
      projection.relations.push({
        name: relationName,
        alias: aliasOrName,
        foreignKey: foreignKey || undefined,
        projection: parseProjection(nestedSelection),
      });
      continue;
    }

    const [alias, column] = item.includes(":") ? item.split(/:([\s\S]*)/).slice(0, 2) : [item, item];
    projection.columns.push({ column, alias: alias === column ? undefined : alias });
  }
  return projection;
}

function pushValue(parameters: unknown[], value: unknown) {
  parameters.push(value);
  return `$${parameters.length}`;
}

function buildWhere(
  filters: DataFilter[] = [],
  parameters: unknown[],
  tableAlias?: string,
  orGroups: DataFilter[][] = [],
) {
  const prefix = tableAlias ? `${quoteIdentifier(tableAlias)}.` : "";
  const buildClause = (filter: DataFilter) => {
    const column = `${prefix}${quoteIdentifier(filter.column)}`;
    let clause: string;
    if (filter.operator === "in") {
      if (!Array.isArray(filter.value)) throw new Error("O filtro IN exige uma lista.");
      if (filter.value.length === 0) clause = filter.negated ? "TRUE" : "FALSE";
      else {
        const values = filter.value.map((value) => pushValue(parameters, value));
        clause = `${column} ${filter.negated ? "NOT IN" : "IN"} (${values.join(", ")})`;
        return clause;
      }
    } else if (filter.operator === "is") {
      if (filter.value !== null && typeof filter.value !== "boolean") {
        throw new Error("O filtro IS aceita apenas null ou boolean.");
      }
      clause = filter.value === null
        ? `${column} IS ${filter.negated ? "NOT " : ""}NULL`
        : `${column} IS ${filter.negated ? "NOT " : ""}${filter.value ? "TRUE" : "FALSE"}`;
      return clause;
    } else if ((filter.operator === "eq" || filter.operator === "neq") && filter.value === null) {
      clause = `${column} IS ${filter.operator === "neq" ? "NOT " : ""}NULL`;
      return filter.negated ? `NOT (${clause})` : clause;
    } else {
      const operators: Record<string, string> = {
        eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", contains: "@>",
      };
      const operator = operators[filter.operator];
      if (!operator) throw new Error(`Operador de filtro não suportado: ${filter.operator}`);
      const parameter = pushValue(parameters, filter.value);
      clause = filter.operator === "contains"
        ? `${column} @> ${parameter}::jsonb`
        : `${column} ${operator} ${parameter}`;
    }
    return filter.negated ? `NOT (${clause})` : clause;
  };
  const clauses = filters.map(buildClause);
  for (const group of orGroups) {
    if (group.length) clauses.push(`(${group.map(buildClause).join(" OR ")})`);
  }
  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
}

async function getForeignKey(
  client: PoolClient,
  sourceTable: string,
  targetTable: string,
  constraintName?: string,
) {
  // information_schema oculta FKs de roles sem privilégios REFERENCES.
  // Os catálogos pg_* continuam visíveis para authenticated e refletem as FKs reais.
  const result = await client.query<ForeignKeyRelation>(
    `SELECT
       con.conname AS constraint_name,
       child.relname AS child_table,
       child_column.attname AS child_column,
       parent.relname AS parent_table,
       parent_column.attname AS parent_column
     FROM pg_constraint AS con
     JOIN pg_class AS child
       ON child.oid = con.conrelid
     JOIN pg_namespace AS child_schema
       ON child_schema.oid = child.relnamespace
     JOIN pg_class AS parent
       ON parent.oid = con.confrelid
     JOIN pg_namespace AS parent_schema
       ON parent_schema.oid = parent.relnamespace
     JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS child_key(attnum, ord)
       ON true
     JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS parent_key(attnum, ord)
       ON parent_key.ord = child_key.ord
     JOIN pg_attribute AS child_column
       ON child_column.attrelid = child.oid
      AND child_column.attnum = child_key.attnum
     JOIN pg_attribute AS parent_column
       ON parent_column.attrelid = parent.oid
      AND parent_column.attnum = parent_key.attnum
     WHERE con.contype = 'f'
       AND child_schema.nspname = 'public'
       AND parent_schema.nspname = 'public'
       AND ((child.relname = $1 AND parent.relname = $2)
         OR (child.relname = $2 AND parent.relname = $1))
       AND ($3::text IS NULL OR con.conname = $3)
     ORDER BY con.conname, child_key.ord
     LIMIT 1`,
    [sourceTable, targetTable, constraintName ?? null],
  );
  return result.rows.find((row) =>
    (row.child_table === sourceTable && row.parent_table === targetTable)
    || (row.child_table === targetTable && row.parent_table === sourceTable),
  ) ?? null;
}

function projectionSql(projection: Projection, extraColumns: string[] = []) {
  if (projection.all) return "*";
  const columns = projection.columns.map(({ column, alias }) =>
    alias ? `${quoteIdentifier(column)} AS ${quoteIdentifier(alias)}` : quoteIdentifier(column),
  );
  for (const extra of extraColumns) {
    if (!columns.some((column) => column.includes(quoteIdentifier(extra)))) {
      columns.push(quoteIdentifier(extra));
    }
  }
  return columns.length ? columns.join(", ") : "*";
}

async function selectRows(
  client: PoolClient,
  table: string,
  columns: string,
  filters: DataFilter[] = [],
  orders: DataRequest["orders"] = [],
  limit?: number,
  offset?: number,
  relationDepth = 0,
  orGroups: DataFilter[][] = [],
  preservedColumns: string[] = [],
) {
  const sqlTable = assertTable(table);
  if (relationDepth > 4) throw new Error("Profundidade máxima de relações excedida.");
  const projection = parseProjection(columns);
  const relationPlans: {
    relation: ProjectionRelation;
    foreignKey: ForeignKeyRelation;
    sourceDirection: "child" | "parent";
    hiddenColumn: string;
  }[] = [];

  for (let index = 0; index < projection.relations.length; index += 1) {
    const relation = projection.relations[index];
    assertTable(relation.name);
    const foreignKey = await getForeignKey(client, table, relation.name, relation.foreignKey);
    if (!foreignKey) throw new Error(`Relacionamento ${table}.${relation.name} não encontrado no PostgreSQL.`);
    const sourceDirection = foreignKey.child_table === table ? "child" : "parent";
    const hiddenColumn = `__relation_${relation.alias}_${index}`;
    relationPlans.push({ relation, foreignKey, sourceDirection, hiddenColumn });
  }

  const hiddenColumns = relationPlans.map(({ foreignKey, sourceDirection }) =>
    sourceDirection === "child" ? foreignKey.child_column : foreignKey.parent_column,
  );
  const uniqueHiddenColumns = [...new Set(hiddenColumns)];
  const parameters: unknown[] = [];
  let sql = `SELECT ${projectionSql(projection, [...uniqueHiddenColumns, ...preservedColumns])} FROM ${sqlTable}`;
  sql += buildWhere(filters, parameters, undefined, orGroups);
  if (orders?.length) {
    sql += ` ORDER BY ${orders.map((order) =>
      `${quoteIdentifier(order.column)} ${order.ascending ? "ASC" : "DESC"}${order.nullsFirst === undefined ? "" : order.nullsFirst ? " NULLS FIRST" : " NULLS LAST"}`,
    ).join(", ")}`;
  }
  if (limit !== undefined) sql += ` LIMIT ${Math.max(0, Math.trunc(limit))}`;
  if (offset !== undefined) sql += ` OFFSET ${Math.max(0, Math.trunc(offset))}`;

  const result = await client.query<Record<string, unknown>>(sql, parameters);
  const rows = result.rows;
  for (const plan of relationPlans) {
    const sourceColumn = plan.sourceDirection === "child"
      ? plan.foreignKey.child_column
      : plan.foreignKey.parent_column;
    const targetTable = plan.relation.name;
    const targetColumn = plan.sourceDirection === "child"
      ? plan.foreignKey.parent_column
      : plan.foreignKey.child_column;
    const lookupIds = [...new Set(rows.map((row) => row[sourceColumn]).filter((value) => value !== null && value !== undefined))];
    const relatedRows = lookupIds.length
      ? await selectRows(
        client,
        targetTable,
        plan.relation.projection.all ? "*" : projectionText(plan.relation.projection),
        [{ column: targetColumn, operator: "in", value: lookupIds }],
        [],
        undefined,
        undefined,
        relationDepth + 1,
        [],
        [targetColumn],
      )
      : [];
    const grouped = new Map<string, Record<string, unknown>[]>();
    const joinColumnIsVisible = plan.relation.projection.all
      || plan.relation.projection.columns.some(({ column, alias }) => (alias ?? column) === targetColumn);
    for (const related of relatedRows) {
      const key = String(related[targetColumn]);
      const group = grouped.get(key) ?? [];
      const visibleRelated = { ...related };
      if (!joinColumnIsVisible) delete visibleRelated[targetColumn];
      group.push(visibleRelated);
      grouped.set(key, group);
    }

    for (const row of rows) {
      const sourceValue = row[sourceColumn];
      const matches = sourceValue === null || sourceValue === undefined
        ? []
        : grouped.get(String(sourceValue)) ?? [];
      row[plan.relation.alias] = plan.sourceDirection === "child" ? matches[0] ?? null : matches;
    }
  }

  if (!projection.all) {
    const visibleColumns = new Set([
      ...projection.columns.map(({ column, alias }) => alias ?? column),
      ...projection.relations.map(({ alias }) => alias),
      ...preservedColumns,
    ]);
    for (const row of rows) {
      for (const key of Object.keys(row)) if (!visibleColumns.has(key)) delete row[key];
    }
  }
  return rows;
}

function projectionText(projection: Projection): string {
  const parts = projection.columns.map(({ column, alias }) => alias ? `${alias}:${column}` : column);
  parts.push(...projection.relations.map(({ name, alias, foreignKey, projection: nested }) => {
    const rel = alias === name ? name : `${alias}:${name}`;
    return `${rel}${foreignKey ? `!${foreignKey}` : ""}(${projectionText(nested)})`;
  }));
  if (projection.all) parts.unshift("*");
  return parts.join(",");
}

function checkedValues(value: unknown) {
  const rows = Array.isArray(value) ? value : [value];
  if (!rows.length || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("O corpo da operação deve conter um objeto ou uma lista de objetos.");
  }
  return rows as Record<string, unknown>[];
}

function selectReturning(request: DataRequest) {
  return request.returning || request.head || request.count ? request.columns ?? "*" : null;
}

async function runInsert(client: PoolClient, request: DataRequest, table: string) {
  const rows = checkedValues(request.values);
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const columns = Object.keys(row).sort();
    if (!columns.length) throw new Error("A inserção precisa informar ao menos uma coluna.");
    columns.forEach(quoteIdentifier);
    const key = columns.join("\u0000");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const returned: Record<string, unknown>[] = [];
  for (const [key, group] of groups) {
    const columns = key.split("\u0000");
    const parameters: unknown[] = [];
    const valuesSql = group.map((row) => `(${columns.map((column) => pushValue(parameters, row[column])).join(", ")})`);
    let conflict = "";
    if (request.action === "upsert") {
      const targetColumns = (request.onConflict ?? "id").split(",").map((column) => column.trim());
      targetColumns.forEach(quoteIdentifier);
      conflict = ` ON CONFLICT (${targetColumns.map(quoteIdentifier).join(", ")}) `;
      if (request.ignoreDuplicates) conflict += "DO NOTHING";
      else {
        const updates = columns.filter((column) => !targetColumns.includes(column));
        conflict += updates.length
          ? `DO UPDATE SET ${updates.map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`).join(", ")}`
          : "DO NOTHING";
      }
    }
    const returning = selectReturning(request) ? " RETURNING *" : "";
    const result = await client.query<Record<string, unknown>>(
      `INSERT INTO ${table} (${columns.map(quoteIdentifier).join(", ")}) VALUES ${valuesSql.join(", ")}${conflict}${returning}`,
      parameters,
    );
    returned.push(...result.rows);
  }
  return returned;
}

async function executeMutation(client: PoolClient, request: DataRequest) {
  const tableName = request.table ?? "";
  const table = assertTable(tableName);
  if ((request.action === "update" || request.action === "delete")
    && !request.filters?.length && !request.orGroups?.some((group) => group.length > 0)) {
    throw new Error("Atualizações e exclusões precisam filtrar ao menos um registro.");
  }
  if (request.action === "insert" || request.action === "upsert") {
    const rows = await runInsert(client, request, table);
    if (!selectReturning(request)) return null;
    const selection = request.columns ?? "*";
    return attachCardinality(await projectReturnedRows(client, tableName, selection, rows), request.cardinality);
  }

  const parameters: unknown[] = [];
  const returning = selectReturning(request) ? " RETURNING t.*" : "";
  let sql: string;
  if (request.action === "delete") {
    const where = buildWhere(request.filters, parameters, "t", request.orGroups);
    sql = `DELETE FROM ${table} AS t${where}${returning}`;
  } else {
    const values = request.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("A atualização precisa conter um objeto.");
    const entries = Object.entries(values as Record<string, unknown>);
    if (!entries.length) throw new Error("A atualização precisa conter ao menos uma coluna.");
    const assignments = entries.map(([column, value]) => `${quoteIdentifier(column)} = ${pushValue(parameters, value)}`);
    const whereWithAssignments = buildWhere(request.filters, parameters, "t", request.orGroups);
    sql = `UPDATE ${table} AS t SET ${assignments.join(", ")}${whereWithAssignments}${returning}`;
  }
  const result = await client.query<Record<string, unknown>>(sql, parameters);
  if (!selectReturning(request)) return null;
  return attachCardinality(await projectReturnedRows(client, tableName, request.columns ?? "*", result.rows), request.cardinality);
}

async function projectReturnedRows(client: PoolClient, table: string, columns: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return [];
  if (columns === "*") return rows;
  const projection = parseProjection(columns);
  const projected = rows.map((row) => {
    if (projection.all) return { ...row };
    const result: Record<string, unknown> = {};
    for (const { column, alias } of projection.columns) result[alias ?? column] = row[column];
    return result;
  });
  if (projection.relations.length) {
    const ids = rows.map((row) => row.id).filter((id) => id !== undefined && id !== null);
    if (ids.length) {
      const fullRows = await selectRows(
        client,
        table,
        columns,
        [{ column: "id", operator: "in", value: ids }],
      );
      const byId = new Map(fullRows.map((row) => [String(row.id), row]));
      return rows.map((row) => byId.get(String(row.id)) ?? projected[rows.indexOf(row)]);
    }
  }
  return projected;
}

function attachCardinality(rows: unknown[], cardinality?: DataRequest["cardinality"]) {
  if (cardinality === "single") {
    if (rows.length !== 1) throw Object.assign(new Error("A consulta deveria retornar exatamente um registro."), { code: "PGRST116" });
    return rows[0];
  }
  if (cardinality === "maybeSingle") {
    if (rows.length > 1) throw Object.assign(new Error("A consulta retornou mais de um registro."), { code: "PGRST116" });
    return rows[0] ?? null;
  }
  return rows;
}

async function executeSelect(client: PoolClient, request: DataRequest) {
  const table = request.table ?? "";
  assertTable(table);
  const filters = request.filters ?? [];
  let count: number | undefined;
  if (request.count) {
    const parameters: unknown[] = [];
    const where = buildWhere(filters, parameters, undefined, request.orGroups);
    const result = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${assertTable(table)}${where}`, parameters);
    count = Number(result.rows[0]?.count ?? 0);
  }
  if (request.head) return { data: null, count };
  const rows = await selectRows(
    client,
    table,
    request.columns ?? "*",
    filters,
    request.orders,
    request.limit,
    request.offset,
    0,
    request.orGroups,
  );
  return { data: attachCardinality(rows, request.cardinality), count };
}

async function executeRpc(client: PoolClient, request: DataRequest) {
  const name = request.name ?? "";
  if (!RPCS.has(name)) throw new Error(`Função não disponível pela API: ${name}`);
  const args = Object.entries(request.args ?? {});
  const parameters: unknown[] = [];
  const namedArguments = args.map(([key, value]) =>
    `${quoteIdentifier(key)} => ${pushValue(parameters, value)}`,
  );
  const metadata = await client.query<{ returns_set: boolean; returns_composite: boolean }>(
    `SELECT p.proretset AS returns_set, t.typtype = 'c' AS returns_composite
     FROM pg_proc AS p
     JOIN pg_namespace AS n ON n.oid = p.pronamespace
     JOIN pg_type AS t ON t.oid = p.prorettype
     WHERE n.nspname = 'public' AND p.proname = $1
     LIMIT 1`,
    [name],
  );
  const returnsTable = metadata.rows[0]?.returns_set || metadata.rows[0]?.returns_composite;
  const result = await client.query<Record<string, unknown>>(
    returnsTable
      ? `SELECT * FROM public.${quoteIdentifier(name)}(${namedArguments.join(", ")})`
      : `SELECT public.${quoteIdentifier(name)}(${namedArguments.join(", ")}) AS value`,
    parameters,
  );
  if (!result.rows.length) return null;
  if (returnsTable) return result.rows;
  if (result.rows.length === 1 && Object.keys(result.rows[0]).length === 1) return result.rows[0].value ?? null;
  return result.rows.map((row) => row.value ?? row);
}

export async function executeDataRequest(client: PoolClient, request: DataRequest) {
  if (request.kind === "rpc") return executeRpc(client, request);
  if (!request.table) throw new Error("A tabela da consulta não foi informada.");
  if (request.action === "select" || !request.action) return executeSelect(client, request);
  return executeMutation(client, request);
}
