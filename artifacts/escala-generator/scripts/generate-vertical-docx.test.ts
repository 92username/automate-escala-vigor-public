import { copyFile, mkdtemp, stat, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateRealVerticalScheduleDocx,
  REAL_VERTICAL_SCHEDULE_CSV_ASSET_PATH,
} from "../src/lib/vertical-export/docx-real-pipeline";

describe("manual real vertical DOCX generation", () => {
  it("generates a DOCX from the real CSV pipeline into a temporary output folder", async () => {
    try {
      await access(REAL_VERTICAL_SCHEDULE_CSV_ASSET_PATH);
    } catch {
      return;
    }

    const outputDir = await mkdtemp(join(tmpdir(), "escala-generator-vertical-docx-"));
    const manualOutputPath = join(outputDir, "escala-vertical-teste.docx");
    const result = await generateRealVerticalScheduleDocx();

    await copyFile(result.summary.outputPath, manualOutputPath);

    const outputStats = await stat(manualOutputPath);

    console.info("Manual vertical DOCX generated", {
      sourceCsv: result.csvPath,
      pipelineOutputPath: result.summary.outputPath,
      manualOutputPath,
      renderedMonth: result.summary.renderedMonth,
      renderedYear: result.summary.renderedYear,
      operatorsParsed: result.summary.operatorsParsed,
      daysParsed: result.summary.daysParsed,
      bytes: outputStats.size,
    });

    expect(outputStats.size).toBeGreaterThan(0);
    expect(result.docx.docxBytes[0]).toBe(0x50);
    expect(result.docx.docxBytes[1]).toBe(0x4b);
  });
});
