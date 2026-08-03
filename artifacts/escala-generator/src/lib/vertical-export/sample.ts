import type {
  VerticalSchedule,
  VerticalScheduleDayCell,
  VerticalScheduleDaySchedule,
  VerticalScheduleLegendEntry,
  VerticalScheduleMonthlySummary,
  VerticalScheduleObservationEntry,
  VerticalScheduleOffEntry,
  VerticalScheduleShiftEntry,
} from "./models";
import { daysInMonth, weekdayOf } from "../calendar";
import { formatOfficialVerticalWeekdayLabel } from "./weekday-label";

const sampleYear = 2026;
const sampleMonth = 1;

const dayLabels: Array<{ day: number; weekday: number; weekdayLabel: string }> = Array.from(
  { length: daysInMonth(sampleYear, sampleMonth) },
  (_, index) => {
    const day = index + 1;
    const weekday = weekdayOf(sampleYear, sampleMonth, day);
    return { day, weekday, weekdayLabel: formatOfficialVerticalWeekdayLabel(sampleYear, sampleMonth, day) };
  },
);

const operatorCodes = ["A01", "A02", "A03", "A04", "A05"];

export const sampleVerticalScheduleHeader: VerticalSchedule["header"] = {
  crcea: "CRCEA-SE",
  localidade: "Manaus-AM",
  orgao: "APP SBEG",
  month: sampleMonth,
  year: sampleYear,
  monthYearLabel: "JANEIRO/2026",
  totalStaff: 5,
  scheduleStaff: 5,
  monthlyAverageHours: "144/152",
  trainingHours: "5h",
  escalante: "Cap João Silva",
  headOfOrg: "Maj Pedro Souza",
  headOfDivision: "Ten Cel Carlos Lima",
};

export const sampleVerticalScheduleDays: VerticalScheduleDayCell[] = dayLabels.map((entry) => ({
  day: entry.day,
  weekday: entry.weekday,
  weekdayLabel: entry.weekdayLabel,
}));

export const sampleVerticalScheduleShifts: VerticalScheduleShiftEntry[] = dayLabels.map((entry) => {
  const shift = entry.day % 3 === 1 ? "A" : entry.day % 3 === 2 ? "INT" : "B";
  return {
    day: entry.day,
    shift,
    operatorCodes: [operatorCodes[(entry.day - 1) % operatorCodes.length] ?? "A01"],
  };
});

export const sampleVerticalScheduleOffs: VerticalScheduleOffEntry[] = dayLabels.map((entry) => ({
  day: entry.day,
  operatorCodes:
    entry.day % 5 === 0
      ? [operatorCodes[1] ?? "A02", operatorCodes[3] ?? "A04"]
      : [operatorCodes[4] ?? "A05"],
}));

export const sampleVerticalScheduleLegend: VerticalScheduleLegendEntry[] = [
  { code: "A01", operator: "Cap João Silva", role: "ENC", source: "configuration", responsibility: "user" },
  { code: "A02", operator: "Sub Maria Souza", role: "SUB", source: "configuration", responsibility: "user" },
  { code: "A03", operator: "Op Lucas Santos", role: "OPE", source: "configuration", responsibility: "user" },
  { code: "A04", operator: "Op Ana Costa", role: "OPE", source: "configuration", responsibility: "user" },
  { code: "A05", operator: "Op Bruno Alves", role: "OPE", source: "configuration", responsibility: "user" },
];

export const sampleVerticalScheduleObservations: VerticalScheduleObservationEntry[] = [
  {
    day: 3,
    label: "OBS",
    text: "Férias programadas para A02.",
    source: "manual",
  },
  {
    day: 12,
    label: "OBS",
    text: "Instrução programada: 5 horas de CTR.",
    source: "manual",
  },
  {
    label: "GERAL",
    text: "Escala vertical de exemplo para validação de layout e contrato de dados.",
    source: "derived",
  },
];

export const sampleVerticalScheduleMonthlySummary: VerticalScheduleMonthlySummary = {
  generatedAt: "2026-01-01T12:00:00.000Z",
  totalDays: 31,
  totalOperators: 5,
  totalLegendEntries: 5,
  totalObservations: 3,
  notes: ["Exemplo sintético para ICA 63-33.", "Não representa uma escala operacional real."],
};

export const sampleVerticalScheduleDaySchedule: VerticalScheduleDaySchedule = {
  days: sampleVerticalScheduleDays,
  shifts: sampleVerticalScheduleShifts,
  offs: sampleVerticalScheduleOffs,
  observations: sampleVerticalScheduleObservations.filter((observation) => typeof observation.day === "number"),
};

export const sampleVerticalSchedule: VerticalSchedule = {
  section: "monthlySummary",
  header: sampleVerticalScheduleHeader,
  daySchedule: sampleVerticalScheduleDaySchedule,
  legend: sampleVerticalScheduleLegend,
  observations: sampleVerticalScheduleObservations,
  monthlySummary: sampleVerticalScheduleMonthlySummary,
};
