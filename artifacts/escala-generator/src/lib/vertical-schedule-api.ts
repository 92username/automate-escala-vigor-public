import type { ScheduleResult } from "./types";

export interface GenerateVerticalPreviewDocxInput {
  schedule: ScheduleResult;
  filename?: string;
}

export interface GeneratedVerticalPreviewDocx {
  blob: Blob;
  filename: string;
}

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configured) return configured.replace(/\/+$/, "");
  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    window.location.port !== "3000"
  ) {
    return "http://localhost:3000";
  }
  return "";
}

function parseContentDispositionFilename(value: string | null): string | null {
  if (!value) return null;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const quotedMatch = value.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = value.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() ?? null;
}

function fallbackFilename(schedule: ScheduleResult): string {
  return `escala-vertical-prevista-${schedule.year}-${String(schedule.month).padStart(2, "0")}.docx`;
}

function isDocxContentType(value: string | null): boolean {
  return value?.toLowerCase().split(";")[0]?.trim() === DOCX_CONTENT_TYPE;
}

async function assertValidDocxBlob(blob: Blob, responseContentType: string | null): Promise<void> {
  const hasDocxContentType = isDocxContentType(responseContentType) || isDocxContentType(blob.type);
  if (!hasDocxContentType) {
    throw new Error("O backend respondeu, mas o arquivo retornado não é um DOCX válido.");
  }

  if (blob.size === 0) {
    throw new Error("O backend respondeu com um DOCX vazio.");
  }

  const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const startsWithZipMagicBytes = signature[0] === 0x50 && signature[1] === 0x4b;
  if (!startsWithZipMagicBytes) {
    throw new Error("O backend respondeu, mas o conteúdo do arquivo não é um DOCX válido.");
  }
}

export async function generateVerticalPreviewDocx({
  schedule,
  filename,
}: GenerateVerticalPreviewDocxInput): Promise<GeneratedVerticalPreviewDocx> {
  const baseUrl = resolveApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/vertical-schedule/preview/docx`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: DOCX_CONTENT_TYPE,
      },
      body: JSON.stringify({ schedule, filename }),
    });
  } catch {
    throw new Error("Não foi possível conectar ao backend para gerar o DOCX. Verifique se o servidor da API está em execução.");
  }

  if (!response.ok) {
    let message = "Erro ao gerar DOCX da escala vertical.";
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error ?? message;
    } catch {
      // Keep the generic message when the response is not JSON.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  await assertValidDocxBlob(blob, response.headers.get("content-type"));

  return {
    blob,
    filename: parseContentDispositionFilename(response.headers.get("content-disposition")) ?? fallbackFilename(schedule),
  };
}

export function downloadDocxBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
