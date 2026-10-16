import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const connectionString = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
const email = process.env.LOCAL_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.LOCAL_ADMIN_PASSWORD;

if (!connectionString || !email || !password) {
  throw new Error("Configure DATABASE_URL, LOCAL_ADMIN_EMAIL e LOCAL_ADMIN_PASSWORD.");
}

if (password.length < 8) {
  throw new Error("LOCAL_ADMIN_PASSWORD deve ter pelo menos 8 caracteres.");
}

const databaseUrl = new URL(connectionString);
const localHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
  "postgres",
  "robot-center-standalone-postgres",
]);
if (!localHosts.has(databaseUrl.hostname)) {
  throw new Error("O bootstrap de administrador está restrito ao PostgreSQL local.");
}

const pool = new Pool({ connectionString, application_name: "robot-center-local-admin" });
const client = await pool.connect();
let created = false;
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL ROLE service_role");

  const existingUser = await client.query(
    "SELECT id::text FROM auth.users WHERE lower(btrim(email)) = $1 LIMIT 1",
    [email],
  );
  let userId = existingUser.rows[0]?.id;

  if (!userId) {
    const encryptedPassword = await bcrypt.hash(password, 12);
    const createdUser = await client.query(
      "INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES (gen_random_uuid(), 'authenticated', 'authenticated', lower($1), $2, now(), $3::jsonb, '{}'::jsonb, now(), now()) RETURNING id::text",
      [email, encryptedPassword, JSON.stringify({ provider: "email", providers: ["email"] })],
    );
    userId = createdUser.rows[0]?.id;
    created = true;
  }

  if (!userId) throw new Error("Não foi possível obter o usuário administrador.");

  const adminRole = await client.query(
    "SELECT id::text FROM public.roles WHERE codigo = 'admin' LIMIT 1",
  );
  const roleId = adminRole.rows[0]?.id;
  if (!roleId) throw new Error("O papel admin não existe. Aplique as migrations PostgreSQL antes do bootstrap.");

  await client.query(
    "INSERT INTO public.user_roles (user_id, role_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT (user_id, role_id) DO NOTHING",
    [userId, roleId],
  );
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}

console.log("Administrador local pronto: " + email);
if (!created) console.log("A senha da conta existente não foi alterada.");
