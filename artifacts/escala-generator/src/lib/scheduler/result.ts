import { isWeekend, weekdayOf } from "../calendar";
import type { CellKind, DayAssignment, EmployeeRow, ScheduleResult, ShiftCode } from "../types";
import type { ScheduleContext } from "./context";

export function buildResult(
  context: ScheduleContext,
  warnings: string[],
  violations: string[],
): ScheduleResult {
  const rows: EmployeeRow[] = context.active.map((e) => {
    const days: DayAssignment[] = context.daysCtx.map((ctx) => {
      const wd = ctx.weekday;
      let kind: CellKind = "OFF";
      let shift: ShiftCode | null = null;
      const absence = ctx.absences.get(e.id);
      if (absence === "ferias") kind = "FERIAS";
      else if (absence === "licenca") kind = "LICENCA";
      else if (absence === "curso") kind = "CURSO";
      else if (ctx.ftSet.has(e.id)) kind = "FT";
      else if (ctx.assignments.has(e.id)) {
        shift = ctx.assignments.get(e.id)!;
        kind = "WORK";
      } else if (e.role === "ADM" && !context.holidaySet.has(ctx.date) && !isWeekend(wd)) {
        kind = "EXP";
      }
      return { date: ctx.date, shift, kind };
    });
    const s = context.state.get(e.id) ?? {
      worked: 0,
      ft: 0,
      countA: 0,
      countB: 0,
      countInt: 0,
      satSunOff: new Set<number>(),
    };
    let countSat = 0;
    let countSun = 0;
    for (const d of days) {
      if (d.kind !== "WORK") continue;
      const wd = weekdayOf(context.year, context.month, d.date);
      if (wd === 6) countSat += 1;
      if (wd === 0) countSun += 1;
    }
    return {
      employee: e,
      days,
      workedDays: s.worked,
      ftDays: s.ft,
      countA: s.countA,
      countB: s.countB,
      countInt: s.countInt,
      countSat,
      countSun,
    };
  });

  const perDay = context.daysCtx.map((ctx) => ({
    date: ctx.date,
    weekday: ctx.weekday,
    isHoliday: ctx.isHoliday,
    A: context.active.filter((e) => ctx.assignments.get(e.id) === "A").map((e) => e.name),
    INT: context.active.filter((e) => ctx.assignments.get(e.id) === "INT").map((e) => e.name),
    B: context.active.filter((e) => ctx.assignments.get(e.id) === "B").map((e) => e.name),
  }));

  const status =
    context.criticalIssues.length > 0 || violations.length > 0
      ? "gerada_com_warning_critico"
      : warnings.length > 0
        ? "gerada_com_ajustes"
        : "gerada_ok";

  const result: ScheduleResult = {
    year: context.year,
    month: context.month,
    scenario: context.scenario,
    status,
    rows,
    warnings,
    violations,
    decisionLog: context.decisionLog,
    perDay,
  };

  if (context.debug) {
    result.debug = {
      decisions: context.decisionLogs,
    };
  }

  return result;
}