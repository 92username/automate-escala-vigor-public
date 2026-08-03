export type ShiftCode = "A" | "INT" | "B";

export type Role = "ENC" | "SUB" | "OPE" | "ESP" | "ADM";

export type Scenario = "operacional" | "exp";

export type ScheduleStatus = "gerada_ok" | "gerada_com_ajustes" | "gerada_com_warning_critico";

export type SavedScheduleStatus = "Rascunho" | "Aprovada" | "Enviada" | "Arquivada";

/**
 * Decision log entry for debugging the scheduler's choices.
 * Tracks why each employee was selected or rejected for each shift/day.
 */
export type DecisionLog = {
  day: number;
  shift: ShiftCode;
  employeeId: string;
  action: "selected" | "rejected";
  reason: string;
};

export type CellKind =
  | "WORK"
  | "OFF"
  | "FT"
  | "FERIAS"
  | "LICENCA"
  | "CURSO"
  | "EXP";

/**
 * Per-day status from the previous month, used to infer the 2x2 cycle
 * alignment for the current month.
 */
export type PrevDayCode = "A" | "B" | "INT" | "OFF" | "FT" | "ABS";

export interface Employee {
  id: string;
  name: string;
  role: Role;
  verticalCode?: string;
  includeInSchedule?: boolean;
  novice?: boolean;
  /**
   * Previous month per-day data (length = days of previous month).
   * When provided, the scheduler infers the cycle position from this instead
   * of using a hardcoded value.
   */
  previousMonthDays?: PrevDayCode[];
}

export interface AbsencePeriod {
  id: string;
  employeeId: string;
  type: "ferias" | "licenca" | "curso";
  startDay: number; // day of month (1..N)
  endDay: number; // inclusive
}

export interface DayAssignment {
  date: number; // day of month
  shift: ShiftCode | null; // null when not working
  kind: CellKind;
}

export interface EmployeeRow {
  employee: Employee;
  days: DayAssignment[];
  workedDays: number;
  ftDays: number;
  countA: number;
  countB: number;
  countInt: number;
  countSat: number;
  countSun: number;
}

export type ScheduleOptimizationProfile = "best_overall" | "fewest_adjustments" | "most_balanced";

export interface ScheduleMetrics {
  totalAdjustments: number;
  totalFtReallocations: number;
  maxFtReallocationsForOneEmployee: number;
  ftReallocationSquarePenalty: number;
  ftReallocationDistribution: Array<{ employeeId: string; employeeName: string; count: number }>;
  workloadMin: number;
  workloadMax: number;
  workloadSpread: number;
  shiftBalancePenalty: number;
  twoByTwoPenalty: number;
  violationCount: number;
  warningCount: number;
  criticalWarningCount: number;
}

export interface ScheduleAlternative {
  id: string;
  label: string;
  description: string;
  profile: ScheduleOptimizationProfile;
  duplicateOf?: string;
  metrics: ScheduleMetrics;
  score: number[];
  result: ScheduleResult;
}

export interface ScheduleOptimizationSummary {
  attempts: number;
  profiles: Array<{
    profile: ScheduleOptimizationProfile;
    label: string;
    selectedAlternativeId: string;
    duplicateOf?: string;
    score: number[];
  }>;
}

export interface ScheduleResult {
  year: number;
  month: number; // 1..12
  scenario: Scenario;
  status: ScheduleStatus;
  rows: EmployeeRow[];
  warnings: string[];
  violations: string[];
  decisionLog: string[];
  reinforcementLogText?: string;
  perDay: Array<{
    date: number;
    weekday: number;
    isHoliday: boolean;
    A: string[];
    INT: string[];
    B: string[];
  }>;
  debug?: {
    decisions: DecisionLog[];
  };
  metrics?: ScheduleMetrics;
  alternatives?: ScheduleAlternative[];
  selectedAlternativeId?: string;
  optimizationSummary?: ScheduleOptimizationSummary;
}

export interface PreviousMonthInfo {
  year: number;
  month: number; // 1..12
  /** Day-by-day map per employee id (length = days in that month) */
  daysByEmployeeId: Record<string, PrevDayCode[]>;
}

export interface ScheduleInput {
  year: number;
  month: number; // 1..12
  scenario: Scenario;
  employees: Employee[];
  absences: AbsencePeriod[];
  holidays: number[]; // days of month
  previousMonth?: PreviousMonthInfo;
}

export interface ScheduleHistoryItem {
  id: string;
  userId: string;
  userName: string;
  year: number;
  month: number;
  version: number;
  filename: string;
  createdAt: string;
  status: SavedScheduleStatus;
  result: ScheduleResult;
  selectedAlternativeId?: string | null;
  score?: number[];
  operatorCount: number;
  warningCount: number;
  violationCount: number;
}
