import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Router, type IRouter } from "express";
import type { ScheduleResult } from "../../../escala-generator/src/lib/types";
import { convertScheduleToVerticalSchedule } from "../../../escala-generator/src/lib/vertical-export/mapper";
import { fillVerticalScheduleDocxTemplate } from "../../../escala-generator/src/lib/vertical-export/docx-template-filler";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface VerticalScheduleHeaderPayload {
  crcea?: string;
  localidade?: string;
  orgao?: string;
  escalante?: string;
  monthlyAverageHours?: string;
  trainingHours?: string;
  headOfOrg?: string;
  headOfDivision?: string;
}

interface PreviewDocxPayload {
  schedule?: ScheduleResult;
  header?: VerticalScheduleHeaderPayload;
  filename?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateSchedule(value: unknown): value is ScheduleResult {
  if (!isRecord(value)) return false;
  return (
    typeof value["year"] === "number" &&
    typeof value["month"] === "number" &&
    Array.isArray(value["rows"]) &&
    Array.isArray(value["perDay"])
  );
}

function sanitizeFilename(value: string | undefined, schedule: ScheduleResult): string {
  const fallback = `escala-vertical-prevista-${schedule.year}-${String(schedule.month).padStart(2, "0")}.docx`;
  const raw = value?.trim() || fallback;
  const withExtension = raw.toLowerCase().endsWith(".docx") ? raw : `${raw}.docx`;
  return withExtension.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function buildHeader(payload: VerticalScheduleHeaderPayload | undefined) {
  return {
    crcea: payload?.crcea?.trim() || "CRCEA-SE",
    localidade: payload?.localidade?.trim() || "ARACAJU-SE",
    orgao: payload?.orgao?.trim() || "APP",
    escalante: payload?.escalante?.trim() || "A DEFINIR",
    monthlyAverageHours: payload?.monthlyAverageHours,
    trainingHours: payload?.trainingHours,
    headOfOrg: payload?.headOfOrg,
    headOfDivision: payload?.headOfDivision,
  };
}

async function cleanupTempFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (err) {
    logger.warn({ err, path }, "Failed to remove temporary vertical schedule DOCX");
  }
}

router.post("/vertical-schedule/preview/docx", async (req, res) => {
  const payload = req.body as PreviewDocxPayload;

  if (!validateSchedule(payload?.schedule)) {
    res.status(400).json({
      error: "ScheduleResult inválido ou ausente. Envie schedule.year, schedule.month, schedule.rows e schedule.perDay.",
    });
    return;
  }

  const schedule = payload.schedule;
  const requestId = randomUUID();
  const outputPath = join(tmpdir(), `escala-vertical-prevista-${requestId}.docx`);
  const filename = sanitizeFilename(payload.filename, schedule);

  try {
    const verticalSchedule = convertScheduleToVerticalSchedule(schedule, {
      header: buildHeader(payload.header),
      generatedAt: new Date().toISOString(),
    });
    const result = await fillVerticalScheduleDocxTemplate(verticalSchedule, { outputPath });
    const docxBuffer = Buffer.from(result.docxBytes);

    let cleaned = false;
    const cleanupOnce = () => {
      if (cleaned) return;
      cleaned = true;
      void cleanupTempFile(outputPath);
    };

    res.once("finish", cleanupOnce);
    res.once("close", cleanupOnce);
    res.setHeader("Content-Type", DOCX_CONTENT_TYPE);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(docxBuffer.byteLength));
    res.send(docxBuffer);
  } catch (err) {
    await cleanupTempFile(outputPath);
    logger.error({ err, requestId }, "Failed to generate vertical schedule preview DOCX");
    res.status(500).json({ error: "Erro interno ao gerar DOCX da escala vertical." });
  }
});

export default router;
