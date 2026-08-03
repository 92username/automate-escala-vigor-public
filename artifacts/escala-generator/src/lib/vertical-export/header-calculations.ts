import { daysInMonth } from "../calendar";
import type { DayAssignment, Employee, EmployeeRow, Role } from "../types";
import type { RealScheduleCsvMonthBlock, RealScheduleCsvOperatorRow } from "./real-schedule-parser";

export interface VerticalHeaderMetrics {
  totalStaff: number;
  scheduleStaff: number;
  monthlyWorkloadBase: number;
  averageMonthlyHours: number;
  monthlyAverageHours: string;
  totalWorkedHours: number;
}

const NON_REGULAR_SCHEDULE_ROLES = new Set<Role>(["ADM"]);
const WORKED_SHIFT_CODES = new Set(["A", "INT", "B"]);

function formatMonthlyAverageHours(baseHours: number, averageHours: number): string {
  return `${baseHours} / ${averageHours}`;
}

export function calculateMonthlyWorkloadBase(year: number, month: number): number {
  return Math.round(daysInMonth(year, month) * 0.5 * 8);
}

export function shouldIncludeEmployeeInRegularSchedule(employee: Employee): boolean {
  return employee.includeInSchedule ?? !NON_REGULAR_SCHEDULE_ROLES.has(employee.role);
}

function isWorkedAssignment(assignment: DayAssignment): boolean {
  if (assignment.kind === "WORK") {
    return assignment.shift === "A" || assignment.shift === "INT" || assignment.shift === "B";
  }

  return assignment.kind === "FT" && assignment.shift !== null;
}

export function calculateGeneratedScheduleHeaderMetrics(year: number, month: number, rows: EmployeeRow[]): VerticalHeaderMetrics {
  const totalStaff = rows.length;
  const scheduleStaff = rows.filter((row) => shouldIncludeEmployeeInRegularSchedule(row.employee)).length;
  const monthlyWorkloadBase = calculateMonthlyWorkloadBase(year, month);
  const totalWorkedHours = rows.reduce((sum, row) => {
    if (row.employee.role === "ADM") {
      return sum;
    }

    const workedAssignments = row.days.filter(isWorkedAssignment).length;
    return sum + workedAssignments * 8;
  }, 0);
  const averageMonthlyHours = totalStaff > 0 ? Math.round(totalWorkedHours / totalStaff) : 0;

  return {
    totalStaff,
    scheduleStaff,
    monthlyWorkloadBase,
    averageMonthlyHours,
    monthlyAverageHours: formatMonthlyAverageHours(monthlyWorkloadBase, averageMonthlyHours),
    totalWorkedHours,
  };
}

function normalizeCodeText(value: string): string[] {
  return value
    .trim()
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function hasWorkedRealScheduleCell(value: string): boolean {
  const tokens = normalizeCodeText(value);
  if (tokens.includes("ADM")) {
    return false;
  }

  return tokens.some((token) => WORKED_SHIFT_CODES.has(token));
}

function normalizeRoleHint(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function shouldIncludeRealOperatorInRegularSchedule(row: RealScheduleCsvOperatorRow): boolean {
  const roleHint = normalizeRoleHint(row.sourceRole);
  return roleHint !== "ADM";
}

export function calculateRealScheduleHeaderMetrics(block: RealScheduleCsvMonthBlock): VerticalHeaderMetrics {
  const totalStaff = block.operatorRows.length;
  const scheduleStaff = block.operatorRows.filter(shouldIncludeRealOperatorInRegularSchedule).length;
  const monthlyWorkloadBase = calculateMonthlyWorkloadBase(block.effectiveYear, block.month);
  const totalWorkedHours = block.operatorRows.reduce((sum, row) => {
    if (normalizeRoleHint(row.sourceRole) === "ADM") {
      return sum;
    }

    const workedCells = row.cells.filter((cell) => hasWorkedRealScheduleCell(cell.normalizedValue)).length;
    return sum + workedCells * 8;
  }, 0);
  const averageMonthlyHours = totalStaff > 0 ? Math.round(totalWorkedHours / totalStaff) : 0;

  return {
    totalStaff,
    scheduleStaff,
    monthlyWorkloadBase,
    averageMonthlyHours,
    monthlyAverageHours: formatMonthlyAverageHours(monthlyWorkloadBase, averageMonthlyHours),
    totalWorkedHours,
  };
}
