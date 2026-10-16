import { mkdir, readFile, rm, stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";

export const STORAGE_BUCKETS = new Set([
  "robot-manuals",
  "robot-documentation",
  "robot-documentation-templates",
]);

function getStorageRoot() {
  const configuredRoot = process.env.DOCUMENT_STORAGE_DIR?.trim();
  if (configuredRoot) {
    if (!path.isAbsolute(configuredRoot)) {
      throw new Error("DOCUMENT_STORAGE_DIR precisa ser um caminho absoluto.");
    }
    return path.normalize(configuredRoot);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Configure DOCUMENT_STORAGE_DIR para persistir arquivos em produção.");
  }
  return path.join(homedir(), ".robot-center", "storage");
}

export function resolveStoragePath(bucket: string, storagePath: string) {
  if (!STORAGE_BUCKETS.has(bucket)) throw new Error("Área de arquivos não disponível.");
  const normalized = storagePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (!normalized || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\0"))) {
    throw new Error("Caminho de arquivo inválido.");
  }
  const root = getStorageRoot();
  const fullPath = path.join(root, bucket, ...segments);
  if (!fullPath.startsWith(`${root}${path.sep}`)) throw new Error("Caminho de arquivo inválido.");
  return fullPath;
}

export async function uploadStorageObject(
  bucket: string,
  storagePath: string,
  content: Uint8Array,
  options: { contentType?: string; upsert?: boolean } = {},
) {
  const fullPath = resolveStoragePath(bucket, storagePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  if (!options.upsert) {
    try {
      await stat(fullPath);
      throw new Error("O arquivo já existe.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  await writeFile(fullPath, content, { flag: options.upsert ? "w" : "wx" });
  return { path: storagePath, fullPath };
}

export async function downloadStorageObject(bucket: string, storagePath: string) {
  const fullPath = resolveStoragePath(bucket, storagePath);
  const bytes = await readFile(fullPath);
  return new Blob([new Uint8Array(bytes)], { type: contentTypeForPath(storagePath) });
}

export async function removeStorageObjects(bucket: string, storagePaths: string[]) {
  await Promise.all(storagePaths.map((storagePath) =>
    rm(resolveStoragePath(bucket, storagePath), { force: true }),
  ));
  return storagePaths.map((name) => ({ name }));
}

export async function copyStorageObject(bucket: string, from: string, to: string) {
  const source = resolveStoragePath(bucket, from);
  const destination = resolveStoragePath(bucket, to);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  return { path: to };
}

export function storageObjectUrl(bucket: string, storagePath: string, download?: string) {
  const params = new URLSearchParams({ path: storagePath });
  if (download) params.set("download", download);
  return `/api/storage/${encodeURIComponent(bucket)}?${params.toString()}`;
}

export function contentTypeForPath(storagePath: string) {
  const extension = path.extname(storagePath).toLowerCase();
  const types: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return types[extension] ?? "application/octet-stream";
}
