import type { ShiftCode } from "../types";
import type { ScheduleContext } from "./context";
import { allNovice, hasEncOrSub, teamForShift } from "./assignment";

function hasAbsenceRegistered(context: ScheduleContext, employeeId: string): boolean {
  return (context.absenceInfo.byEmployee.get(employeeId)?.size ?? 0) > 0;
}

function formatAbsenceLabel(type: string): string {
  if (type === "ferias") return "Férias";
  if (type === "licenca") return "Licença";
  if (type === "curso") return "Curso";
  return type;
}

function getFirstAbsence(context: ScheduleContext, employeeId: string) {
  return context.absences.find((absence) => absence.employeeId === employeeId);
}

export function validateSchedule(context: ScheduleContext, warnings: string[], violations: string[]): void {
  const minDaysWorked = 14;
  const maxDaysWorked = 16;

  for (const e of context.active.filter((x) => x.role === "OPE" || x.role === "SUB" || x.role === "ENC")) {
    const s = context.state.get(e.id)!;
    if (s.worked < minDaysWorked) {
      if (hasAbsenceRegistered(context, e.id)) {
        const absence = getFirstAbsence(context, e.id);
        if (absence) {
          warnings.push(
            `${e.name}: ${s.worked} dias trabalhados (${formatAbsenceLabel(absence.type)}: ${absence.startDay} a ${absence.endDay})`,
          );
        } else {
          warnings.push(`${e.name}: ${s.worked} dias trabalhados devido a afastamento registrado.`);
        }
        continue;
      }
      violations.push(`${e.name}: ${s.worked} dias trabalhados (mínimo ${minDaysWorked}).`);
    } else if (s.worked > maxDaysWorked) {
      violations.push(`${e.name}: ${s.worked} dias trabalhados (máximo ${maxDaysWorked}).`);
    }
  }

  for (let d = 1; d <= context.daysCount; d++) {
    const ctx = context.daysCtx[d - 1]!;
    const encByShift: Record<ShiftCode, string[]> = { A: [], INT: [], B: [] };
    for (const e of context.active.filter((x) => x.role === "ENC")) {
      const sh = ctx.assignments.get(e.id);
      if (sh) encByShift[sh].push(e.name);
    }
    for (const sh of ["A", "INT", "B"] as ShiftCode[]) {
      if (encByShift[sh].length > 1) {
        violations.push(
          `Dia ${d} turno ${sh}: ${encByShift[sh].length} ENCs (${encByShift[sh].join(", ")}). Máximo 1 ENC por turno.`,
        );
      }
    }
    for (const shift of ["A", "INT", "B"] as ShiftCode[]) {
      const team = teamForShift(ctx, shift, context.active);
      const min = shift === "A" ? 3 : 2;
      if (team.length < min) {
        violations.push(`Dia ${d} turno ${shift}: ${team.length} operador(es), mínimo ${min}.`);
      }
      if ((shift === "A" || shift === "B") && !hasEncOrSub(team) && team.length > 0) {
        violations.push(`Dia ${d} turno ${shift}: nenhum ENC ou SUB presente.`);
      }
      if ((shift === "A" || shift === "B") && allNovice(team) && team.length > 0) {
        violations.push(`Dia ${d} turno ${shift}: equipe composta apenas por novatos.`);
      }
    }
  }
}