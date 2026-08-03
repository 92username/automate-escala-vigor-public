import { weekdayOf } from "../calendar";
import type { ScheduleContext } from "./context";

export function enforceWeekendOff(context: ScheduleContext, violations: string[]): void {
  for (const e of context.active.filter((x) => x.role === "OPE" || x.role === "SUB" || x.role === "ENC")) {
    const s = context.state.get(e.id)!;
    let hasWeekend = false;
    for (let d = 1; d <= context.daysCount; d++) {
      const wd = weekdayOf(context.year, context.month, d);
      if (wd !== 6) continue;
      if (d + 1 > context.daysCount) continue;
      const sat = context.daysCtx[d - 1]!;
      const sun = context.daysCtx[d]!;
      const satOff = !sat.assignments.has(e.id) || sat.ftSet.has(e.id) || sat.absences.has(e.id);
      const sunOff = !sun.assignments.has(e.id) || sun.ftSet.has(e.id) || sun.absences.has(e.id);
      if (satOff && sunOff) {
        hasWeekend = true;
        break;
      }
    }
    if (!hasWeekend) {
      let fixed = false;
      for (let d = 1; d <= context.daysCount && !fixed; d++) {
        const wd = weekdayOf(context.year, context.month, d);
        if (wd !== 6) continue;
        if (d + 1 > context.daysCount) continue;
        const sat = context.daysCtx[d - 1]!;
        const sun = context.daysCtx[d]!;
        const canFreeSat =
          !sat.absences.has(e.id) && (sat.assignments.has(e.id) || !sat.ftSet.has(e.id));
        const canFreeSun =
          !sun.absences.has(e.id) && (sun.assignments.has(e.id) || !sun.ftSet.has(e.id));
        if (canFreeSat && canFreeSun) {
          if (sat.assignments.has(e.id)) {
            const sh = sat.assignments.get(e.id)!;
            sat.assignments.delete(e.id);
            s.worked -= 1;
            if (sh === "A") s.countA -= 1;
            else if (sh === "B") s.countB -= 1;
            else s.countInt -= 1;
          }
          sat.ftSet.add(e.id);
          if (sun.assignments.has(e.id)) {
            const sh = sun.assignments.get(e.id)!;
            sun.assignments.delete(e.id);
            s.worked -= 1;
            if (sh === "A") s.countA -= 1;
            else if (sh === "B") s.countB -= 1;
            else s.countInt -= 1;
          }
          sun.ftSet.add(e.id);
          s.ft += 2;
          s.satSunOff.add(d);
          s.satSunOff.add(d + 1);
          fixed = true;
        }
      }
      if (!fixed) {
        violations.push(
          `${e.name}: não foi possível garantir 1 sábado + domingo de folga consecutivos.`,
        );
      }
    }
  }
}