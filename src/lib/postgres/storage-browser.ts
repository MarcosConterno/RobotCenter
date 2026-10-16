async function readError(response: Response) {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return { message: body.error?.message ?? "A operação de arquivo falhou." };
  } catch {
    return { message: "A operação de arquivo falhou." };
  }
}

export function createBrowserStorageClient() {
  return {
    from(bucket: string) {
      return {
        async upload(storagePath: string, file: Blob, options: { contentType?: string; upsert?: boolean } = {}) {
          const params = new URLSearchParams({ path: storagePath });
          const formData = new FormData();
          formData.append("file", file);
          formData.set("contentType", options.contentType ?? file.type ?? "application/octet-stream");
          formData.set("upsert", String(Boolean(options.upsert)));
          const response = await fetch(`/api/storage/${encodeURIComponent(bucket)}?${params}`, {
            method: "POST",
            body: formData,
            credentials: "same-origin",
          });
          if (!response.ok) return { data: null, error: await readError(response) };
          return { data: { path: storagePath }, error: null };
        },
        async remove(storagePaths: string[]) {
          const response = await fetch(`/api/storage/${encodeURIComponent(bucket)}`, {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ paths: storagePaths }),
            credentials: "same-origin",
          });
          if (!response.ok) return { data: null, error: await readError(response) };
          return { data: storagePaths.map((name) => ({ name })), error: null };
        },
        async copy(from: string, to: string) {
          const response = await fetch(`/api/storage/${encodeURIComponent(bucket)}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ from, to }),
            credentials: "same-origin",
          });
          if (!response.ok) return { data: null, error: await readError(response) };
          return { data: { path: to }, error: null };
        },
        async download(storagePath: string) {
          const response = await fetch(storageUrl(bucket, storagePath), { credentials: "same-origin" });
          if (!response.ok) return { data: null, error: await readError(response) };
          return { data: await response.blob(), error: null };
        },
        async createSignedUrl(storagePath: string, _expiresIn: number, options?: { download?: string }) {
          const signedUrl = storageUrl(bucket, storagePath, options?.download);
          return { data: { signedUrl }, error: null };
        },
      };
    },
  };
}

function storageUrl(bucket: string, storagePath: string, download?: string) {
  const params = new URLSearchParams({ path: storagePath });
  if (download) params.set("download", download);
  return `/api/storage/${encodeURIComponent(bucket)}?${params.toString()}`;
}
