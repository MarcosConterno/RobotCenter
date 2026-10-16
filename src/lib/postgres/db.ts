import { Pool, types as pgTypes, type PoolClient } from "pg";

export interface DatabaseUserContext {
  userId: string;
  claims: Record<string, unknown>;
}

type PoolRegistry = Map<string, Pool>;

const globalForPostgres = globalThis as typeof globalThis & {
  robotCenterPostgresPools?: PoolRegistry;
};

function getPool(admin = false) {
  const adminConnectionString = process.env.DATABASE_ADMIN_URL;
  const connectionString = admin
    ? adminConnectionString ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL;

  if (admin && process.env.NODE_ENV === "production" && !adminConnectionString) {
    throw new Error("DATABASE_ADMIN_URL deve ser configurada separadamente em produção.");
  }
  if (!connectionString) {
    throw new Error("DATABASE_URL não está configurada no servidor.");
  }

  const pools = (globalForPostgres.robotCenterPostgresPools ??= new Map());
  // DATE representa um dia do calendário; mantenha o valor YYYY-MM-DD para os formulários.
  // A chave versionada recria o pool existente no HMR para aplicar o parser atualizado.
  const poolKey = connectionString + "::date-as-text-v1";
  const existing = pools.get(poolKey);
  if (existing) return existing;

  const pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "robot-center",
    types: {
      getTypeParser(oid, format) {
        if (oid === pgTypes.builtins.DATE && format !== "binary") {
          return (value: string) => value;
        }
        return pgTypes.getTypeParser(oid, format);
      },
    },
  });
  pool.on("error", (error) => {
    console.error("Erro em uma conexão ociosa do PostgreSQL do Robot Center.", error);
  });
  pools.set(poolKey, pool);
  return pool;
}

async function inTransaction<T>(
  admin: boolean,
  setup: (client: PoolClient) => Promise<void>,
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await getPool(admin).connect();
  try {
    await client.query("BEGIN");
    await setup(client);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function withUserDatabase<T>(
  context: DatabaseUserContext,
  operation: (client: PoolClient) => Promise<T>,
) {
  return inTransaction(
    false,
    async (client) => {
      await client.query("SET LOCAL ROLE authenticated");
      await client.query(
        `SELECT
           set_config('request.jwt.claim.sub', $1, true),
           set_config('request.jwt.claims', $2, true)`,
        [context.userId, JSON.stringify(context.claims)],
      );
    },
    operation,
  );
}

export function withAdminDatabase<T>(operation: (client: PoolClient) => Promise<T>) {
  return inTransaction(
    true,
    async (client) => {
      await client.query("SET LOCAL ROLE service_role");
    },
    operation,
  );
}

export function closePostgresPools() {
  const pools = globalForPostgres.robotCenterPostgresPools;
  if (!pools) return Promise.resolve();
  const closing = [...pools.values()].map((pool) => pool.end());
  pools.clear();
  return Promise.all(closing).then(() => undefined);
}
