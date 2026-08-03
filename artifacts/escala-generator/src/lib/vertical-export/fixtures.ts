import { daysInMonth, weekdayOf } from "../calendar";
import type {
  DayAssignment,
  Employee,
  EmployeeRow,
  ScheduleResult,
  ShiftCode,
} from "../types";

const employees: Employee[] = [
  { id: "enc-1", name: "Cap João Silva", role: "ENC" },
  { id: "sub-1", name: "Sub Maria Souza", role: "SUB" },
  { id: "ope-1", name: "Op Lucas Santos", role: "OPE" },
  { id: "ope-2", name: "Op Ana Costa", role: "OPE" },
];

function createAssignment(day: number, shift: ShiftCode | null): DayAssignment {
  return {
    date: day,
    shift,
    kind: shift ? "WORK" : "OFF",
  };
}

function createEmployeeRow(employee: Employee, assignments: DayAssignment[]): EmployeeRow {
  const workedDays = assignments.filter((day) => day.kind === "WORK").length;
  const ftDays = assignments.filter((day) => day.kind === "FT").length;
  const countA = assignments.filter((day) => day.kind === "WORK" && day.shift === "A").length;
  const countB = assignments.filter((day) => day.kind === "WORK" && day.shift === "B").length;
  const countInt = assignments.filter((day) => day.kind === "WORK" && day.shift === "INT").length;

  return {
    employee,
    days: assignments,
    workedDays,
    ftDays,
    countA,
    countB,
    countInt,
    countSat: 0,
    countSun: 0,
  };
}

export function createVerticalScheduleFixture(): ScheduleResult {
  const year = 2026;
  const month = 1;
  const totalDays = daysInMonth(year, month);

  const rows: EmployeeRow[] = employees.map((employee, employeeIndex) => {
    const assignments: DayAssignment[] = Array.from({ length: totalDays }, (_, dayIndex) => {
      const day = dayIndex + 1;
      const shiftIndex = (day + employeeIndex) % 4;
      const shift: ShiftCode | null = shiftIndex === 0 ? "A" : shiftIndex === 1 ? "INT" : shiftIndex === 2 ? "B" : null;
      return createAssignment(day, shift);
    });

    return createEmployeeRow(employee, assignments);
  });

  const perDay = Array.from({ length: totalDays }, (_, dayIndex) => {
    const day = dayIndex + 1;
    const weekday = weekdayOf(year, month, day);
    const A = rows.filter((row) => row.days[dayIndex]?.kind === "WORK" && row.days[dayIndex]?.shift === "A").map((row) => row.employee.name);
    const INT = rows.filter((row) => row.days[dayIndex]?.kind === "WORK" && row.days[dayIndex]?.shift === "INT").map((row) => row.employee.name);
    const B = rows.filter((row) => row.days[dayIndex]?.kind === "WORK" && row.days[dayIndex]?.shift === "B").map((row) => row.employee.name);

    return {
      date: day,
      weekday,
      isHoliday: false,
      A,
      INT,
      B,
    };
  });

  return {
    year,
    month,
    scenario: "operacional",
    status: "gerada_ok",
    rows,
    warnings: ["Escala fictícia para teste do conversor vertical."],
    violations: [],
    decisionLog: [],
    perDay,
    metrics: undefined,
    alternatives: undefined,
    selectedAlternativeId: undefined,
    optimizationSummary: undefined,
  };
}