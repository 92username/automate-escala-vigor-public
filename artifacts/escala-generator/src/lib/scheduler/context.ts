import { daysInMonth } from "../calendar";
import { defaultFallbackSlot, inferCycleSlotForDay1 } from "../cycle";
import type {
  AbsencePeriod,
  DecisionLog,
  Employee,
  PreviousMonthInfo,
  ScheduleInput,
  Scenario,
  ShiftCode,
} from "../types";

export interface AbsenceInfo {
  byEmployee: Map<string, Map<number, "ferias" | "licenca" | "curso">>;
}

export interface RowState {
  worked: number;
  ft: number;
  countA: number;
  countB: number;
  countInt: number;
  satSunOff: Set<number>;
}

export interface DayContext {
  date: number;
  weekday: number;
  isHoliday: boolean;
  assignments: Map<string, ShiftCode>;
  ftSet: Set<string>;
  absences: Map<string, "ferias" | "licenca" | "curso">;
}

export interface ScheduleContext {
  year: number;
  month: number;
  scenario: Scenario;
  employees: Employee[];
  absences: AbsencePeriod[];
  holidays: number[];
  previousMonth?: PreviousMonthInfo;
  active: Employee[];
  daysCount: number;
  holidaySet: Set<number>;
  absenceInfo: AbsenceInfo;
  daysCtx: DayContext[];
  state: Map<string, RowState>;
  startSlotById: Map<string, number>;
  debug: boolean;
  decisionLogs: DecisionLog[];
  decisionLog: string[];
  criticalIssues: string[];
  ftReallocationCountByEmployeeId: Map<string, number>;
  monthlyReallocationCountByEmployeeId: Map<string, number>;
  attemptSeed: number;
}

export function buildAbsenceMap(absences: AbsencePeriod[]): AbsenceInfo {
  const map = new Map<string, Map<number, "ferias" | "licenca" | "curso">>();
  for (const a of absences) {
    let inner = map.get(a.employeeId);
    if (!inner) {
      inner = new Map();
      map.set(a.employeeId, inner);
    }
    for (let d = a.startDay; d <= a.endDay; d++) {
      inner.set(d, a.type);
    }
  }
  return { byEmployee: map };
}

export function newRowState(): RowState {
  return {
    worked: 0,
    ft: 0,
    countA: 0,
    countB: 0,
    countInt: 0,
    satSunOff: new Set(),
  };
}

export function stableHash(value: string, seed = 0): number {
  let hash = 2166136261 ^ seed;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededTieBreak(a: string, b: string, seed: number): number {
  const ah = stableHash(a, seed);
  const bh = stableHash(b, seed);
  if (ah !== bh) return ah - bh;
  return a.localeCompare(b);
}

export function createScheduleContext(input: ScheduleInput, options?: { attemptSeed?: number }): ScheduleContext {
  const { year, month, scenario, employees, absences, holidays, previousMonth } = input;
  const daysCount = daysInMonth(year, month);
  const holidaySet = new Set(holidays);
  const active = employees;

  const absenceInfo = buildAbsenceMap(absences);
  const daysCtx: DayContext[] = [];
  for (let d = 1; d <= daysCount; d++) {
    daysCtx.push({
      date: d,
      weekday: new Date(year, month - 1, d).getDay(),
      isHoliday: holidaySet.has(d),
      assignments: new Map(),
      ftSet: new Set(),
      absences: new Map(),
    });
  }

  for (const e of active) {
    const inner = absenceInfo.byEmployee.get(e.id);
    if (!inner) continue;
    for (const [day, type] of inner.entries()) {
      if (day < 1 || day > daysCount) continue;
      daysCtx[day - 1]!.absences.set(e.id, type);
    }
  }

  const startSlotById = new Map<string, number>();
  let encIdx = 0;
  let subIdx = 0;
  let opeIdx = 0;
  for (const e of active) {
    let fallback = 0;
    if (e.role === "ENC") fallback = defaultFallbackSlot(e, encIdx++);
    else if (e.role === "SUB") fallback = defaultFallbackSlot(e, subIdx++);
    else if (e.role === "OPE") fallback = defaultFallbackSlot(e, opeIdx++);
    startSlotById.set(e.id, inferCycleSlotForDay1(e, previousMonth, fallback));
  }

  const state = new Map<string, RowState>();
  for (const e of active) state.set(e.id, newRowState());

  return {
    year,
    month,
    scenario,
    employees,
    absences,
    holidays,
    previousMonth,
    active,
    daysCount,
    holidaySet,
    absenceInfo,
    daysCtx,
    state,
    startSlotById,
    debug: false,
    decisionLogs: [],
    decisionLog: [],
    criticalIssues: [],
    ftReallocationCountByEmployeeId: new Map(active.map((e) => [e.id, 0])),
    monthlyReallocationCountByEmployeeId: new Map(active.map((e) => [e.id, 0])),
    attemptSeed: options?.attemptSeed ?? 0,
  };
}

/**
 * Log a decision (selection or rejection) of an employee for a shift on a day.
 * Only logs if context.debug is true.
 */
export function logDecision(
  context: ScheduleContext,
  day: number,
  shift: ShiftCode,
  employeeId: string,
  action: "selected" | "rejected",
  reason: string,
): void {
  if (!context.debug) return;
  context.decisionLogs.push({
    day,
    shift,
    employeeId,
    action,
    reason,
  });
}

export function addDecisionLog(context: ScheduleContext, message: string): void {
  context.decisionLog.push(message);
}

export function markCriticalIssue(context: ScheduleContext, message: string): void {
  context.criticalIssues.push(message);
  context.decisionLog.push(`[WARNING CRÍTICO] ${message}`);
}
