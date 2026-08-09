export function generateOfficialDocx(input: {
  template: Buffer;
  snapshot: Record<string, any>;
  images: Map<string, Buffer>;
}): Promise<Buffer>;
export function versionLabel(version: number): string;
