import { readFile } from "node:fs/promises";
import { Router, type IRouter } from "express";
import {
  detectMostRecentMonth,
  parseOperationalPreviousMonth,
} from "../../../escala-generator/src/lib/operational-previous-month";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const OPERATIONAL_SCHEDULE_SOURCE_PATH =
  process.env["OPERATIONAL_SCHEDULE_SOURCE_PATH"]?.trim() ?? "";

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  return bytes.slice().buffer;
}

router.get("/operational-schedule/previous-month", async (req, res) => {
  const rawYear = String(req.query["year"] ?? "").trim();
  const rawMonth = String(req.query["month"] ?? "").trim();
  const hasExplicitPeriod = rawYear !== "" || rawMonth !== "";
  const year = Number(rawYear);
  const month = Number(rawMonth);

  if (
    hasExplicitPeriod &&
    (!Number.isInteger(year) || year <= 0 || !Number.isInteger(month) || month < 1 || month > 12)
  ) {
    res.status(400).json({
      error: "Parâmetros inválidos. Envie year e month válidos na query string.",
    });
    return;
  }

  if (!OPERATIONAL_SCHEDULE_SOURCE_PATH) {
    res.status(500).json({
      error: "OPERATIONAL_SCHEDULE_SOURCE_PATH não foi configurado no backend.",
    });
    return;
  }

  try {
    const fileBuffer = await readFile(OPERATIONAL_SCHEDULE_SOURCE_PATH);
    const workbookBuffer = toArrayBuffer(fileBuffer);

    const detected = detectMostRecentMonth(workbookBuffer);

    let parsed;
    if (!hasExplicitPeriod) {
      if (!detected) {
        throw new Error("Não foi possível detectar nenhum mês válido no arquivo configurado.");
      }
      parsed = parseOperationalPreviousMonth(
        workbookBuffer,
        detected.year,
        detected.month,
      );
    } else {
      parsed = parseOperationalPreviousMonth(workbookBuffer, year, month);
    }

    res.json(parsed);
  } catch (err) {
    logger.error(
      { err, sourcePath: OPERATIONAL_SCHEDULE_SOURCE_PATH, year, month },
      "Failed to parse operational schedule source file",
    );
    res.status(500).json({
      error:
        "Não foi possível carregar a escala operacional privada configurada no servidor.",
    });
  }
});

export default router;
