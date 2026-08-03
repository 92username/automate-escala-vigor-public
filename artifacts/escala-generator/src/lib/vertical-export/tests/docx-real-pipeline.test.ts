import { stat } from "node:fs/promises";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_REAL_VERTICAL_SCHEDULE_DOCX_OUTPUT_PATH,
  generateRealVerticalScheduleDocx,
  normalizeRealScheduleCsvForVerticalParser,
} from "../docx-real-pipeline";

const maybeDescribe = process.env.RUN_REAL_DOCX_PIPELINE === "1" ? describe : describe.skip;
const matriculaPrefixPattern = /^\d[\d./]*(?:-\d[\d./]*)?\s*-\s*/;
const jgSuffixPattern = /\s*-\s*JG\d+\s*$/i;

maybeDescribe("real CSV to DOCX vertical schedule pipeline", () => {
  it("parses the normalized real CSV, maps June 2026, and writes an editable DOCX", async () => {
    const result = await generateRealVerticalScheduleDocx();
    const outputStats = await stat(result.summary.outputPath);

    console.info("Real DOCX pipeline summary", result.summary);

    expect(result.summary.preambleNormalizationApplied).toBe(true);
    expect(result.summary.physicalLinesRemoved).toBeGreaterThanOrEqual(3);
    expect(result.selectedMonthBlock.month).toBe(6);
    expect(result.selectedMonthBlock.effectiveYear).toBe(2026);
    expect(result.parseResult.monthBlocks.map((block) => block.month)).toEqual(expect.arrayContaining([5, 6]));
    expect(result.summary.operatorsParsed).toBeGreaterThan(0);
    expect(result.summary.daysParsed).toBe(30);
    expect(result.schedule.observations.length).toBeGreaterThan(0);
    expect(result.docx.filledFields).toEqual(expect.arrayContaining(["observations"]));
    expect(result.summary.outputPath.endsWith(DEFAULT_REAL_VERTICAL_SCHEDULE_DOCX_OUTPUT_PATH)).toBe(true);
    expect(outputStats.size).toBeGreaterThan(0);
    expect(result.docx.docxBytes[0]).toBe(0x50);
    expect(result.docx.docxBytes[1]).toBe(0x4b);
    expect(result.schedule.legend.map((entry) => entry.code)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^OP\d+$/)]),
    );
    for (const entry of result.schedule.legend) {
      expect(entry.operator.trim()).not.toBe("");
      expect(entry.operator).not.toMatch(matriculaPrefixPattern);
      expect(entry.operator).not.toMatch(jgSuffixPattern);
    }
    const zip = await JSZip.loadAsync(result.docx.docxBytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    expect(documentXml).not.toMatch(/OP\d+/);
    expect(result.schedule.sourceReference).toEqual(
      expect.objectContaining({
        type: "real-schedule-csv",
        effectiveYear: 2026,
        yearOverride: 2026,
      }),
    );
  });
});

describe("real CSV preamble normalization", () => {
  it("keeps parser month headers on row 1 after removing the real CSV preamble", () => {
    const normalized = normalizeRealScheduleCsvForVerticalParser([
      "metadata",
      "more metadata",
      "third metadata",
      "tail metadata",
      ";;;maio/2026;;;;junho/2026",
      ";;;qui;sex;sab;dom",
      ";;;01;02;03;04",
    ].join("\n"));

    const rows = normalized.normalizedCsvText.split("\n");

    expect(normalized.preambleNormalizationApplied).toBe(true);
    expect(normalized.physicalLinesRemoved).toBe(4);
    expect(rows[0]).toBe("");
    expect(rows[1]).toContain("maio/2026");
    expect(rows[2]).toContain("qui");
    expect(rows[3]).toContain("01");
  });
});
