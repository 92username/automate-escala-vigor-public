import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FillVerticalScheduleDocxTemplateResult } from "./docx-template-filler";
import { fillVerticalScheduleDocxTemplate } from "./docx-template-filler";
import type { VerticalSchedule, VerticalScheduleDiagnostic } from "./models";
import { parseRealScheduleCsv, type RealScheduleCsvMonthBlock, type RealScheduleCsvParseResult } from "./real-schedule-parser";
import { convertRealScheduleParseResultToVerticalSchedule } from "./real-schedule-to-vertical";

export const REAL_VERTICAL_SCHEDULE_CSV_ASSET_PATH =
  "assets/real-schedule.csv";

export const DEFAULT_REAL_VERTICAL_SCHEDULE_DOCX_OUTPUT_PATH =
  "artifacts/escala-generator/tmp/vertical-schedule-real-filled.docx";

const REAL_PIPELINE_YEAR = 2026;
const REAL_PIPELINE_SELECTED_MONTHS = [
  { month: 5, year: 2026 },
  { month: 6, year: 2026 },
] as const;

export interface RealDocxPipelineSummary {
  operatorsParsed: number;
  daysParsed: number;
  diagnosticsCount: number;
  warningCount: number;
  unknownCodeCount: number;
  outputPath: string;
  renderedMonth: number;
  renderedYear: number;
  preambleNormalizationApplied: boolean;
  physicalLinesRemoved: number;
}

export interface RealDocxPipelineResult {
  csvPath: string;
  normalizedCsvText: string;
  parseResult: RealScheduleCsvParseResult;
  selectedMonthBlock: RealScheduleCsvMonthBlock;
  schedule: VerticalSchedule;
  docx: FillVerticalScheduleDocxTemplateResult;
  summary: RealDocxPipelineSummary;
}

function resolveWorkspacePath(path: string): string {
  const cwd = process.cwd();
  if (cwd.endsWith("artifacts/escala-generator")) {
    return join(cwd, "..", "..", path);
  }
  return join(cwd, path);
}

function decodeRealScheduleCsv(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

function looksLikeMonthHeaderLine(line: string): boolean {
  const monthHeaderMatches = line.match(/(?:^|;)(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/\d{2,4}(?:;|$)/gi);
  return (monthHeaderMatches?.length ?? 0) >= 2;
}

function parseCsvRecords(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (char === "\"") {
        if (next === "\"") {
          current += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }
    if (char === ";") {
      row.push(current);
      current = "";
      continue;
    }
    if (char === "\r") {
      continue;
    }
    if (char === "\n") {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function serializeCsvCell(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function serializeCsvRows(rows: string[][]): string {
  return `${rows.map((row) => row.map(serializeCsvCell).join(";")).join("\n")}\n`;
}

function rowLooksLikeMonthHeader(row: string[]): boolean {
  return looksLikeMonthHeaderLine(row.join(";"));
}

export function normalizeRealScheduleCsvForVerticalParser(csvText: string): {
  normalizedCsvText: string;
  preambleNormalizationApplied: boolean;
  physicalLinesRemoved: number;
} {
  const records = parseCsvRecords(csvText);
  if (records.length >= 4 && rowLooksLikeMonthHeader(records[1] ?? [])) {
    return {
      normalizedCsvText: serializeCsvRows([[], ...records.slice(1)]),
      preambleNormalizationApplied: true,
      physicalLinesRemoved: 3,
    };
  }

  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const monthHeaderLineIndex = lines.findIndex(looksLikeMonthHeaderLine);

  if (monthHeaderLineIndex <= 0) {
    return {
      normalizedCsvText: csvText,
      preambleNormalizationApplied: false,
      physicalLinesRemoved: 0,
    };
  }

  /*
   * The parser contract expects row 1 to contain month headers, row 2 weekdays,
   * and row 3 day numbers. The real CSV has a metadata/header preamble before
   * the month-header line. Keep a placeholder row 0 and start parser content at
   * the detected month-header line. This is local to the real DOCX pipeline.
   */
  return {
    normalizedCsvText: ["", ...lines.slice(monthHeaderLineIndex)].join("\n"),
    preambleNormalizationApplied: true,
    physicalLinesRemoved: monthHeaderLineIndex,
  };
}

function findJune2026Block(parseResult: RealScheduleCsvParseResult): RealScheduleCsvMonthBlock {
  const block = parseResult.monthBlocks.find(
    (monthBlock) => monthBlock.month === 6 && monthBlock.effectiveYear === REAL_PIPELINE_YEAR,
  );
  if (!block) {
    throw new Error("June 2026 month block was not found in the normalized real CSV");
  }
  return block;
}

function countWarnings(diagnostics: VerticalScheduleDiagnostic[] | undefined): number {
  return diagnostics?.filter((diagnostic) => diagnostic.severity === "warning").length ?? 0;
}

export async function generateRealVerticalScheduleDocx(): Promise<RealDocxPipelineResult> {
  const csvPath = resolveWorkspacePath(REAL_VERTICAL_SCHEDULE_CSV_ASSET_PATH);
  const csvBytes = await readFile(csvPath);
  const decodedCsvText = decodeRealScheduleCsv(csvBytes);
  const normalized = normalizeRealScheduleCsvForVerticalParser(decodedCsvText);
  const parseResult = parseRealScheduleCsv(normalized.normalizedCsvText, {
    yearOverride: REAL_PIPELINE_YEAR,
    selectedMonths: [...REAL_PIPELINE_SELECTED_MONTHS],
    operatorRows: {
      nameColumn: 1,
    },
  });
  const selectedMonthBlock = findJune2026Block(parseResult);
  const schedule = convertRealScheduleParseResultToVerticalSchedule(parseResult, {
    monthBlock: selectedMonthBlock,
    header: {
      crcea: "CRCEA-SE",
      localidade: "ARACAJU-SE",
      orgao: "APP",
      escalante: "A DEFINIR",
    },
    generatedAt: "2026-06-30T00:00:00.000Z",
  });
  const outputPath = resolveWorkspacePath(DEFAULT_REAL_VERTICAL_SCHEDULE_DOCX_OUTPUT_PATH);
  const docx = await fillVerticalScheduleDocxTemplate(schedule, { outputPath });
  const diagnostics = schedule.diagnostics ?? [];
  const summary: RealDocxPipelineSummary = {
    operatorsParsed: selectedMonthBlock.operatorRows.length,
    daysParsed: schedule.daySchedule.days.length,
    diagnosticsCount: diagnostics.length,
    warningCount: countWarnings(diagnostics),
    unknownCodeCount: parseResult.unknownCodes.length,
    outputPath: docx.outputPath,
    renderedMonth: selectedMonthBlock.month,
    renderedYear: selectedMonthBlock.effectiveYear,
    preambleNormalizationApplied: normalized.preambleNormalizationApplied,
    physicalLinesRemoved: normalized.physicalLinesRemoved,
  };

  return {
    csvPath,
    normalizedCsvText: normalized.normalizedCsvText,
    parseResult,
    selectedMonthBlock,
    schedule,
    docx,
    summary,
  };
}
