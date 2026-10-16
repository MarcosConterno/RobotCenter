import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "src", "generated", "system-documentation.ts");
const sources = {
  readme: "README.md",
  architecture: "ARCHITECTURE.md",
  database: "docs/modelagem-banco.md",
  domain: "docs/dominio.md",
  rules: "docs/regras-negocio.md",
  permissions: "docs/permissoes.md",
  authApi: "docs/api-postgres-autenticacao.md",
  usersApi: "docs/api-usuarios.md",
  flowsApi: "docs/api-fluxos.md",
  personalApi: "docs/api-minha-pagina.md",
  versionsApi: "docs/api-versoes-robos.md",
  robotDocumentationApi: "docs/api-documentacao-robot-center.md",
};

const entries = await Promise.all(
  Object.entries(sources).map(async ([key, relativePath]) => [
    key,
    await readFile(path.join(projectRoot, relativePath), "utf8"),
  ]),
);

await mkdir(path.dirname(outputPath), { recursive: true });
const moduleSource = [
  'import type { DocumentationSources } from "@/lib/documentation/types";',
  'const systemDocumentation: DocumentationSources = ' + JSON.stringify(Object.fromEntries(entries)) + ";",
  "",
  "export default systemDocumentation;",
  "",
].join(String.fromCharCode(10));
await writeFile(outputPath, moduleSource, "utf8");
console.info("Documentação do sistema preparada para o build.");
