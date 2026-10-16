import {
  copyStorageObject,
  downloadStorageObject,
  removeStorageObjects,
  storageObjectUrl,
  uploadStorageObject,
} from "./storage";

function bytesFrom(value: Blob | Uint8Array | ArrayBuffer) {
  if (value instanceof Blob) return value.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  if (value instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(value));
  return Promise.resolve(new Uint8Array(value));
}

function asStorageError(error: unknown) {
  return { message: error instanceof Error ? error.message : "Operação de arquivo falhou." };
}

export function createServerStorageClient() {
  return {
    from(bucket: string) {
      return {
        async upload(storagePath: string, body: Blob | Uint8Array | ArrayBuffer, options: { contentType?: string; upsert?: boolean } = {}) {
          try {
            await uploadStorageObject(bucket, storagePath, await bytesFrom(body), options);
            return { data: { path: storagePath }, error: null };
          } catch (error) {
            return { data: null, error: asStorageError(error) };
          }
        },
        async download(storagePath: string) {
          try {
            return { data: await downloadStorageObject(bucket, storagePath), error: null };
          } catch (error) {
            return { data: null, error: asStorageError(error) };
          }
        },
        async remove(storagePaths: string[]) {
          try {
            return { data: await removeStorageObjects(bucket, storagePaths), error: null };
          } catch (error) {
            return { data: null, error: asStorageError(error) };
          }
        },
        async copy(from: string, to: string) {
          try {
            return { data: await copyStorageObject(bucket, from, to), error: null };
          } catch (error) {
            return { data: null, error: asStorageError(error) };
          }
        },
        async createSignedUrl(storagePath: string, _expiresIn: number, options?: { download?: string }) {
          return { data: { signedUrl: storageObjectUrl(bucket, storagePath, options?.download) }, error: null };
        },
      };
    },
  };
}
