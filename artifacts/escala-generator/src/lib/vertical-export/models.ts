import type { ScheduleResult } from "../types";

export type VerticalScheduleSectionKey =
  | "header"
  | "daySchedule"
  | "legend"
  | "observations"
  | "monthlySummary";

export type VerticalScheduleFieldSource =
  | "configuration"
  | "schedule"
  | "derived"
  | "manual";

export type VerticalScheduleFieldResponsibility = "user" | "system";

export interface VerticalScheduleHeader {
  crcea: string;
  localidade: string;
  orgao: string;
  month: number;
  year: number;
  monthYearLabel: string;
  totalStaff: number;
  scheduleStaff: number;
  /**
   * Manual/configuration fields for the ICA "MÉDIA HORA MENSAL" pair.
   * TODO(Milestone 7): validate the operational calculation rule with a real
   * ICA example or operational authority before deriving these values.
   */
  monthlyWorkloadBase?: string;
  averageMonthlyHours?: string;
  /** Display value currently rendered in the template, for example "144/152". */
  monthlyAverageHours?: string;
  trainingHours?: string;
  escalante: string;
  headOfOrg?: string;
  headOfDivision?: string;
}

export interface VerticalScheduleHeaderInput {
  crcea: string;
  localidade: string;
  orgao: string;
  escalante: string;
  monthlyWorkloadBase?: string;
  averageMonthlyHours?: string;
  monthlyAverageHours?: string;
  trainingHours?: string;
  headOfOrg?: string;
  headOfDivision?: string;
  totalStaff?: number;
  scheduleStaff?: number;
}

export interface VerticalScheduleConversionOptions {
  header: VerticalScheduleHeaderInput;
  generatedAt?: string;
  notes?: string[];
}

export interface VerticalScheduleDayCell {
  day: number;
  weekday: number;
  weekdayLabel: string;
}

export interface VerticalScheduleShiftEntry {
  day: number;
  shift: "A" | "INT" | "B";
  operatorCodes: string[];
}

export interface VerticalScheduleOffEntry {
  day: number;
  operatorCodes: string[];
}

export interface VerticalScheduleObservationEntry {
  day?: number;
  label: string;
  text: string;
  source: VerticalScheduleFieldSource;
}

export interface VerticalScheduleLegendEntry {
  code: string;
  operator: string;
  role?: string;
  sourceOperatorLabel?: string;
  source: VerticalScheduleFieldSource;
  responsibility: VerticalScheduleFieldResponsibility;
}

export interface VerticalScheduleMonthlySummary {
  generatedAt?: string;
  totalDays: number;
  totalOperators: number;
  totalLegendEntries: number;
  totalObservations: number;
  notes?: string[];
}

export type VerticalScheduleDiagnosticSeverity = "warning" | "info";

export interface VerticalScheduleDiagnostic {
  severity: VerticalScheduleDiagnosticSeverity;
  code: string;
  message: string;
  day?: number;
  rowIndex?: number;
  columnIndex?: number;
  rawValue?: string;
}

export interface VerticalScheduleSourceReference {
  type: "real-schedule-csv";
  monthBlockIndex: number;
  rawHeaderValue: string;
  displayedYear?: number;
  effectiveYear: number;
  yearOverride?: number;
  columnStartIndex: number;
  columnEndIndex: number;
  headerRowIndex: number;
  weekdayRowIndex: number;
  dayRowIndex: number;
}

export interface VerticalScheduleDaySchedule {
  days: VerticalScheduleDayCell[];
  shifts: VerticalScheduleShiftEntry[];
  offs: VerticalScheduleOffEntry[];
  observations: VerticalScheduleObservationEntry[];
}

export interface VerticalSchedule {
  section: VerticalScheduleSectionKey;
  header: VerticalScheduleHeader;
  daySchedule: VerticalScheduleDaySchedule;
  legend: VerticalScheduleLegendEntry[];
  observations: VerticalScheduleObservationEntry[];
  monthlySummary: VerticalScheduleMonthlySummary;
  sourceSchedule?: ScheduleResult;
  sourceReference?: VerticalScheduleSourceReference;
  diagnostics?: VerticalScheduleDiagnostic[];
}
