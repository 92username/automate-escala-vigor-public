import { weekdayOf } from "../calendar";
import type {
  VerticalSchedule,
  VerticalScheduleConversionOptions,
  VerticalScheduleDiagnostic,
  VerticalScheduleLegendEntry,
  VerticalScheduleObservationEntry,
  VerticalScheduleOffEntry,
  VerticalScheduleShiftEntry,
} from "./models";
import type {
  RealScheduleCsvCellValue,
  RealScheduleCsvMonthBlock,
  RealScheduleCsvParseResult,
} from "./real-schedule-parser";
import { calculateRealScheduleHeaderMetrics } from "./header-calculations";
import { formatOfficialVerticalWeekdayLabel } from "./weekday-label";

export interface RealScheduleToVerticalScheduleOptions extends VerticalScheduleConversionOptions {
  monthBlock?: RealScheduleCsvMonthBlock;
}

function formatMonthYearLabel(monthName: string, year: number): string {
  return `${monthName.toUpperCase()}/${year}`;
}

function makeTemporaryOperatorCode(index: number): string {
  return `OP${String(index + 1).padStart(2, "0")}`;
}

function normalizeInitial(token: string): string {
  return token.replace(/\.$/, "").charAt(0);
}

export function formatVerticalOperatorName(rawLabel: string): string {
  const cleanLabel = rawLabel
    .replace(/^\s*\d[\d./]*(?:-\d[\d./]*)?\s*-\s*/, "")
    .replace(/^\s*\d[\d./-]+\s+/, "")
    .replace(/\s*-\s*JG\d+\s*$/i, "")
    .trim()
    .replace(/\s+/g, " ");
  const tokens = cleanLabel.split(" ").filter(Boolean);

  if (tokens.length <= 2) {
    return cleanLabel;
  }

  const particles = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);
  const first = tokens[0]!;
  const last = tokens[tokens.length - 1]!;
  const middle = tokens.slice(1, -1).map((token) => {
    if (particles.has(token.toUpperCase())) {
      return token;
    }
    return normalizeInitial(token);
  });

  return [first, ...middle, last].join(" ");
}

function normalizeCellDescription(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isRegularShiftValue(value: string): boolean {
  const normalized = normalizeCellDescription(value).toUpperCase();
  return normalized === "" || normalized === "A" || normalized === "B" || normalized === "INT";
}

function mapObservationDescription(value: string): string {
  const description = normalizeCellDescription(value);
  const normalized = description.toUpperCase();
  if (normalized === "F") {
    return "Férias";
  }
  const tokens = normalized.split(/[^A-Z0-9]+/).filter(Boolean);
  if (tokens.includes("CEMAL") || tokens.includes("CMA")) {
    return "Inspeção de Saúde - CEMAL";
  }
  return description;
}

function getSelectedMonthBlock(
  parseResult: RealScheduleCsvParseResult,
  options: RealScheduleToVerticalScheduleOptions,
): RealScheduleCsvMonthBlock {
  const monthBlock = options.monthBlock ?? parseResult.selectedMonthBlock;
  if (!monthBlock) {
    throw new Error("No selected month block is available for VerticalSchedule mapping");
  }
  return monthBlock;
}

function buildLegend(
  block: RealScheduleCsvMonthBlock,
  diagnostics: VerticalScheduleDiagnostic[],
): VerticalScheduleLegendEntry[] {
  let temporaryIndex = 0;
  return block.operatorRows.map((row) => {
    const spreadsheetName = formatVerticalOperatorName(row.rawLabel);
    if (row.matchedOperator && row.operatorCode) {
      return {
        code: row.operatorCode,
        operator: spreadsheetName || row.operatorCode,
        role: row.matchedOperator.group,
        sourceOperatorLabel: row.rawLabel,
        source: "schedule",
        responsibility: "system",
      };
    }

    const fallbackCode = makeTemporaryOperatorCode(temporaryIndex);
    temporaryIndex += 1;
    diagnostics.push({
      severity: "warning",
      code: "UNMATCHED_OPERATOR",
      message: `Operator "${row.rawLabel}" was not found in the official vertical operator registry and was preserved with temporary export code ${fallbackCode}. Review the registry before official use.`,
      rowIndex: row.rowIndex,
      rawValue: row.rawLabel,
    });

    return {
      code: fallbackCode,
      operator: spreadsheetName || fallbackCode,
      sourceOperatorLabel: row.rawLabel,
      source: "schedule",
      responsibility: "system",
    };
  });
}

interface AutomaticObservationPeriod {
  operator: string;
  description: string;
  startDay: number;
  endDay: number;
  order: number;
}

function formatDay(day: number): string {
  return String(day).padStart(2, "0");
}

function periodText(period: AutomaticObservationPeriod): string {
  if (period.startDay === period.endDay) {
    return `Dia ${formatDay(period.startDay)} - ${period.operator} - ${period.description}`;
  }
  return `Dias ${formatDay(period.startDay)} a ${formatDay(period.endDay)} - ${period.operator} - ${period.description}`;
}

function buildSupportStaffObservation(
  block: RealScheduleCsvMonthBlock,
  legend: VerticalScheduleLegendEntry[],
): VerticalScheduleObservationEntry | undefined {
  const supportCodes = legend
    .flatMap((entry, rowIndex) => {
      if (!/^C0[12]$/i.test(entry.code)) {
        return [];
      }

      const row = block.operatorRows[rowIndex];
      const hasScheduledShift = row?.cells.some((cell) => cell.kind === "shift") ?? false;
      return hasScheduledShift ? [entry.code] : [];
    })
    .sort((left, right) => left.localeCompare(right, "pt-BR", { numeric: true }));

  if (supportCodes.length === 0) {
    return undefined;
  }

  const formattedCodes =
    supportCodes.length === 1
      ? supportCodes[0]!
      : `${supportCodes.slice(0, -1).join(", ")} e ${supportCodes[supportCodes.length - 1]}`;

  return {
    label: "OBS",
    text: `Efetivo de Apoio: ${formattedCodes} - carga horária reduzida para manutenção de respectiva CHT, conforme item 5.3 da ICA 100-18/2020;`,
    source: "derived",
  };
}

function buildAutomaticObservationPeriods(
  block: RealScheduleCsvMonthBlock,
  legend: VerticalScheduleLegendEntry[],
): AutomaticObservationPeriod[] {
  const periods: AutomaticObservationPeriod[] = [];
  let order = 0;

  block.operatorRows.forEach((row, rowIndex) => {
    const operator = legend[rowIndex]?.operator;
    if (!operator) {
      return;
    }

    let current: AutomaticObservationPeriod | undefined;
    const flushCurrent = () => {
      if (current) {
        periods.push(current);
        current = undefined;
      }
    };

    for (const dayColumn of block.dayColumns) {
      if (typeof dayColumn.day !== "number") {
        continue;
      }

      const cell = row.cells.find((entry) => entry.columnIndex === dayColumn.columnIndex);
      const rawValue = cell?.rawValue ?? "";
      if (isRegularShiftValue(rawValue)) {
        flushCurrent();
        continue;
      }

      const description = mapObservationDescription(rawValue);
      if (!description) {
        flushCurrent();
        continue;
      }

      if (current && current.description === description && current.endDay + 1 === dayColumn.day) {
        current.endDay = dayColumn.day;
        continue;
      }

      flushCurrent();
      current = {
        operator,
        description,
        startDay: dayColumn.day,
        endDay: dayColumn.day,
        order,
      };
      order += 1;
    }

    flushCurrent();
  });

  return periods;
}

export function buildAutomaticVerticalScheduleObservations(
  block: RealScheduleCsvMonthBlock,
  legend: VerticalScheduleLegendEntry[],
): VerticalScheduleObservationEntry[] {
  const periods = buildAutomaticObservationPeriods(block, legend);
  const vacationObservations = periods
    .filter((period) => period.description === "Férias")
    .map((period) => ({
      label: "OBS",
      text: periodText(period),
      source: "derived" as const,
    }));
  const supportObservation = buildSupportStaffObservation(block, legend);
  const otherObservations = periods
    .filter((period) => period.description !== "Férias")
    .sort((left, right) => left.order - right.order)
    .map((period) => ({
      label: "OBS",
      text: periodText(period),
      source: "derived" as const,
    }));

  return [
    ...vacationObservations,
    ...(supportObservation ? [supportObservation] : []),
    ...otherObservations,
  ];
}

function isOffCell(cell: RealScheduleCsvCellValue | undefined): boolean {
  return !cell || cell.kind === "empty" || cell.kind === "legend" || cell.kind === "unknown";
}

function buildShiftEntries(
  block: RealScheduleCsvMonthBlock,
  legend: VerticalScheduleLegendEntry[],
): VerticalScheduleShiftEntry[] {
  const shifts: Array<"A" | "INT" | "B"> = ["A", "INT", "B"];
  const validDays = block.dayColumns.filter((column) => typeof column.day === "number");

  return validDays.flatMap((dayColumn) =>
    shifts.map((shift) => ({
      day: dayColumn.day!,
      shift,
      operatorCodes: block.operatorRows.flatMap((row, rowIndex) => {
        const cell = row.cells.find((current) => current.columnIndex === dayColumn.columnIndex);
        return cell?.kind === "shift" && cell.shiftCode === shift ? [legend[rowIndex]!.code] : [];
      }),
    })),
  );
}

function buildOffEntries(
  block: RealScheduleCsvMonthBlock,
  legend: VerticalScheduleLegendEntry[],
): VerticalScheduleOffEntry[] {
  const validDays = block.dayColumns.filter((column) => typeof column.day === "number");
  return validDays.map((dayColumn) => ({
    day: dayColumn.day!,
    operatorCodes: block.operatorRows.flatMap((row, rowIndex) => {
      const cell = row.cells.find((current) => current.columnIndex === dayColumn.columnIndex);
      return isOffCell(cell) ? [legend[rowIndex]!.code] : [];
    }),
  }));
}

function buildUnknownCodeDiagnostics(
  parseResult: RealScheduleCsvParseResult,
  block: RealScheduleCsvMonthBlock,
): VerticalScheduleDiagnostic[] {
  const selectedBlockDiagnostics: VerticalScheduleDiagnostic[] = block.operatorRows.flatMap((row) =>
    row.unknownCodes.map((unknown) => {
      const day = block.dayColumns.find((column) => column.columnIndex === unknown.columnIndex)?.day;
      return {
        severity: "warning" as const,
        code: "UNKNOWN_CELL_CODE",
        message: `Unknown schedule code "${unknown.rawValue}" was preserved as an off/unavailable value.`,
        day,
        rowIndex: unknown.rowIndex,
        columnIndex: unknown.columnIndex,
        rawValue: unknown.rawValue,
      };
    }),
  );
  const outsideBlockDiagnostics: VerticalScheduleDiagnostic[] = parseResult.unknownCodes
    .filter((unknown) => unknown.blockIndex !== block.blockIndex)
    .map((unknown) => ({
      severity: "info",
      code: "UNKNOWN_CELL_CODE_OUTSIDE_SELECTED_MONTH",
      message: `Unknown schedule code "${unknown.rawValue}" exists outside the selected month block.`,
      rowIndex: unknown.rowIndex,
      columnIndex: unknown.columnIndex,
      rawValue: unknown.rawValue,
    }));

  return [...selectedBlockDiagnostics, ...outsideBlockDiagnostics];
}

export function convertRealScheduleParseResultToVerticalSchedule(
  parseResult: RealScheduleCsvParseResult,
  options: RealScheduleToVerticalScheduleOptions,
): VerticalSchedule {
  const block = getSelectedMonthBlock(parseResult, options);
  const diagnostics: VerticalScheduleDiagnostic[] = [];
  const legend = buildLegend(block, diagnostics);
  diagnostics.push(...buildUnknownCodeDiagnostics(parseResult, block));

  const days = block.dayColumns
    .filter((column) => typeof column.day === "number")
    .map((column) => ({
      day: column.day!,
      weekday: weekdayOf(block.effectiveYear, block.month, column.day!),
      weekdayLabel: formatOfficialVerticalWeekdayLabel(block.effectiveYear, block.month, column.day!),
    }));
  const shifts = buildShiftEntries(block, legend);
  const offs = buildOffEntries(block, legend);
  const headerMetrics = calculateRealScheduleHeaderMetrics(block);
  const automaticObservations = buildAutomaticVerticalScheduleObservations(block, legend);
  const noteObservations = (options.notes ?? []).map((text) => ({
    label: "OBS",
    text,
    source: "manual" as const,
  }));
  const observations = [...automaticObservations, ...noteObservations];

  return {
    section: "monthlySummary",
    header: {
      crcea: options.header.crcea,
      localidade: options.header.localidade,
      orgao: options.header.orgao,
      month: block.month,
      year: block.effectiveYear,
      monthYearLabel: formatMonthYearLabel(block.monthName, block.effectiveYear),
      totalStaff: options.header.totalStaff ?? headerMetrics.totalStaff,
      scheduleStaff: options.header.scheduleStaff ?? headerMetrics.scheduleStaff,
      monthlyWorkloadBase: String(headerMetrics.monthlyWorkloadBase),
      averageMonthlyHours: String(headerMetrics.averageMonthlyHours),
      monthlyAverageHours: headerMetrics.monthlyAverageHours,
      trainingHours: options.header.trainingHours,
      escalante: options.header.escalante,
      headOfOrg: options.header.headOfOrg,
      headOfDivision: options.header.headOfDivision,
    },
    daySchedule: {
      days,
      shifts,
      offs,
      observations: [],
    },
    legend,
    observations,
    monthlySummary: {
      generatedAt: options.generatedAt,
      totalDays: days.length,
      totalOperators: block.operatorRows.length,
      totalLegendEntries: legend.length,
      totalObservations: observations.length,
      notes: options.notes,
    },
    sourceReference: {
      type: "real-schedule-csv",
      monthBlockIndex: block.blockIndex,
      rawHeaderValue: block.rawHeaderValue,
      displayedYear: block.displayedYear,
      effectiveYear: block.effectiveYear,
      yearOverride: parseResult.yearOverride,
      columnStartIndex: block.columnStartIndex,
      columnEndIndex: block.columnEndIndex,
      headerRowIndex: parseResult.headerRowIndex,
      weekdayRowIndex: parseResult.weekdayRowIndex,
      dayRowIndex: parseResult.dayRowIndex,
    },
    diagnostics,
  };
}
