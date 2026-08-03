import { isFriday, isWeekdayMonFri } from "../calendar";
import { isNovice } from "../employees";
import type { Employee, ShiftCode } from "../types";
import { chooseBestCandidate } from "./fairness";
import type { DayContext, RowState, ScheduleContext } from "./context";
import { addDecisionLog, logDecision, markCriticalIssue, seededTieBreak } from "./context";

type Candidate = { e: Employee; shifts: ShiftCode[] };
export type FtReallocationCandidate = {
  day: number;
  sourceShift: ShiftCode;
  employee: Employee;
};

export const SHIFT_MINIMUMS: Record<ShiftCode, number> = { A: 3, INT: 2, B: 2 };

const ENC_CYCLE: Array<ShiftCode | null> = ["A", "A", null, null, "B", "B", null, null];
const SUB_OPE_CYCLE: Array<"W" | "X"> = ["W", "W", "X", "X"];

function getCycleSlot(employee: Employee, day: number, startSlot: number): number {
  if (employee.role === "ENC") {
    return ((startSlot + day - 1) % 8 + 8) % 8;
  }
  return ((startSlot + day - 1) % 4 + 4) % 4;
}

export function baseCycleStatus(
  employee: Employee,
  day: number,
  startSlot: number,
): { works: boolean; encShift: ShiftCode | null } {
  const slot = getCycleSlot(employee, day, startSlot);
  if (employee.role === "ENC") {
    const s = ENC_CYCLE[slot];
    return { works: s !== null, encShift: s };
  }
  if (employee.role === "SUB" || employee.role === "OPE") {
    return { works: SUB_OPE_CYCLE[slot] === "W", encShift: null };
  }
  return { works: false, encShift: null };
}

export function previousDayShift(
  daysCtx: DayContext[],
  date: number,
  employeeId: string,
): ShiftCode | undefined {
  if (date <= 1) return undefined;
  const prev = daysCtx[date - 2];
  return prev?.assignments.get(employeeId);
}

export function canAssign(
  daysCtx: DayContext[],
  date: number,
  employee: Employee,
  shift: ShiftCode,
  context?: ScheduleContext,
): boolean {
  const prev = previousDayShift(daysCtx, date, employee.id);
  if (prev === "B" && shift === "A") {
    if (context) logDecision(context, date, shift, employee.id, "rejected", "B → A transition blocked");
    return false;
  }
  if (employee.role === "ENC" && shift === "INT") {
    if (context) logDecision(context, date, shift, employee.id, "rejected", "ENC cannot work INT");
    return false;
  }
  return true;
}

export function tryAssign(
  daysCtx: DayContext[],
  date: number,
  employee: Employee,
  shift: ShiftCode,
  context?: ScheduleContext,
): boolean {
  const ctx = daysCtx[date - 1]!;
  if (ctx.assignments.has(employee.id)) return false;
  if (ctx.absences.has(employee.id)) return false;
  if (ctx.ftSet.has(employee.id)) return false;
  if (!canAssign(daysCtx, date, employee, shift, context)) return false;
  ctx.assignments.set(employee.id, shift);
  return true;
}

export function teamForShift(
  ctx: DayContext,
  shift: ShiftCode,
  employees: Employee[],
): Employee[] {
  return employees.filter((e) => ctx.assignments.get(e.id) === shift);
}

function hasEncOrSub(team: Employee[]): boolean {
  return team.some((e) => e.role === "ENC" || e.role === "SUB");
}

function allNovice(team: Employee[]): boolean {
  if (team.length === 0) return false;
  return team.every((e) => isNovice(e));
}

function assignAndTrack(
  daysCtx: DayContext[],
  date: number,
  employee: Employee,
  shift: ShiftCode,
  state: Map<string, RowState>,
  context?: ScheduleContext,
): boolean {
  if (!tryAssign(daysCtx, date, employee, shift, context)) return false;
  if (context) logDecision(context, date, shift, employee.id, "selected", "assigned to shift");
  const s = state.get(employee.id)!;
  s.worked += 1;
  if (shift === "A") s.countA += 1;
  else if (shift === "B") s.countB += 1;
  else s.countInt += 1;
  return true;
}

export function find_shift_shortages(context: ScheduleContext, date: number): Record<ShiftCode, number> {
  const ctx = context.daysCtx[date - 1]!;
  const already: Record<ShiftCode, number> = { A: 0, INT: 0, B: 0 };
  for (const [, shift] of ctx.assignments) already[shift] += 1;
  return {
    A: Math.max(0, SHIFT_MINIMUMS.A - already.A),
    INT: Math.max(0, SHIFT_MINIMUMS.INT - already.INT),
    B: Math.max(0, SHIFT_MINIMUMS.B - already.B),
  };
}

export function find_excess_allocations(
  context: ScheduleContext,
  shift: ShiftCode,
  excludeDay: number,
): FtReallocationCandidate[] {
  return find_excess_shifts(context, excludeDay, shift);
}

export function get_ft_reallocation_count(context: ScheduleContext, employee: Employee): number {
  return context.ftReallocationCountByEmployeeId.get(employee.id) ?? 0;
}

export function get_monthly_reallocation_count(context: ScheduleContext, employee: Employee): number {
  return context.monthlyReallocationCountByEmployeeId.get(employee.id) ?? 0;
}

export function find_excess_shifts(
  context: ScheduleContext,
  excludeDay: number,
  preferredShift?: ShiftCode,
): FtReallocationCandidate[] {
  const donorList: FtReallocationCandidate[] = [];
  const shiftOrder = preferredShift
    ? ([preferredShift, ...(["A", "INT", "B"] as ShiftCode[]).filter((s) => s !== preferredShift)] as ShiftCode[])
    : (["A", "INT", "B"] as ShiftCode[]);
  for (let day = 1; day <= context.daysCount; day++) {
    if (day === excludeDay) continue;
    const ctx = context.daysCtx[day - 1]!;
    for (const sourceShift of shiftOrder) {
      const team = teamForShift(ctx, sourceShift, context.active);
      const excess = team.length - SHIFT_MINIMUMS[sourceShift];
      if (excess <= 0) continue;
      const candidates = team.filter(
        (e) => e.role !== "ENC" && e.role !== "ESP" && e.role !== "ADM",
      );
      for (const employee of candidates) {
        donorList.push({ day, sourceShift, employee });
      }
    }
  }
  return donorList;
}

export function rank_ft_candidates(
  context: ScheduleContext,
  candidates: FtReallocationCandidate[],
): FtReallocationCandidate[] {
  return candidates.slice().sort((a, b) => {
    const aft = get_ft_reallocation_count(context, a.employee);
    const bft = get_ft_reallocation_count(context, b.employee);
    if (aft !== bft) return aft - bft;

    const aMoves = get_monthly_reallocation_count(context, a.employee);
    const bMoves = get_monthly_reallocation_count(context, b.employee);
    if (aMoves !== bMoves) return aMoves - bMoves;

    const aw = context.state.get(a.employee.id)?.worked ?? 0;
    const bw = context.state.get(b.employee.id)?.worked ?? 0;
    if (aw !== bw) return aw - bw;

    const dayTie = seededTieBreak(`${a.day}-${a.sourceShift}`, `${b.day}-${b.sourceShift}`, context.attemptSeed);
    if (dayTie !== 0) return dayTie;
    return seededTieBreak(a.employee.id, b.employee.id, context.attemptSeed);
  });
}

export function select_best_ft_candidate(
  context: ScheduleContext,
  candidates: FtReallocationCandidate[],
): FtReallocationCandidate | null {
  return rank_ft_candidates(context, candidates)[0] ?? null;
}

export function can_reallocate_operator(
  context: ScheduleContext,
  srcDay: number,
  dstDay: number,
  employee: Employee,
  dstShift: ShiftCode,
): { ok: boolean; reason: string } {
  const srcCtx = context.daysCtx[srcDay - 1]!;
  const dstCtx = context.daysCtx[dstDay - 1]!;
  const prevShift = srcCtx.assignments.get(employee.id);
  if (!prevShift) return { ok: false, reason: "operador não está alocado no dia de origem" };
  if (employee.role === "ESP") return { ok: false, reason: "operador raro preservado como reserva" };
  if (employee.role === "ENC" || employee.role === "ADM") {
    return { ok: false, reason: "função preservada para realocação automática" };
  }
  if (dstCtx.absences.has(employee.id)) return { ok: false, reason: "operador indisponível no destino" };
  if (dstCtx.assignments.has(employee.id)) return { ok: false, reason: "operador já possui alocação no destino" };
  if (dstCtx.ftSet.has(employee.id)) return { ok: false, reason: "operador já recebeu FT no destino" };
  if (!canAssign(context.daysCtx, dstDay, employee, dstShift, context)) {
    return { ok: false, reason: "violaria regra de sequência ou compatibilidade" };
  }
  const donorCount = teamForShift(srcCtx, prevShift, context.active).length;
  if (donorCount - 1 < SHIFT_MINIMUMS[prevShift]) {
    return { ok: false, reason: "remoção deixaria o turno original abaixo do mínimo" };
  }
  return { ok: true, reason: "realocação válida" };
}

export function reallocate_excess_operator(
  context: ScheduleContext,
  srcDay: number,
  dstDay: number,
  employee: Employee,
  dstShift: ShiftCode,
): boolean {
  const srcCtx = context.daysCtx[srcDay - 1]!;
  const prevShift = srcCtx.assignments.get(employee.id);
  if (!prevShift) return false;

  srcCtx.assignments.delete(employee.id);
  srcCtx.ftSet.add(employee.id);

  const state = context.state.get(employee.id)!;
  state.worked = Math.max(0, state.worked - 1);
  state.ft += 1;
  if (prevShift === "A") state.countA = Math.max(0, state.countA - 1);
  else if (prevShift === "B") state.countB = Math.max(0, state.countB - 1);
  else state.countInt = Math.max(0, state.countInt - 1);

  addDecisionLog(context, `[Dia ${srcDay}] ${employee.name} removido de ${prevShift} e marcado como FT.`);

  if (!assignAndTrack(context.daysCtx, dstDay, employee, dstShift, context.state, context)) {
    srcCtx.assignments.set(employee.id, prevShift);
    srcCtx.ftSet.delete(employee.id);
    state.worked += 1;
    state.ft = Math.max(0, state.ft - 1);
    if (prevShift === "A") state.countA += 1;
    else if (prevShift === "B") state.countB += 1;
    else state.countInt += 1;
    addDecisionLog(context, `[Dia ${srcDay} -> Dia ${dstDay}] Reversão aplicada após falha ao realocar ${employee.name}.`);
    return false;
  }

  context.ftReallocationCountByEmployeeId.set(
    employee.id,
    get_ft_reallocation_count(context, employee) + 1,
  );
  context.monthlyReallocationCountByEmployeeId.set(
    employee.id,
    get_monthly_reallocation_count(context, employee) + 1,
  );

  addDecisionLog(
    context,
    `[Dia ${srcDay} -> Dia ${dstDay}] ${employee.name} removido de ${prevShift}, marcado como FT no Dia ${srcDay} e realocado para ${dstShift} no Dia ${dstDay}.`,
  );
  return true;
}

export function fillEncAssignments(context: ScheduleContext, warnings: string[]): void {
  const encList = context.active.filter((e) => e.role === "ENC");
  for (let d = 1; d <= context.daysCount; d++) {
    const ctx = context.daysCtx[d - 1]!;
    const usedShifts = new Set<ShiftCode>();
    for (const e of encList) {
      if (ctx.absences.has(e.id)) continue;
      const start = context.startSlotById.get(e.id)!;
      const base = baseCycleStatus(e, d, start);
      if (!base.works || !base.encShift) continue;
      if (usedShifts.has(base.encShift)) {
        ctx.ftSet.add(e.id);
        const s = context.state.get(e.id)!;
        s.ft += 1;
        warnings.push(
          `ENC ${e.name} dia ${d}: turno ${base.encShift} já ocupado por outro ENC; marcado FT.`,
        );
        continue;
      }
      const ok = assignAndTrack(context.daysCtx, d, e, base.encShift, context.state, context);
      if (ok) {
        usedShifts.add(base.encShift);
      } else {
        warnings.push(`ENC ${e.name} dia ${d}: não foi possível atribuir ${base.encShift}.`);
      }
    }
  }
}

export function fillRemainingAsFt(
  context: ScheduleContext,
  date: number,
  candidates: Candidate[],
): void {
  const ctx = context.daysCtx[date - 1]!;
  const remaining = candidates
    .filter((c) => !ctx.assignments.has(c.e.id))
    .sort((a, b) => {
      if (a.e.role !== b.e.role) {
        if (a.e.role === "SUB") return -1;
        if (b.e.role === "SUB") return 1;
      }
      const workedDiff = context.state.get(b.e.id)!.worked - context.state.get(a.e.id)!.worked;
      if (workedDiff !== 0) return workedDiff;
      return seededTieBreak(a.e.id, b.e.id, context.attemptSeed);
    });

  for (const c of remaining) {
    const s = context.state.get(c.e.id)!;
    const wouldExceedMax = s.worked + 1 > 16;
    const overflowShift = !wouldExceedMax ? (c.shifts.find((sh) => sh === "INT") ?? null) : null;
    if (overflowShift && assignAndTrack(context.daysCtx, date, c.e, overflowShift, context.state, context)) {
      addDecisionLog(context, `[Dia ${date}] ${c.e.name} alocado em ${overflowShift} por excedente disponível.`);
      continue;
    }
    ctx.ftSet.add(c.e.id);
    s.ft += 1;
    addDecisionLog(context, `[Dia ${date}] ${c.e.name} concedido FT.`);
  }
}

export function fillSubOpeAssignments(context: ScheduleContext): void {
  const carlos = context.active.find((e) => e.id === "esp-carlos");
  const leandro = context.active.find((e) => e.id === "esp-leandro");
  const espUsage = { carlos: 0, leandro: 0 };
  const ESP_CARLOS_MAX = 2;
  const ESP_LEANDRO_MAX = 4;

  const tryFillWithEsp = (date: number, shift: ShiftCode): boolean => {
    const ctx = context.daysCtx[date - 1]!;
    if (
      shift === "A" &&
      isFriday(ctx.weekday) &&
      carlos &&
      espUsage.carlos < ESP_CARLOS_MAX &&
      !ctx.absences.has(carlos.id) &&
      !ctx.assignments.has(carlos.id) &&
      !ctx.ftSet.has(carlos.id)
    ) {
      addDecisionLog(context, `[Dia ${date} - ${shift}] Operador raro disponível: ${carlos.name}.`);
      if (assignAndTrack(context.daysCtx, date, carlos, "A", context.state, context)) {
        espUsage.carlos += 1;
        addDecisionLog(context, `[Dia ${date} - ${shift}] ${carlos.name} utilizado como recurso raro.`);
        markCriticalIssue(context, "Operador raro utilizado. Revisão manual recomendada.");
        return true;
      }
    }
    if (
      shift === "INT" &&
      isWeekdayMonFri(ctx.weekday) &&
      leandro &&
      espUsage.leandro < ESP_LEANDRO_MAX &&
      !ctx.absences.has(leandro.id) &&
      !ctx.assignments.has(leandro.id) &&
      !ctx.ftSet.has(leandro.id)
    ) {
      addDecisionLog(context, `[Dia ${date} - ${shift}] Operador raro disponível: ${leandro.name}.`);
      if (assignAndTrack(context.daysCtx, date, leandro, "INT", context.state, context)) {
        espUsage.leandro += 1;
        addDecisionLog(context, `[Dia ${date} - ${shift}] ${leandro.name} utilizado como recurso raro.`);
        markCriticalIssue(context, "Operador raro utilizado. Revisão manual recomendada.");
        return true;
      }
    }
    return false;
  };

  for (let d = 1; d <= context.daysCount; d++) {
    const ctx = context.daysCtx[d - 1]!;
    const shortages = find_shift_shortages(context, d);
    const candidates = context.active
      .filter((e) => e.role === "SUB" || e.role === "OPE")
      .filter((e) => !ctx.absences.has(e.id))
      .filter((e) => baseCycleStatus(e, d, context.startSlotById.get(e.id)!).works);

    const cands: Candidate[] = candidates.map((e) => ({
      e,
      shifts: (["A", "INT", "B"] as ShiftCode[]).filter((s) => canAssign(context.daysCtx, d, e, s, context)),
    }));

    const need: Record<ShiftCode, number> = { ...shortages };

    for (const shift of ["A", "INT", "B"] as ShiftCode[]) {
      if (need[shift] > 0) {
        addDecisionLog(context, `[Dia ${d} - ${shift}] Déficit detectado: ${need[shift]} operador(es).`);
      }
    }

    const aTeamHasEncOrSub = () => hasEncOrSub(teamForShift(ctx, "A", context.active));
    if (!aTeamHasEncOrSub() && need.A > 0) {
      const sub = cands
        .filter((c) => c.e.role === "SUB" && !ctx.assignments.has(c.e.id) && c.shifts.includes("A"))
        .sort((a, b) => context.state.get(a.e.id)!.worked - context.state.get(b.e.id)!.worked)[0];
      if (sub) {
        addDecisionLog(context, `[Dia ${d} - A] Candidato analisado: ${sub.e.name}.`);
        if (assignAndTrack(context.daysCtx, d, sub.e, "A", context.state, context)) {
          need.A -= 1;
        } else {
          addDecisionLog(context, `[Dia ${d} - A] Candidato rejeitado: conflito ou regra bloqueou a alocação.`);
        }
      }
    }
    const bTeamHasEncOrSub = () => hasEncOrSub(teamForShift(ctx, "B", context.active));
    if (!bTeamHasEncOrSub() && need.B > 0) {
      const sub = cands
        .filter((c) => c.e.role === "SUB" && !ctx.assignments.has(c.e.id) && c.shifts.includes("B"))
        .sort((a, b) => context.state.get(a.e.id)!.worked - context.state.get(b.e.id)!.worked)[0];
      if (sub) {
        addDecisionLog(context, `[Dia ${d} - B] Candidato analisado: ${sub.e.name}.`);
        if (assignAndTrack(context.daysCtx, d, sub.e, "B", context.state, context)) {
          need.B -= 1;
        } else {
          addDecisionLog(context, `[Dia ${d} - B] Candidato rejeitado: conflito ou regra bloqueou a alocação.`);
        }
      }
    }

    for (const shift of ["A", "B", "INT"] as ShiftCode[]) {
      while (need[shift] > 0) {
        const pick = chooseBestCandidate(context, d, shift, cands, context.state);
        if (pick) {
          addDecisionLog(context, `[Dia ${d} - ${shift}] Candidato analisado: ${pick.name}.`);
          if (assignAndTrack(context.daysCtx, d, pick, shift, context.state, context)) {
            need[shift] -= 1;
            continue;
          }
          addDecisionLog(context, `[Dia ${d} - ${shift}] Candidato rejeitado: conflito ou regra bloqueou a alocação.`);
        }
        addDecisionLog(context, `[Busca FT] Procurando excedentes no mês para cobrir Dia ${d} - ${shift}.`);
        const excess = find_excess_allocations(context, shift, d);
        if (excess.length === 0) {
          addDecisionLog(context, `[Dia ${d} - ${shift}] Nenhum excedente válido encontrado.`);
        }
        const excessByShift = new Map<string, typeof excess>();
        for (const item of excess) {
          const key = `${item.day}-${item.sourceShift}`;
          const grouped = excessByShift.get(key) ?? [];
          grouped.push(item);
          excessByShift.set(key, grouped);
        }
        for (const grouped of excessByShift.values()) {
          const first = grouped[0]!;
          addDecisionLog(
            context,
            `[Dia ${first.day} - ${first.sourceShift}] Excedente encontrado: ${grouped
              .map((item) => item.employee.name)
              .join(", ")}.`,
          );
          addDecisionLog(context, `[Dia ${first.day} - ${first.sourceShift}] Avaliando candidatos para FT/realocação.`);
        }
        let resolved = false;
        const ranked = rank_ft_candidates(context, excess);
        for (const item of ranked) {
          const ftCount = get_ft_reallocation_count(context, item.employee);
          const moveCount = get_monthly_reallocation_count(context, item.employee);
          addDecisionLog(
            context,
            `[Dia ${item.day} - ${item.sourceShift}] ${item.employee.name} avaliado: ${ftCount} FT por realocação, ${moveCount} deslocamento(s) no mês.`,
          );
          const check = can_reallocate_operator(context, item.day, d, item.employee, shift);
          if (!check.ok) {
            addDecisionLog(context, `[Dia ${item.day} -> Dia ${d}] ${item.employee.name} rejeitado: ${check.reason}.`);
            continue;
          }
          addDecisionLog(
            context,
            `[Dia ${item.day} - ${item.sourceShift}] ${item.employee.name} aprovado: ${ftCount} FT por realocação no mês.`,
          );
          if (reallocate_excess_operator(context, item.day, d, item.employee, shift)) {
            for (const skipped of ranked) {
              if (skipped.employee.id === item.employee.id) continue;
              const skippedFtCount = get_ft_reallocation_count(context, skipped.employee);
              if (skippedFtCount > ftCount) {
                addDecisionLog(
                  context,
                  `[Dia ${skipped.day} - ${skipped.sourceShift}] ${skipped.employee.name} ignorado: já possui ${skippedFtCount} FT por realocação no mês.`,
                );
              }
            }
            need[shift] -= 1;
            resolved = true;
            break;
          }
        }
        if (resolved) {
          continue;
        }
        if (tryFillWithEsp(d, shift)) {
          need[shift] -= 1;
          continue;
        }
        markCriticalIssue(context, `[Dia ${d} - ${shift}] Pendência não resolvida automaticamente.`);
        break;
      }
      if (need[shift] > 0) {
        markCriticalIssue(context, `[Dia ${d} - ${shift}] Turno ficou abaixo do mínimo operacional.`);
      }
    }

    fillRemainingAsFt(context, d, cands);
  }
}

export { assignAndTrack, hasEncOrSub, allNovice };
