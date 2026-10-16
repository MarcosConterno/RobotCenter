export type FilterOperator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "is" | "in" | "not" | "contains";

export interface DataFilter {
  column: string;
  operator: FilterOperator;
  value: unknown;
  negated?: boolean;
}

export interface DataRequest {
  kind: "table" | "rpc";
  table?: string;
  action?: "select" | "insert" | "update" | "delete" | "upsert";
  columns?: string;
  returning?: boolean;
  filters?: DataFilter[];
  orGroups?: DataFilter[][];
  orders?: { column: string; ascending: boolean; nullsFirst?: boolean }[];
  limit?: number;
  offset?: number;
  values?: unknown;
  onConflict?: string;
  ignoreDuplicates?: boolean;
  count?: "exact" | "planned" | "estimated";
  head?: boolean;
  cardinality?: "single" | "maybeSingle";
  name?: string;
  args?: Record<string, unknown>;
}

export interface DataError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface DataResponse<T = unknown> {
  data: T | null;
  error: DataError | null;
  count?: number | null;
}

export type DataTransport = (request: DataRequest) => Promise<DataResponse>;

// Select projections are runtime strings, so the client cannot infer a row shape here.
// Callers can still provide T explicitly when they have a concrete result type.
export class TableQuery<T = any> implements PromiseLike<DataResponse<T>> {
  private readonly request: DataRequest;
  private readonly transport: DataTransport;

  constructor(table: string, transport: DataTransport) {
    this.request = { kind: "table", table, action: "select", columns: "*", filters: [], orGroups: [], orders: [] };
    this.transport = transport;
  }

  select(columns = "*", options?: { count?: DataRequest["count"]; head?: boolean }) {
    this.request.columns = columns;
    this.request.returning = true;
    this.request.count = options?.count;
    this.request.head = options?.head;
    return this;
  }

  insert(values: unknown) {
    this.request.action = "insert";
    this.request.values = values;
    return this;
  }

  update(values: unknown) {
    this.request.action = "update";
    this.request.values = values;
    return this;
  }

  delete() {
    this.request.action = "delete";
    return this;
  }

  upsert(values: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.request.action = "upsert";
    this.request.values = values;
    this.request.onConflict = options?.onConflict;
    this.request.ignoreDuplicates = options?.ignoreDuplicates;
    return this;
  }

  eq(column: string, value: unknown) { return this.addFilter(column, "eq", value); }
  neq(column: string, value: unknown) { return this.addFilter(column, "neq", value); }
  gt(column: string, value: unknown) { return this.addFilter(column, "gt", value); }
  gte(column: string, value: unknown) { return this.addFilter(column, "gte", value); }
  lt(column: string, value: unknown) { return this.addFilter(column, "lt", value); }
  lte(column: string, value: unknown) { return this.addFilter(column, "lte", value); }
  is(column: string, value: unknown) { return this.addFilter(column, "is", value); }
  in(column: string, value: unknown[]) { return this.addFilter(column, "in", value); }
  contains(column: string, value: unknown) { return this.addFilter(column, "contains", value); }

  or(filters: string) {
    const supported: FilterOperator[] = ["eq", "neq", "gt", "gte", "lt", "lte", "is"];
    const group = filters.split(",").map((expression) => {
      const firstSeparator = expression.indexOf(".");
      const secondSeparator = expression.indexOf(".", firstSeparator + 1);
      if (firstSeparator <= 0 || secondSeparator <= firstSeparator + 1) {
        throw new Error(`Filtro OR inválido: ${expression}`);
      }

      const column = expression.slice(0, firstSeparator);
      const operator = expression.slice(firstSeparator + 1, secondSeparator);
      const rawValue = expression.slice(secondSeparator + 1);
      if (!supported.includes(operator as FilterOperator) || rawValue.length === 0) {
        throw new Error(`Filtro OR não suportado: ${expression}`);
      }

      let value: unknown = rawValue;
      if (operator === "is") {
        if (rawValue === "null") value = null;
        else if (rawValue === "true") value = true;
        else if (rawValue === "false") value = false;
        else throw new Error(`Valor IS inválido no filtro OR: ${rawValue}`);
      }
      return { column, operator: operator as FilterOperator, value };
    });

    if (group.length === 0) throw new Error("O filtro OR precisa conter ao menos uma condição.");
    this.request.orGroups?.push(group);
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    const allowed: FilterOperator[] = ["eq", "neq", "gt", "gte", "lt", "lte", "is", "in", "contains"];
    if (!allowed.includes(operator as FilterOperator)) {
      throw new Error(`Operador de filtro não suportado: ${operator}`);
    }
    return this.addFilter(column, operator as FilterOperator, value, true);
  }

  match(values: Record<string, unknown>) {
    Object.entries(values).forEach(([column, value]) => this.eq(column, value));
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.request.orders?.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(value: number) {
    this.request.limit = value;
    return this;
  }

  range(from: number, to: number) {
    this.request.offset = from;
    this.request.limit = Math.max(0, to - from + 1);
    return this;
  }

  single() {
    this.request.cardinality = "single";
    return this;
  }

  maybeSingle() {
    this.request.cardinality = "maybeSingle";
    return this;
  }

  then<TResult1 = DataResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: DataResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.transport(this.request).then(
      (response) => response as DataResponse<T>,
    ).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private addFilter(column: string, operator: FilterOperator, value: unknown, negated = false) {
    this.request.filters?.push({ column, operator, value, negated });
    return this;
  }
}

export function createTableClient(transport: DataTransport) {
  return {
    from(table: string) {
      return new TableQuery(table, transport);
    },
    rpc(name: string, args: Record<string, unknown> = {}) {
      return transport({ kind: "rpc", name, args });
    },
  };
}
