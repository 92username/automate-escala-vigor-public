import { monthLabel } from "../calendar";
import type {
  DayAssignment,
  EmployeeRow,
  ScheduleResult,
} from "../types";
import {
  fallbackVerticalCode,
  getDefaultVerticalCodeForOperator,
  getOfficialVerticalNameForOperator,
  normalizeVerticalCode,
} from "../vertical-operator-codes";
import { calculateGeneratedScheduleHeaderMetrics } from "./header-calculations";
import type {
  VerticalSchedule,
  VerticalScheduleConversionOptions,
  VerticalScheduleDayCell,
  VerticalScheduleLegendEntry,
  VerticalScheduleObservationEntry,
  VerticalScheduleOffEntry,
  VerticalScheduleShiftEntry,
} from "./models";
import { formatOfficialVerticalWeekdayLabel } from "./weekday-label";

function formatMonthYearLabel(year: number, month: number): string {
  return `${monthLabel(month).toUpperCase()}/${year}`;
}

function makeLegendCode(index: number): string {
  return fallbackVerticalCode(index);
}

function isWorkingAssignment(day: DayAssignment): day is DayAssignment & { shift: "A" | "INT" | "B" } {
  return day.kind === "WORK" && (day.shift === "A" || day.shift === "INT" || day.shift === "B");
}

function getAssignmentForDay(row: EmployeeRow, day: number): DayAssignment {
  const assignment = row.days.find((currentDay) => currentDay.date === day);
  if (!assignment) {
    throw new Error(`Missing assignment for day ${day} on employee ${row.employee.id}`);
  }
  return assignment;
}

function resolveVerticalCode(row: EmployeeRow, index: number): string {
  const editedCode = row.employee.verticalCode ? normalizeVerticalCode(row.employee.verticalCode) : "";
  return editedCode || getDefaultVerticalCodeForOperator(row.employee.name) || makeLegendCode(index);
}

function verticalCodeSortKey(code: string): [number, number, string] {
  const normalized = normalizeVerticalCode(code);
  const teamOrder = ["A", "B", "C"];
  const teamIndex = teamOrder.indexOf(normalized[0] ?? "");
  const numericPart = Number(normalized.slice(1).match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
  return [
    teamIndex === -1 ? teamOrder.length : teamIndex,
    Number.isFinite(numericPart) ? numericPart : Number.MAX_SAFE_INTEGER,
    normalized,
  ];
}

function compareLegendEntries(a: VerticalScheduleLegendEntry, b: VerticalScheduleLegendEntry): number {
  const [teamA, numberA, codeA] = verticalCodeSortKey(a.code);
  const [teamB, numberB, codeB] = verticalCodeSortKey(b.code);
  return teamA - teamB || numberA - numberB || codeA.localeCompare(codeB) || a.operator.localeCompare(b.operator);
}

function buildLegend(rows: EmployeeRow[]): VerticalScheduleLegendEntry[] {
  return rows.map((row, index) => ({
    code: resolveVerticalCode(row, index),
    operator: getOfficialVerticalNameForOperator(row.employee.name) ?? row.employee.name,
    role: row.employee.role,
    source: "schedule" as const,
    responsibility: "system" as const,
  })).sort(compareLegendEntries);
}

function buildDayScheduleDays(result: ScheduleResult): VerticalScheduleDayCell[] {
  return result.perDay.map((day) => ({
    day: day.date,
    weekday: day.weekday,
    weekdayLabel: formatOfficialVerticalWeekdayLabel(result.year, result.month, day.date),
  }));
}

function buildShiftEntries(result: ScheduleResult): VerticalScheduleShiftEntry[] {
  const shifts: Array<"A" | "INT" | "B"> = ["A", "INT", "B"];

  return result.perDay.flatMap((day) => {
    const codesByShift: Record<"A" | "INT" | "B", string[]> = {
      A: [],
      INT: [],
      B: [],
    };

    result.rows.forEach((row, index) => {
      const assignment = getAssignmentForDay(row, day.date);
      if (isWorkingAssignment(assignment)) {
        const code = resolveVerticalCode(row, index);
        codesByShift[assignment.shift].push(code);
      }
    });

    return shifts.map((shift) => ({
      day: day.date,
      shift,
      operatorCodes: codesByShift[shift],
    }));
  });
}

function buildOffEntries(result: ScheduleResult): VerticalScheduleOffEntry[] {
  return result.perDay.map((day) => {
    const operatorCodes: string[] = [];

    result.rows.forEach((row, index) => {
      const assignment = getAssignmentForDay(row, day.date);
      if (!isWorkingAssignment(assignment)) {
        operatorCodes.push(resolveVerticalCode(row, index));
      }
    });

    return {
      day: day.date,
      operatorCodes,
    };
  });
}

function buildObservations(result: ScheduleResult, notes: string[] = []): VerticalScheduleObservationEntry[] {
  const warningObservations = result.warnings.map((text) => ({
    label: "AVISO",
    text,
    source: "schedule" as const,
  }));

  const violationObservations = result.violations.map((text) => ({
    label: "VIOLAÇÃO",
    text,
    source: "schedule" as const,
  }));

  const noteObservations = notes.map((text) => ({
    label: "OBS",
    text,
    source: "manual" as const,
  }));

  return [...warningObservations, ...violationObservations, ...noteObservations];
}

export function convertScheduleToVerticalSchedule(
  result: ScheduleResult,
  options: VerticalScheduleConversionOptions,
): VerticalSchedule {
  const legend = buildLegend(result.rows);
  const observations = buildObservations(result, options.notes ?? []);
  const headerMetrics = calculateGeneratedScheduleHeaderMetrics(result.year, result.month, result.rows);

  return {
    section: "monthlySummary",
    header: {
      crcea: options.header.crcea,
      localidade: options.header.localidade,
      orgao: options.header.orgao,
      month: result.month,
      year: result.year,
      monthYearLabel: formatMonthYearLabel(result.year, result.month),
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
      days: buildDayScheduleDays(result),
      shifts: buildShiftEntries(result),
      offs: buildOffEntries(result),
      observations,
    },
    legend,
    observations,
    monthlySummary: {
      generatedAt: options.generatedAt,
      totalDays: result.perDay.length,
      totalOperators: result.rows.length,
      totalLegendEntries: legend.length,
      totalObservations: observations.length,
      notes: options.notes,
    },
    sourceSchedule: result,
  };
}
