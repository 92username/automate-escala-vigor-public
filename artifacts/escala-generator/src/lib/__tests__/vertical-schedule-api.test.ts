import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScheduleResult } from "../types";
import { generateVerticalPreviewDocx } from "../vertical-schedule-api";

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const schedule: ScheduleResult = {
  year: 2026,
  month: 7,
  scenario: "operacional",
  status: "gerada_ok",
  rows: [],
  warnings: [],
  violations: [],
  decisionLog: [],
  perDay: [],
};

function docxBlob(): Blob {
  return new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], { type: DOCX_CONTENT_TYPE });
}

function mockResponse(params: {
  ok?: boolean;
  status?: number;
  blob?: Blob;
  json?: unknown;
  headers?: Record<string, string>;
}): Response {
  const headers = new Headers(params.headers);
  return {
    ok: params.ok ?? (params.status === undefined || params.status < 400),
    status: params.status ?? 200,
    headers,
    blob: vi.fn().mockResolvedValue(params.blob ?? docxBlob()),
    json: vi.fn().mockResolvedValue(params.json),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateVerticalPreviewDocx", () => {
  it("posts the saved schedule and returns a valid DOCX blob", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        headers: {
          "content-type": DOCX_CONTENT_TYPE,
          "content-disposition": 'attachment; filename="escala.docx"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateVerticalPreviewDocx({ schedule, filename: "escala.docx" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/vertical-schedule\/preview\/docx$/),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: DOCX_CONTENT_TYPE,
        },
        body: JSON.stringify({ schedule, filename: "escala.docx" }),
      }),
    );
    expect(result.filename).toBe("escala.docx");
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("uses the backend error message when generation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          ok: false,
          status: 500,
          json: { error: "Erro interno ao gerar DOCX da escala vertical." },
        }),
      ),
    );

    await expect(generateVerticalPreviewDocx({ schedule })).rejects.toThrow("Erro interno ao gerar DOCX da escala vertical.");
  });

  it("returns a friendly connection error when the backend is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(generateVerticalPreviewDocx({ schedule })).rejects.toThrow("Não foi possível conectar ao backend");
  });

  it("rejects successful responses that are not valid DOCX files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          blob: new Blob(["not a docx"], { type: "text/plain" }),
          headers: { "content-type": "text/plain" },
        }),
      ),
    );

    await expect(generateVerticalPreviewDocx({ schedule })).rejects.toThrow("não é um DOCX válido");
  });
});
