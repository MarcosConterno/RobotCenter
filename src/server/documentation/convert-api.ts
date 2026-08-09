const CONVERT_ENDPOINT = "https://v2.convertapi.com/convert/docx/to/pdf";

function token() {
  const value = process.env.CONVERTAPI_TOKEN?.trim();
  if (!value) throw new Error("Variável de ambiente CONVERTAPI_TOKEN não configurada.");
  return value;
}

interface ConvertApiResponse {
  Files?: Array<{ Url?: string; FileName?: string }>;
  Message?: string;
  message?: string;
}

export async function convertDocxToPdf(docx: Buffer, temporaryName: string) {
  const safeName = temporaryName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const form = new FormData();
  form.set("File", new Blob([new Uint8Array(docx)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }), safeName);
  form.set("StoreFile", "true");

  const response = await fetch(CONVERT_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}` },
    body: form,
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as ConvertApiResponse;
  if (!response.ok) {
    throw new Error(result.Message ?? result.message ?? `ConvertAPI recusou a conversão (${response.status}).`);
  }
  const downloadUrl = result.Files?.[0]?.Url;
  if (!downloadUrl?.startsWith("https://")) throw new Error("ConvertAPI não retornou uma URL segura para o PDF.");

  const converted = await fetch(downloadUrl, { cache: "no-store" });
  if (!converted.ok) throw new Error(`Não foi possível baixar o PDF convertido (${converted.status}).`);
  const contentType = converted.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("application/pdf") && !contentType.includes("octet-stream")) {
    throw new Error("O arquivo retornado pela conversão não é um PDF válido.");
  }
  const pdf = Buffer.from(await converted.arrayBuffer());
  if (pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("O conteúdo retornado pela conversão não possui assinatura PDF.");
  }
  return pdf;
}
