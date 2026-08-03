import type { Employee, PreviousMonthInfo } from "./types";

export interface PreviousMonthImportResponse {
  prevMonth: PreviousMonthInfo;
  employees: Employee[];
  detectedYear: number;
  detectedMonth: number;
  sheetName: string;
  matchedNames: string[];
  unmatchedNames: string[];
}

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

export async function fetchPreviousMonthFromServer(
  year?: number,
  month?: number,
): Promise<PreviousMonthImportResponse> {
  const baseUrl = resolveApiBaseUrl();
  const url = new URL(`${baseUrl}/api/operational-schedule/previous-month`, window.location.origin);
  if (typeof year === "number" && typeof month === "number") {
    url.searchParams.set("year", String(year));
    url.searchParams.set("month", String(month));
  }

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    throw new Error("Não foi possível conectar ao backend para carregar a escala privada.");
  }

  if (!response.ok) {
    let message = "Erro ao carregar a escala privada do servidor.";
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error ?? message;
    } catch {
      // Keep generic message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<PreviousMonthImportResponse>;
}
