import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const host = "127.0.0.1";
const port = Number(process.env.ROBOT_CENTER_CONNECTOR_PORT ?? 47831);
const registry = process.env.NPM_REGISTRY?.trim();
const allowedOrigins = new Set(
  (process.env.ROBOT_CENTER_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const packagePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;

if (!registry) throw new Error("Configure NPM_REGISTRY antes de iniciar o conector.");
const registryUrl = new URL(registry);
if (!["http:", "https:"].includes(registryUrl.protocol)) throw new Error("NPM_REGISTRY deve usar HTTP ou HTTPS.");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Porta do conector inválida.");

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function sendJson(response, status, body, origin) {
  response.writeHead(status, { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function runNpm(args, timeout = 20_000) {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  return execFileAsync(executable, args, {
    encoding: "utf8",
    timeout,
    windowsHide: true,
    maxBuffer: 256 * 1024,
    shell: process.platform === "win32",
  });
}

async function registryAvailable() {
  await runNpm(["ping", `--registry=${registryUrl.href}`], 10_000);
}

async function getPackageVersion(packageName) {
  const { stdout } = await runNpm([
    "view",
    packageName,
    "version",
    "--json",
    `--registry=${registryUrl.href}`,
  ]);
  const parsed = JSON.parse(stdout.trim());
  const version = Array.isArray(parsed) ? parsed.at(-1) : parsed;
  if (typeof version !== "string" || !version.trim() || version.length > 100) throw new Error("Versão inválida.");
  return version.trim();
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Requisição muito grande.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin ?? "";
  if (!allowedOrigins.has(origin)) {
    response.writeHead(403, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ error: "Origem não autorizada." }));
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(origin));
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (request.method === "GET" && url.pathname === "/health") {
    try {
      await registryAvailable();
      sendJson(response, 200, { available: true }, origin);
    } catch {
      sendJson(response, 503, { available: false }, origin);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/versions") {
    let packages;
    try {
      const body = await readJson(request);
      packages = Array.isArray(body.packages) ? [...new Set(body.packages)] : [];
      if (!packages.length || packages.length > 500 || packages.some((item) => typeof item !== "string" || !packagePattern.test(item))) {
        throw new Error("Lista de pacotes inválida.");
      }
    } catch {
      sendJson(response, 400, { error: "Lista de pacotes inválida." }, origin);
      return;
    }

    response.writeHead(200, {
      ...corsHeaders(origin),
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    for (const packageName of packages) {
      response.write(`${JSON.stringify({ packageName, status: "checking" })}\n`);
      try {
        const version = await getPackageVersion(packageName);
        response.write(`${JSON.stringify({ packageName, status: "success", version })}\n`);
      } catch {
        response.write(`${JSON.stringify({ packageName, status: "error" })}\n`);
      }
    }
    response.end();
    return;
  }

  sendJson(response, 404, { error: "Endpoint não encontrado." }, origin);
});

server.listen(port, host, () => {
  process.stdout.write(`Robot Center Version Connector disponível em http://${host}:${port}\n`);
});
