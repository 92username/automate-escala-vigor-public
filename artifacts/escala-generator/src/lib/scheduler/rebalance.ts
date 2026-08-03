import type { ShiftCode } from "../types";
import type { ScheduleContext } from "./context";
import {
  allNovice,
  canAssign,
  get_ft_reallocation_count,
  get_monthly_reallocation_count,
  hasEncOrSub,
  rank_ft_candidates,
  SHIFT_MINIMUMS,
  teamForShift,
  type FtReallocationCandidate,
} from "./assignment";
import { addDecisionLog, markCriticalIssue } from "./context";

function isCriticalSourceDay(context: ScheduleContext, day: number): boolean {
  const ctx = context.daysCtx[day - 1]!;
  if (ctx.isHoliday) return true;
  if (context.holidaySet.has(day - 1) || context.holidaySet.has(day + 1)) return true;
  return ctx.weekday === 5 || ctx.weekday === 6 || ctx.weekday === 0;
}

export function rebalanceCoverage(context: ScheduleContext, warnings: string[]): void {
  const tryBorrowOne = (targetDay: number, targetShift: ShiftCode): boolean => {
    const tCtx = context.daysCtx[targetDay - 1]!;
    const donorShiftOrder: ShiftCode[] = [
      targetShift,
      ...(["A", "INT", "B"] as ShiftCode[]).filter((s) => s !== targetShift),
    ];
    const candidates: FtReallocationCandidate[] = [];
      for (const donorShift of donorShiftOrder) {
        for (let donorDay = 1; donorDay <= context.daysCount; donorDay++) {
          if (donorDay === targetDay) continue;
          if (isCriticalSourceDay(context, donorDay)) {
            addDecisionLog(context, `[Dia ${donorDay} -> Dia ${targetDay}] Doador rejeitado: origem é dia crítico.`);
            continue;
          }
          const dCtx = context.daysCtx[donorDay - 1]!;
        const team = teamForShift(dCtx, donorShift, context.active);
        if (team.length <= SHIFT_MINIMUMS[donorShift]) continue;
        for (const employee of team) {
          candidates.push({ day: donorDay, sourceShift: donorShift, employee });
        }
      }
    }

    if (candidates.length === 0) return false;

    const candidatesByShift = new Map<string, FtReallocationCandidate[]>();
    for (const candidate of candidates) {
      const key = `${candidate.day}-${candidate.sourceShift}`;
      const grouped = candidatesByShift.get(key) ?? [];
      grouped.push(candidate);
      candidatesByShift.set(key, grouped);
    }

    addDecisionLog(context, `[Busca FT] Procurando excedentes no mês para cobrir Dia ${targetDay} - ${targetShift}.`);
    for (const grouped of candidatesByShift.values()) {
      const first = grouped[0]!;
      addDecisionLog(
        context,
        `[Dia ${first.day} - ${first.sourceShift}] Excedente encontrado: ${grouped
          .map((item) => item.employee.name)
          .join(", ")}.`,
      );
      addDecisionLog(context, `[Dia ${first.day} - ${first.sourceShift}] Avaliando candidatos para FT/realocação.`);
    }

    const ranked = rank_ft_candidates(context, candidates);
    for (const candidate of ranked) {
      const { day: donorDay, sourceShift: donorShift, employee: pick } = candidate;
      const dCtx = context.daysCtx[donorDay - 1]!;
      const team = teamForShift(dCtx, donorShift, context.active);
      const ftCount = get_ft_reallocation_count(context, pick);
      const moveCount = get_monthly_reallocation_count(context, pick);
      addDecisionLog(
        context,
        `[Dia ${donorDay} - ${donorShift}] ${pick.name} avaliado: ${ftCount} FT por realocação, ${moveCount} deslocamento(s) no mês.`,
      );
      if (pick.role === "ENC" || pick.role === "ESP" || pick.role === "ADM") {
        addDecisionLog(context, `[Dia ${donorDay} -> Dia ${targetDay}] ${pick.name} rejeitado: função preservada.`);
        continue;
      }
      if (tCtx.absences.has(pick.id)) {
        addDecisionLog(context, `[Dia ${donorDay} -> Dia ${targetDay}] ${pick.name} rejeitado: indisponível no destino.`);
        continue;
      }
      if (tCtx.assignments.has(pick.id)) {
        addDecisionLog(context, `[Dia ${donorDay} -> Dia ${targetDay}] ${pick.name} rejeitado: já alocado no destino.`);
        continue;
      }
      if (!canAssign(context.daysCtx, targetDay, pick, targetShift, context)) {
        addDecisionLog(context, `[Dia ${donorDay} -> Dia ${targetDay}] ${pick.name} rejeitado: regra de sequência ou compatibilidade.`);
        continue;
      }
      if (targetShift === "B" && targetDay < context.daysCount) {
        const nextSh = context.daysCtx[targetDay]!.assignments.get(pick.id);
        if (nextSh === "A") {
          addDecisionLog(context, `[Dia ${donorDay} -> Dia ${targetDay}] ${pick.name} rejeitado: evitar sequência B -> A.`);
          continue;
        }
      }
      const s = context.state.get(pick.id)!;
      if (s.satSunOff.has(targetDay)) {
        addDecisionLog(context, `[Dia ${donorDay} -> Dia ${targetDay}] ${pick.name} rejeitado: preserva folga de fim de semana.`);
        continue;
      }
      const remaining = team.filter((t) => t.id !== pick.id);
      if ((donorShift === "A" || donorShift === "B") && !hasEncOrSub(remaining)) {
        addDecisionLog(context, `[Dia ${donorDay} -> Dia ${targetDay}] ${pick.name} rejeitado: turno original ficaria sem ENC/SUB.`);
        continue;
      }
      if (allNovice(remaining)) {
        addDecisionLog(context, `[Dia ${donorDay} -> Dia ${targetDay}] ${pick.name} rejeitado: turno original ficaria apenas com novatos.`);
        continue;
      }

      addDecisionLog(
        context,
        `[Dia ${donorDay} - ${donorShift}] ${pick.name} aprovado: ${ftCount} FT por realocação no mês.`,
      );
      dCtx.assignments.delete(pick.id);
      dCtx.ftSet.add(pick.id);
      const ps = context.state.get(pick.id)!;
      ps.worked -= 1;
      if (donorShift === "A") ps.countA -= 1;
      else if (donorShift === "B") ps.countB -= 1;
      else ps.countInt -= 1;
      ps.ft += 1;
      if (tCtx.ftSet.has(pick.id)) {
        tCtx.ftSet.delete(pick.id);
        ps.ft -= 1;
      }
      tCtx.assignments.set(pick.id, targetShift);
      ps.worked += 1;
      if (targetShift === "A") ps.countA += 1;
      else if (targetShift === "B") ps.countB += 1;
      else ps.countInt += 1;
      context.ftReallocationCountByEmployeeId.set(pick.id, ftCount + 1);
      context.monthlyReallocationCountByEmployeeId.set(pick.id, moveCount + 1);
      warnings.push(
        `Realocado ${pick.name} do dia ${donorDay} (${donorShift}) para dia ${targetDay} (${targetShift}) — cobertura de efetivo.`,
      );
      addDecisionLog(
        context,
        `[Dia ${donorDay} -> Dia ${targetDay}] ${pick.name} removido de ${donorShift}, marcado como FT no Dia ${donorDay} e realocado para ${targetShift} no Dia ${targetDay}.`,
      );
      for (const skipped of ranked) {
        if (skipped.employee.id === pick.id) continue;
        const skippedFtCount = get_ft_reallocation_count(context, skipped.employee);
        if (skippedFtCount > ftCount) {
          addDecisionLog(
            context,
            `[Dia ${skipped.day} - ${skipped.sourceShift}] ${skipped.employee.name} ignorado: já possui ${skippedFtCount} FT por realocação no mês.`,
          );
        }
      }
      return true;
    }
    return false;
  };

  let borrowSafety = 0;
  let borrowProgress = true;
  while (borrowProgress && borrowSafety < context.daysCount * 5) {
    borrowProgress = false;
    borrowSafety += 1;
    for (let d = 1; d <= context.daysCount; d++) {
      const ctx = context.daysCtx[d - 1]!;
      for (const shift of ["A", "INT", "B"] as ShiftCode[]) {
        const minNeeded = SHIFT_MINIMUMS[shift];
        while (teamForShift(ctx, shift, context.active).length < minNeeded) {
          if (!tryBorrowOne(d, shift)) break;
          borrowProgress = true;
        }
      }
    }
  }

  if (borrowSafety >= context.daysCount * 5) {
    const message = "Limite de tentativas de rebalanceamento atingido; revisão manual recomendada.";
    warnings.push(message);
    addDecisionLog(context, `[WARNING CRÍTICO] ${message}`);
    markCriticalIssue(context, message);
  }
}
