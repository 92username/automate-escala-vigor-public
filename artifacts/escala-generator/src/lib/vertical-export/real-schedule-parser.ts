import { findOperatorByName, type VerticalOperatorRegistryEntry, VERTICAL_OPERATOR_REGISTRY } from "./operator-registry";
import {
  matchLegendDictionaryEntry,
  type VerticalLegendDictionaryEntry,
  type VerticalLegendDictionaryMatch,
  VERTICAL_LEGEND_DICTIONARY,
} from "./legend-dictionary";

export interface RealScheduleCsvParserOptions {
  yearOverride?: number;
  selectedMonths?: Array<number | RealScheduleCsvSelectedMonth>;
  monthRange?: RealScheduleCsvMonthRange;
  operatorRows?: RealScheduleCsvOperatorRowsOptions;
  operatorRegistry?: VerticalOperatorRegistryEntry[];
  legendDictionary?: VerticalLegendDictionaryEntry[];
}

export interface RealScheduleCsvSelectedMonth {
  month: number;
  year?: number;
}

export interface RealScheduleCsvMonthRange {
  startMonth: number;
  startYear?: number;
  endMonth: number;
  endYear?: number;
}

export interface RealScheduleCsvOperatorRowsOptions {
  nameColumn?: number;
}

export interface RealScheduleCsvMonthHeader {
  columnIndex: number;
  rawValue: string;
  normalizedValue: string;
  month: number;
  monthName: string;
  displayedYear?: number;
  effectiveYear: number;
}

export interface RealScheduleCsvDayColumn {
  columnIndex: number;
  rawDayValue: string;
  normalizedDayValue: string;
  day?: number;
  rawWeekdayValue: string;
  normalizedWeekdayValue: string;
}

export type RealScheduleCsvCellKind = "empty" | "shift" | "legend" | "unknown";

export interface RealScheduleCsvCellValue {
  columnIndex: number;
  rawValue: string;
  normalizedValue: string;
  kind: RealScheduleCsvCellKind;
  shiftCode?: "A" | "INT" | "B";
  legendMatch?: VerticalLegendDictionaryMatch;
}

export interface RealScheduleCsvUnknownCode {
  blockIndex: number;
  rowIndex: number;
  columnIndex: number;
  rawValue: string;
  normalizedValue: string;
}

export interface RealScheduleCsvUnknownOperator {
  rowIndex: number;
  rawLabel: string;
  normalizedLabel: string;
}

export interface RealScheduleCsvOperatorRow {
  rowIndex: number;
  rawLabel: string;
  normalizedLabel: string;
  sourceRole?: string;
  matchedOperator?: VerticalOperatorRegistryEntry;
  operatorCode?: string;
  cells: RealScheduleCsvCellValue[];
  unknownCodes: RealScheduleCsvUnknownCode[];
}

export interface RealScheduleCsvMonthBlock {
  blockIndex: number;
  columnStartIndex: number;
  columnEndIndex: number;
  rawHeaderValue: string;
  normalizedHeaderValue: string;
  month: number;
  monthName: string;
  displayedYear?: number;
  effectiveYear: number;
  effectiveMonthYearLabel: string;
  dayColumns: RealScheduleCsvDayColumn[];
  operatorRows: RealScheduleCsvOperatorRow[];
}

export interface RealScheduleCsvParseResult {
  sourceRows: string[][];
  headerRowIndex: number;
  weekdayRowIndex: number;
  dayRowIndex: number;
  monthHeaders: RealScheduleCsvMonthHeader[];
  monthBlocks: RealScheduleCsvMonthBlock[];
  selectedMonthBlock?: RealScheduleCsvMonthBlock;
  unknownOperators: RealScheduleCsvUnknownOperator[];
  unknownCodes: RealScheduleCsvUnknownCode[];
  yearOverride?: number;
}

const MONTH_ALIASES: Record<string, number> = {
  JANEIRO: 1,
  JAN: 1,
  FEVEREIRO: 2,
  FEV: 2,
  MARCO: 3,
  MAR: 3,
  ABRIL: 4,
  ABR: 4,
  MAIO: 5,
  MAI: 5,
  JUNHO: 6,
  JUN: 6,
  JULHO: 7,
  JUL: 7,
  AGOSTO: 8,
  AGO: 8,
  SETEMBRO: 9,
  SET: 9,
  OUTUBRO: 10,
  OUT: 10,
  NOVEMBRO: 11,
  NOV: 11,
  DEZEMBRO: 12,
  DEZ: 12,
};

const KNOWN_SHIFT_CODES = new Set(["A", "INT", "B"]);
const DEFAULT_OPERATOR_NAME_COLUMN = 1;
const EMPTY_ROW_STOP_THRESHOLD = 5;
const NON_OPERATOR_LABEL_PATTERNS = [
  /^$/,
  /^DIA\b/,
  /^DATA\b/,
  /^NOME\b/,
  /^OPERADOR\b/,
  /^EQUIPE\b/,
  /^ESCALA\b/,
  /^TURNO\b/,
  /^FOLGA\b/,
  /^OBS\b/,
  /^OBSERVA/,
  /^ALTERA/,
  /^TOTAL\b/,
  /^TOTAIS\b/,
  /^LEGENDA\b/,
  /^EFETIVO\b/,
  /^ENCARREGADOS?\b/,
  /^SUBSTITUTOS?\b/,
  /^ASS\b/,
  /^\d{1,2}\s*H\s*\d{0,2}\s*\/\s*\d{1,2}\s*H\s*\d{0,2}/,
  /^\d{1,2}\s*:\s*\d{2}\s*\/\s*\d{1,2}\s*:\s*\d{2}/,
];

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(value: string): string {
  return stripDiacritics(value)
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeCsvCell(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function parseCsv(input: string): string[][] {
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

function parseMonthHeader(value: string): { month: number; monthName: string; displayedYear?: number } | undefined {
  const normalized = normalizeText(value);
  const match = normalized.match(/^([A-Z]+)\/(\d{2,4})$/);
  if (!match) {
    return undefined;
  }

  const monthName = match[1] ?? "";
  const month = MONTH_ALIASES[monthName];
  if (!month) {
    return undefined;
  }

  const yearText = match[2];
  const parsedYear = Number(yearText);
  if (!Number.isFinite(parsedYear)) {
    return undefined;
  }

  return {
    month,
    monthName,
    displayedYear: yearText.length === 2 ? 2000 + parsedYear : parsedYear,
  };
}

function formatMonthYearLabel(monthName: string, year: number): string {
  return `${monthName}/${year}`;
}

function getEffectiveYear(displayedYear: number | undefined, yearOverride: number | undefined): number {
  return yearOverride ?? displayedYear ?? new Date().getFullYear();
}

function isMonthHeaderCell(value: string): boolean {
  return parseMonthHeader(value) !== undefined;
}

function findMonthHeaderCells(row: string[]): RealScheduleCsvMonthHeader[] {
  return row.flatMap((cell, columnIndex) => {
    if (!isMonthHeaderCell(cell)) {
      return [];
    }

    const parsed = parseMonthHeader(cell);
    if (!parsed) {
      return [];
    }

    return [
      {
        columnIndex,
        rawValue: cell,
        normalizedValue: normalizeText(cell),
        month: parsed.month,
        monthName: parsed.monthName,
        displayedYear: parsed.displayedYear,
        effectiveYear: parsed.displayedYear ?? 0,
      },
    ];
  });
}

function normalizeOperatorLabel(value: string): string {
  return normalizeText(value)
    .replace(/^[0-9./-]+\s*-\s*/, "")
    .replace(/^[0-9./-]+\s+/, "");
}

function extractOperatorLabel(row: string[], nameColumn?: number): string {
  const configured = typeof nameColumn === "number" ? row[nameColumn]?.trim() : undefined;
  if (configured) {
    return configured;
  }

  const primary = row[1]?.trim();
  if (primary) {
    return primary;
  }

  return row[0]?.trim() ?? "";
}

function isNonOperatorLabel(value: string): boolean {
  const normalized = normalizeText(value);
  return NON_OPERATOR_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function monthYearIndex(month: number, year?: number): number {
  return (year ?? 0) * 12 + month;
}

function selectedMonthMatchesHeader(
  selectedMonth: number | RealScheduleCsvSelectedMonth,
  header: RealScheduleCsvMonthHeader,
): boolean {
  if (typeof selectedMonth === "number") {
    return selectedMonth === header.month;
  }

  if (selectedMonth.month !== header.month) {
    return false;
  }

  if (typeof selectedMonth.year !== "number") {
    return true;
  }

  return selectedMonth.year === header.effectiveYear || selectedMonth.year === header.displayedYear;
}

function monthRangeMatchesHeader(
  range: RealScheduleCsvMonthRange,
  header: RealScheduleCsvMonthHeader,
): boolean {
  const current = monthYearIndex(header.month, header.effectiveYear);
  const start = monthYearIndex(range.startMonth, range.startYear ?? header.effectiveYear);
  const end = monthYearIndex(range.endMonth, range.endYear ?? header.effectiveYear);
  return current >= start && current <= end;
}

function shouldApplyYearOverrideToHeader(
  header: RealScheduleCsvMonthHeader,
  headerIndex: number,
  options: RealScheduleCsvParserOptions,
): boolean {
  if (headerIndex === 0) {
    return true;
  }

  if (typeof options.yearOverride !== "number") {
    return false;
  }

  if (options.selectedMonths?.some((selectedMonth) => {
    if (typeof selectedMonth === "number") {
      return selectedMonth === header.month;
    }
    return selectedMonth.month === header.month && (
      typeof selectedMonth.year !== "number" ||
      selectedMonth.year === options.yearOverride ||
      selectedMonth.year === header.displayedYear
    );
  })) {
    return true;
  }

  if (options.monthRange) {
    const effectiveHeader = { ...header, effectiveYear: options.yearOverride };
    return monthRangeMatchesHeader(options.monthRange, effectiveHeader);
  }

  return false;
}

function getSelectedMonthHeaders(
  headers: RealScheduleCsvMonthHeader[],
  options: RealScheduleCsvParserOptions,
): Array<{ header: RealScheduleCsvMonthHeader; headerIndex: number }> {
  const indexedHeaders = headers.map((header, headerIndex) => ({ header, headerIndex }));

  if (options.selectedMonths && options.selectedMonths.length > 0) {
    return indexedHeaders.filter(({ header }) =>
      options.selectedMonths?.some((selectedMonth) => selectedMonthMatchesHeader(selectedMonth, header)),
    );
  }

  if (options.monthRange) {
    return indexedHeaders.filter(({ header }) => monthRangeMatchesHeader(options.monthRange!, header));
  }

  return indexedHeaders;
}

function getOperatorScanBounds(rows: string[][], dayRowIndex: number): {
  scanStartIndex: number;
  scanEndIndex: number;
} {
  return {
    scanStartIndex: Math.max(0, dayRowIndex + 1),
    scanEndIndex: rows.length - 1,
  };
}

function rowHasScheduleValue(row: string[], dayColumns: RealScheduleCsvDayColumn[]): boolean {
  return dayColumns.some((column) => {
    const cell = row[column.columnIndex] ?? "";
    return normalizeCsvCell(cell).length > 0;
  });
}

function rowHasAnyValue(row: string[]): boolean {
  return row.some((cell) => normalizeCsvCell(cell).length > 0);
}

function collectOperatorCandidateRows(
  rows: string[][],
  options: RealScheduleCsvParserOptions,
  dayColumns: RealScheduleCsvDayColumn[],
): Array<{ row: string[]; rowIndex: number }> {
  const { scanStartIndex, scanEndIndex } = getOperatorScanBounds(rows, 3);
  const nameColumn = options.operatorRows?.nameColumn ?? DEFAULT_OPERATOR_NAME_COLUMN;
  const candidates: Array<{ row: string[]; rowIndex: number }> = [];
  let foundOperator = false;
  let emptyRowsAfterOperators = 0;

  for (let rowIndex = scanStartIndex; rowIndex <= scanEndIndex; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const rawLabel = extractOperatorLabel(row, nameColumn);
    const hasScheduleValue = rowHasScheduleValue(row, dayColumns);
    const isEmptyRow = !rowHasAnyValue(row);
    const isOperator = Boolean(rawLabel) && !isNonOperatorLabel(rawLabel) && hasScheduleValue;

    if (isOperator) {
      candidates.push({ row, rowIndex });
      foundOperator = true;
      emptyRowsAfterOperators = 0;
      continue;
    }

    if (foundOperator) {
      if (isEmptyRow || (!rawLabel && !hasScheduleValue)) {
        emptyRowsAfterOperators += 1;
      } else {
        emptyRowsAfterOperators = 0;
      }

      if (emptyRowsAfterOperators >= EMPTY_ROW_STOP_THRESHOLD) {
        break;
      }
    }
  }

  return candidates;
}

function getSequentialDayColumns(dayColumns: RealScheduleCsvDayColumn[]): RealScheduleCsvDayColumn[] {
  const firstDayIndex = dayColumns.findIndex((column) => column.day === 1);
  if (firstDayIndex < 0) {
    return dayColumns.filter((column) => typeof column.day === "number");
  }

  const sequential: RealScheduleCsvDayColumn[] = [];
  let expectedDay = 1;
  for (const column of dayColumns.slice(firstDayIndex)) {
    if (column.day !== expectedDay) {
      break;
    }
    sequential.push(column);
    expectedDay += 1;
  }

  return sequential;
}

function parseCellValue(
  rawValue: string,
  dictionary: VerticalLegendDictionaryEntry[],
): RealScheduleCsvCellValue {
  const normalizedValue = normalizeCsvCell(rawValue);
  if (!normalizedValue) {
    return {
      columnIndex: -1,
      rawValue,
      normalizedValue,
      kind: "empty",
    };
  }

  const normalizedCode = normalizeText(normalizedValue);
  if (KNOWN_SHIFT_CODES.has(normalizedCode)) {
    return {
      columnIndex: -1,
      rawValue,
      normalizedValue,
      kind: "shift",
      shiftCode: normalizedCode as "A" | "INT" | "B",
    };
  }

  const legendMatch = matchLegendDictionaryEntry(normalizedCode, dictionary);
  if (legendMatch) {
    return {
      columnIndex: -1,
      rawValue,
      normalizedValue,
      kind: "legend",
      legendMatch,
    };
  }

  return {
    columnIndex: -1,
    rawValue,
    normalizedValue,
    kind: "unknown",
  };
}

function sliceBlockRows(
  rows: string[][],
  blockIndex: number,
  header: RealScheduleCsvMonthHeader,
  nextHeader: RealScheduleCsvMonthHeader | undefined,
  options: RealScheduleCsvParserOptions,
  issues: {
    unknownOperators: RealScheduleCsvUnknownOperator[];
    unknownCodes: RealScheduleCsvUnknownCode[];
  },
): RealScheduleCsvMonthBlock {
  const endIndex = nextHeader?.columnIndex ?? rows[0]?.length ?? header.columnIndex;
  const dictionary = options.legendDictionary ?? VERTICAL_LEGEND_DICTIONARY;
  const registry = options.operatorRegistry ?? VERTICAL_OPERATOR_REGISTRY;
  const dayRow = rows[3] ?? [];
  const weekdayRow = rows[2] ?? [];
  const nameColumn = options.operatorRows?.nameColumn ?? DEFAULT_OPERATOR_NAME_COLUMN;

  const dayColumns = Array.from({ length: Math.max(0, endIndex - header.columnIndex) }, (_, offset) => {
    const columnIndex = header.columnIndex + offset;
    const rawDayValue = dayRow[columnIndex] ?? "";
    const rawWeekdayValue = weekdayRow[columnIndex] ?? "";
    const normalizedDayValue = normalizeCsvCell(rawDayValue);
    const normalizedWeekdayValue = normalizeCsvCell(rawWeekdayValue);
    const day = Number.parseInt(normalizedDayValue, 10);

    return {
      columnIndex,
      rawDayValue,
      normalizedDayValue,
      day: Number.isFinite(day) ? day : undefined,
      rawWeekdayValue,
      normalizedWeekdayValue,
    };
  });

  const actualDayColumns = getSequentialDayColumns(dayColumns);
  const candidateRows = collectOperatorCandidateRows(rows, options, actualDayColumns);

  const operatorRows = candidateRows.flatMap(({ row, rowIndex }) => {
    const rawLabel = extractOperatorLabel(row, nameColumn);
    const normalizedLabel = normalizeOperatorLabel(rawLabel);
    const sourceRole = nameColumn + 1 < header.columnIndex ? normalizeCsvCell(row[nameColumn + 1] ?? "") : "";
    const matchedOperator = findOperatorByName(rawLabel, registry);
    if (!matchedOperator) {
      issues.unknownOperators.push({
        rowIndex,
        rawLabel,
        normalizedLabel,
      });
    }

    const cells = actualDayColumns.map((dayColumn) => {
      const rawValue = row[dayColumn.columnIndex] ?? "";
      const parsed = parseCellValue(rawValue, dictionary);
      return {
        ...parsed,
        columnIndex: dayColumn.columnIndex,
      };
    });

    const unknownCodes = cells.flatMap((cell) => {
      if (cell.kind !== "unknown") {
        return [];
      }
      if (!cell.normalizedValue) {
        return [];
      }
      return [
        {
          blockIndex,
          rowIndex,
          columnIndex: cell.columnIndex,
          rawValue: cell.rawValue,
          normalizedValue: cell.normalizedValue,
        },
      ];
    });

    issues.unknownCodes.push(...unknownCodes);

    return [
      {
        rowIndex,
        rawLabel,
        normalizedLabel,
        sourceRole: sourceRole || undefined,
        matchedOperator,
        operatorCode: matchedOperator?.code,
        cells,
        unknownCodes,
      },
    ];
  });

  return {
    blockIndex,
    columnStartIndex: header.columnIndex,
    columnEndIndex: endIndex,
    rawHeaderValue: header.rawValue,
    normalizedHeaderValue: header.normalizedValue,
    month: header.month,
    monthName: header.monthName,
    displayedYear: header.displayedYear,
    effectiveYear: header.effectiveYear,
    effectiveMonthYearLabel: formatMonthYearLabel(header.monthName, header.effectiveYear),
    dayColumns: actualDayColumns,
    operatorRows,
  };
}

export function parseRealScheduleCsv(
  csvText: string,
  options: RealScheduleCsvParserOptions = {},
): RealScheduleCsvParseResult {
  const rows = parseCsv(csvText);
  if (rows.length < 4) {
    throw new Error("CSV does not contain the required row structure for the ICA vertical import");
  }

  const headerRowIndex = 1;
  const weekdayRowIndex = 2;
  const dayRowIndex = 3;

  const monthHeaders = findMonthHeaderCells(rows[headerRowIndex] ?? []);
  if (monthHeaders.length === 0) {
    throw new Error("CSV does not contain any month headers in row 2");
  }

  const normalizedMonthHeaders = monthHeaders.map((header, index) => ({
    ...header,
    effectiveYear: shouldApplyYearOverrideToHeader(header, index, options)
      ? getEffectiveYear(header.displayedYear, options.yearOverride)
      : getEffectiveYear(header.displayedYear, undefined),
  }));

  const issues = {
    unknownOperators: [] as RealScheduleCsvUnknownOperator[],
    unknownCodes: [] as RealScheduleCsvUnknownCode[],
  };

  const selectedHeaders = getSelectedMonthHeaders(normalizedMonthHeaders, options);
  const monthBlocks = selectedHeaders.map(({ header, headerIndex }) =>
    sliceBlockRows(
      rows,
      headerIndex,
      header,
      normalizedMonthHeaders[headerIndex + 1],
      options,
      issues,
    ),
  );

  return {
    sourceRows: rows,
    headerRowIndex,
    weekdayRowIndex,
    dayRowIndex,
    monthHeaders: normalizedMonthHeaders,
    monthBlocks,
    selectedMonthBlock: monthBlocks[0],
    unknownOperators: issues.unknownOperators,
    unknownCodes: issues.unknownCodes,
    yearOverride: options.yearOverride,
  };
}
