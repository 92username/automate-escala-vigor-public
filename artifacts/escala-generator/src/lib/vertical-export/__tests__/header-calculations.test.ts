import { describe, expect, it } from "vitest";
import type { DayAssignment, Employee, EmployeeRow, Role, ShiftCode } from "../../types";
import {
  calculateGeneratedScheduleHeaderMetrics,
  calculateMonthlyWorkloadBase,
} from "../header-calculations";

function assignment(day: number, shift: ShiftCode | null): DayAssignment {
  return {
    date: day,
    shift,
    kind: shift ? "WORK" : "OFF",
  };
}

function row(employee: Employee, days: DayAssignment[]): EmployeeRow {
  return {
    employee,
    days,
    workedDays: days.filter((day) => day.kind === "WORK").length,
    ftDays: days.filter((day) => day.kind === "FT").length,
    countA: days.filter((day) => day.shift === "A").length,
    countB: days.filter((day) => day.shift === "B").length,
    countInt: days.filter((day) => day.shift === "INT").length,
    countSat: 0,
    countSun: 0,
  };
}

function employee(id: string, role: Role = "OPE", includeInSchedule?: boolean): Employee {
  return {
    id,
    name: id,
    role,
    includeInSchedule,
  };
}

describe("vertical header calculations", () => {
  it("calculates base 112 for a 28-day month", () => {
    expect(calculateMonthlyWorkloadBase(2026, 2)).toBe(112);
  });

  it("calculates base 120 for a 30-day month", () => {
    expect(calculateMonthlyWorkloadBase(2026, 4)).toBe(120);
  });

  it("calculates base 124 for a 31-day month", () => {
    expect(calculateMonthlyWorkloadBase(2026, 5)).toBe(124);
  });

  it("uses efetivoTotal as the average divisor", () => {
    const metrics = calculateGeneratedScheduleHeaderMetrics(2026, 5, [
      row(employee("ope-1"), [assignment(1, "A"), assignment(2, "INT"), assignment(3, "B")]),
      row(employee("ope-2"), [assignment(1, null), assignment(2, null), assignment(3, null)]),
    ]);

    expect(metrics.totalWorkedHours).toBe(24);
    expect(metrics.totalStaff).toBe(2);
    expect(metrics.averageMonthlyHours).toBe(12);
    expect(metrics.monthlyAverageHours).toBe("124 / 12");
  });

  it("keeps an operator with 0 hours in the average divisor", () => {
    const metrics = calculateGeneratedScheduleHeaderMetrics(2026, 4, [
      row(employee("ope-1"), [assignment(1, "A")]),
      row(employee("ope-2"), [assignment(1, null)]),
      row(employee("ope-3"), [assignment(1, null)]),
    ]);

    expect(metrics.totalWorkedHours).toBe(8);
    expect(metrics.totalStaff).toBe(3);
    expect(metrics.averageMonthlyHours).toBe(3);
  });

  it("keeps ADM in efetivoTotal but excludes ADM from efetivoDeEscala", () => {
    const metrics = calculateGeneratedScheduleHeaderMetrics(2026, 5, [
      row(employee("ope-1"), [assignment(1, "A")]),
      row(employee("adm-1", "ADM"), [assignment(1, "A")]),
    ]);

    expect(metrics.totalStaff).toBe(2);
    expect(metrics.scheduleStaff).toBe(1);
    expect(metrics.averageMonthlyHours).toBe(4);
  });

  it("respects includeInSchedule=false for non-regular staff", () => {
    const metrics = calculateGeneratedScheduleHeaderMetrics(2026, 5, [
      row(employee("ope-1"), [assignment(1, "A")]),
      row(employee("support-1", "OPE", false), [assignment(1, null)]),
    ]);

    expect(metrics.totalStaff).toBe(2);
    expect(metrics.scheduleStaff).toBe(1);
  });
});
