import { weekdayOf } from "../calendar";
import type { EmployeeRow, ScheduleResult, ShiftCode } from "../types";
import { SHIFT_MINIMUMS } from "./assignment";

type CriticalDay = {
  day: number;
  priority: number;
  reason: string;
};

type ReallocationValidation = {
  ok: boolean;
  reason: string;
};

type ShiftTotals = Record<ShiftCode, number>;

type CriticalDayReport = CriticalDay & {
  before: ShiftTotals;
  after: ShiftTotals;
  reinforcements: string[];
};

type ExcessReport = {
  day: number;
  shift: ShiftCode;
  total: number;
  minimum: number;
  maximum?: number;
  candidates: string[];
};

type AppliedReallocation = {
  operator: string;
  sourceDay: number;
  sourceShift: ShiftCode;
  destinationDay: number;
  destinationShift: ShiftCode;
  destinationReason: string;
};

type RejectionExample = {
  operator: string;
  sourceDay: number;
  sourceShift: ShiftCode;
  destinationDay?: number;
  destinationShift: ShiftCode;
  reason: string;
};

const SHIFTS: ShiftCode[] = ["A", "INT", "B"];
const DESTINATION_SHIFT_PRIORITY: ShiftCode[] = ["INT", "A", "B"];
const MAX_CONSECUTIVE_WORK_DAYS = 2;
const MAX_REALLOCATIONS_PER_OPERATOR = 1;
const SHIFT_MAXIMUMS: Partial<Record<ShiftCode, number>> = { INT: 3 };

function getCriticalDays(result: ScheduleResult): CriticalDay[] {
  const priorities = new Map<number, { priority: number; reason: string }>();
  const add = (day: number, priority: number, reason: string) => {
    if (day < 1 || day > result.perDay.length) return;
    const current = priorities.get(day);
    if (current === undefined || priority < current.priority) priorities.set(day, { priority, reason });
  };

  for (const day of result.perDay) {
    if (day.isHoliday) {
      add(day.date, 1, "feriado informado");
      add(day.date - 1, 2, "véspera de feriado");
      add(day.date + 1, 3, "pós-feriado");
    }
  }

  for (const day of result.perDay) {
    const weekday = day.weekday;
    if (weekday === 6) add(day.date, 4, "sábado");
    else if (weekday === 0) add(day.date, 5, "domingo");
    else if (weekday === 5) add(day.date, 6, "sexta-feira");
  }

  return Array.from(priorities.entries())
    .map(([day, info]) => ({ day, priority: info.priority, reason: info.reason }))
    .sort((a, b) => a.priority - b.priority || a.day - b.day);
}

function rebuildDerivedFields(result: ScheduleResult): void {
  for (const row of result.rows) {
    let workedDays = 0;
    let ftDays = 0;
    let countA = 0;
    let countB = 0;
    let countInt = 0;
    let countSat = 0;
    let countSun = 0;

    for (const day of row.days) {
      if (day.kind === "FT") {
        ftDays += 1;
      }
      if (day.kind !== "WORK") continue;
      workedDays += 1;
      if (day.shift === "A") countA += 1;
      if (day.shift === "B") countB += 1;
      if (day.shift === "INT") countInt += 1;

      const weekday = weekdayOf(result.year, result.month, day.date);
      if (weekday === 6) countSat += 1;
      if (weekday === 0) countSun += 1;
    }

    row.workedDays = workedDays;
    row.ftDays = ftDays;
    row.countA = countA;
    row.countB = countB;
    row.countInt = countInt;
    row.countSat = countSat;
    row.countSun = countSun;
  }

  result.perDay = result.perDay.map((day) => ({
    ...day,
    A: result.rows
      .filter((row) => row.days[day.date - 1]?.kind === "WORK" && row.days[day.date - 1]?.shift === "A")
      .map((row) => row.employee.name),
    INT: result.rows
      .filter((row) => row.days[day.date - 1]?.kind === "WORK" && row.days[day.date - 1]?.shift === "INT")
      .map((row) => row.employee.name),
    B: result.rows
      .filter((row) => row.days[day.date - 1]?.kind === "WORK" && row.days[day.date - 1]?.shift === "B")
      .map((row) => row.employee.name),
  }));
}

function teamRowsForShift(result: ScheduleResult, day: number, shift: ShiftCode): EmployeeRow[] {
  return result.rows.filter((row) => {
    const assignment = row.days[day - 1];
    return assignment?.kind === "WORK" && assignment.shift === shift;
  });
}

function getShiftMaximum(shift: ShiftCode): number | undefined {
  return SHIFT_MAXIMUMS[shift];
}

function canReceiveReinforcement(result: ScheduleResult, day: number, shift: ShiftCode): boolean {
  const count = teamRowsForShift(result, day, shift).length;
  const maximum = getShiftMaximum(shift);
  if (maximum !== undefined && count >= maximum) return false;
  return count <= SHIFT_MINIMUMS[shift];
}

function getSourceExcess(result: ScheduleResult, day: number, shift: ShiftCode): number {
  const count = teamRowsForShift(result, day, shift).length;
  if (shift === "INT") {
    return Math.max(0, count - (SHIFT_MAXIMUMS.INT ?? SHIFT_MINIMUMS.INT));
  }
  return Math.max(0, count - SHIFT_MINIMUMS[shift]);
}

function getShiftTotals(result: ScheduleResult, day: number): ShiftTotals {
  return {
    A: teamRowsForShift(result, day, "A").length,
    INT: teamRowsForShift(result, day, "INT").length,
    B: teamRowsForShift(result, day, "B").length,
  };
}

function formatShiftTotals(totals: ShiftTotals): string {
  return `A=${totals.A}, INT=${totals.INT}, B=${totals.B}`;
}

function countPotentialExcesses(result: ScheduleResult, criticalDaySet: Set<number>): number {
  let total = 0;
  for (let day = 1; day <= result.perDay.length; day++) {
    if (criticalDaySet.has(day)) continue;
    for (const shift of SHIFTS) total += getSourceExcess(result, day, shift);
  }
  return total;
}

function collectExcessReports(result: ScheduleResult, criticalDaySet: Set<number>): ExcessReport[] {
  const reports: ExcessReport[] = [];
  for (let day = 1; day <= result.perDay.length; day++) {
    if (criticalDaySet.has(day)) continue;
    for (const shift of SHIFTS) {
      const excess = getSourceExcess(result, day, shift);
      if (excess <= 0) continue;
      const maximum = getShiftMaximum(shift);
      reports.push({
        day,
        shift,
        total: teamRowsForShift(result, day, shift).length,
        minimum: SHIFT_MINIMUMS[shift],
        maximum,
        candidates: teamRowsForShift(result, day, shift)
          .filter((row) => row.employee.role !== "ENC")
          .map((row) => row.employee.name),
      });
    }
  }
  return reports;
}

function addRejection(
  rejectionCounts: Map<string, number>,
  rejectionExamples: RejectionExample[],
  rejection: RejectionExample,
): void {
  rejectionCounts.set(rejection.reason, (rejectionCounts.get(rejection.reason) ?? 0) + 1);
  if (rejectionExamples.length < 20) rejectionExamples.push(rejection);
}

function buildStructuredLog(params: {
  result: ScheduleResult;
  criticalDays: CriticalDayReport[];
  excessReports: ExcessReport[];
  appliedReallocations: AppliedReallocation[];
  rejectionCounts: Map<string, number>;
  rejectionExamples: RejectionExample[];
  protectedEncCount: number;
  potentialExcessCount: number;
}): string {
  const holidayDays = params.result.perDay.filter((day) => day.isHoliday).map((day) => day.date);
  const holidayCriticalDays = params.criticalDays.filter((day) => day.reason === "feriado informado");
  const totalRejected = Array.from(params.rejectionCounts.values()).reduce((sum, count) => sum + count, 0);
  const lines: string[] = [];

  lines.push("LOG DA GERAÇÃO - REFORÇO EM DIAS CRÍTICOS");
  lines.push("=".repeat(52));
  lines.push("");
  lines.push("1. Resumo da geração");
  lines.push(`Mês/Ano: ${params.result.month}/${params.result.year}`);
  lines.push(`Feriados informados: ${holidayDays.length > 0 ? holidayDays.join(", ") : "nenhum"}`);
  lines.push(
    `Dias críticos identificados: ${
      holidayCriticalDays.length > 0
        ? holidayCriticalDays.map((day) => `dia ${day.day} (${day.reason})`).join("; ")
        : "nenhum feriado informado"
    }`,
  );
  lines.push(`Quantidade de excedentes encontrados: ${params.potentialExcessCount}`);
  lines.push(`Quantidade de realocações aplicadas: ${params.appliedReallocations.length}`);
  lines.push(`Quantidade de tentativas rejeitadas: ${totalRejected}`);
  lines.push("Rejeições por motivo:");
  if (params.rejectionCounts.size === 0) lines.push("- nenhuma");
  for (const [reason, count] of params.rejectionCounts.entries()) lines.push(`- ${count}: ${reason}`);

  lines.push("");
  lines.push("2. Dias críticos");
  for (const day of params.criticalDays) {
    lines.push(`Dia ${day.day} - ${day.reason}`);
    lines.push(`  Totais antes: ${formatShiftTotals(day.before)}`);
    lines.push(`  Totais depois: ${formatShiftTotals(day.after)}`);
    lines.push(
      `  Reforços recebidos: ${
        day.reinforcements.length > 0 ? day.reinforcements.join("; ") : "nenhum"
      }`,
    );
  }

  lines.push("");
  lines.push("3. Excedentes detectados");
  if (params.excessReports.length === 0) lines.push("Nenhum excedente real detectado em dia normal.");
  for (const excess of params.excessReports) {
    lines.push(
      `Dia ${excess.day} ${excess.shift}: total=${excess.total}, mínimo=${excess.minimum}, máximo=${
        excess.maximum ?? "não definido"
      }, candidatos=${excess.candidates.length > 0 ? excess.candidates.join(", ") : "nenhum"}`,
    );
  }

  lines.push("");
  lines.push("4. Realocações aplicadas");
  if (params.appliedReallocations.length === 0) lines.push("Nenhuma realocação aplicada.");
  for (const item of params.appliedReallocations) {
    lines.push(
      `[OK] ${item.operator} | Origem: Dia ${item.sourceDay} ${item.sourceShift} | Destino: Dia ${item.destinationDay} ${item.destinationShift} | Origem virou FT | Motivo: reforço de ${item.destinationReason}`,
    );
  }

  lines.push("");
  lines.push("5. Realocações rejeitadas");
  if (params.rejectionCounts.size === 0) lines.push("Nenhuma rejeição.");
  for (const [reason, count] of params.rejectionCounts.entries()) lines.push(`- ${count} rejeição(ões): ${reason}`);
  if (params.rejectionExamples.length > 0) {
    lines.push("");
    lines.push("Exemplos detalhados de rejeição (até 20):");
    for (const item of params.rejectionExamples) {
      lines.push(
        `[REJEITADA] ${item.operator} | Origem: Dia ${item.sourceDay} ${item.sourceShift} | Destino: ${
          item.destinationDay ? `Dia ${item.destinationDay}` : "indisponível"
        } ${item.destinationShift} | Motivo: ${item.reason}`,
      );
    }
  }

  return lines.join("\n");
}

function isFreeOnDay(row: EmployeeRow, day: number): boolean {
  const assignment = row.days[day - 1];
  return assignment?.kind === "OFF" && assignment.shift === null;
}

function maxConsecutiveWorkDays(row: EmployeeRow, override?: Record<number, "WORK" | "FT">): number {
  let current = 0;
  let max = 0;

  for (const day of row.days) {
    const overriddenKind = override?.[day.date];
    const kind = overriddenKind ?? day.kind;
    if (kind === "WORK") {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }

  return max;
}

export function validateTwoByTwoPatternForOperator(
  row: EmployeeRow,
  sourceDay: number,
  destinationDay: number,
  reallocationCount: number,
): ReallocationValidation {
  if (row.employee.role === "ENC") {
    return { ok: false, reason: "encarregado preservado pela regra de reforço" };
  }
  if (reallocationCount >= MAX_REALLOCATIONS_PER_OPERATOR) {
    return { ok: false, reason: "operador já possui uma realocação de reforço no mês" };
  }
  if (!isFreeOnDay(row, destinationDay)) {
    return { ok: false, reason: "destino não era folga/livre do operador" };
  }

  const maxConsecutive = maxConsecutiveWorkDays(row, {
    [sourceDay]: "FT",
    [destinationDay]: "WORK",
  });
  if (maxConsecutive > MAX_CONSECUTIVE_WORK_DAYS) {
    return {
      ok: false,
      reason: `realocação criaria sequência de ${maxConsecutive} dias trabalhados`,
    };
  }

  return { ok: true, reason: "realocação preserva o padrão 2x2" };
}

export function applyCriticalDayReinforcement(result: ScheduleResult): ScheduleResult {
  const criticalDays = getCriticalDays(result);
  if (criticalDays.length === 0) return result;

  const criticalDaySet = new Set(criticalDays.map((day) => day.day));
  const criticalDayReports: CriticalDayReport[] = criticalDays.map((day) => ({
    ...day,
    before: getShiftTotals(result, day.day),
    after: getShiftTotals(result, day.day),
    reinforcements: [],
  }));
  const criticalDayReportByDay = new Map(criticalDayReports.map((day) => [day.day, day]));
  const excessReportsBefore = collectExcessReports(result, criticalDaySet);
  const potentialExcessCount = countPotentialExcesses(result, criticalDaySet);
  const rejectionCounts = new Map<string, number>();
  const rejectionExamples: RejectionExample[] = [];
  const appliedReallocations: AppliedReallocation[] = [];
  const reallocationCountByEmployeeId = new Map<string, number>();
  const protectedEncIds = new Set<string>();

  for (const destination of criticalDays) {
    const destinationDay = destination.day;

    for (const destinationShift of DESTINATION_SHIFT_PRIORITY) {
      while (canReceiveReinforcement(result, destinationDay, destinationShift)) {
        let applied = false;
        let exhaustedCandidates = true;

        for (let sourceDay = 1; sourceDay <= result.perDay.length; sourceDay++) {
          if (criticalDaySet.has(sourceDay)) {
            for (const row of teamRowsForShift(result, sourceDay, destinationShift)) {
              addRejection(rejectionCounts, rejectionExamples, {
                operator: row.employee.name,
                sourceDay,
                sourceShift: destinationShift,
                destinationDay,
                destinationShift,
                reason: "origem é dia crítico",
              });
            }
            continue;
          }
          if (getSourceExcess(result, sourceDay, destinationShift) <= 0) continue;

          const sourceTeam = teamRowsForShift(result, sourceDay, destinationShift);
          for (const row of sourceTeam) {
            if (row.employee.role === "ENC") protectedEncIds.add(row.employee.id);
          }
          const candidates = sourceTeam.filter((row) => row.employee.role !== "ENC");
          if (candidates.length > 0) exhaustedCandidates = false;

          for (const candidate of candidates) {
            const reallocationCount = reallocationCountByEmployeeId.get(candidate.employee.id) ?? 0;
            const validation = validateTwoByTwoPatternForOperator(
              candidate,
              sourceDay,
              destinationDay,
              reallocationCount,
            );
            const duplicatedOnDestination = teamRowsForShift(result, destinationDay, destinationShift).some(
              (row) => row.employee.id === candidate.employee.id,
            );
            const sourceWouldKeepMinimum =
              teamRowsForShift(result, sourceDay, destinationShift).length - 1 >=
              SHIFT_MINIMUMS[destinationShift];
            const destinationMaximum = getShiftMaximum(destinationShift);
            const destinationWouldRespectMaximum =
              destinationMaximum === undefined ||
              teamRowsForShift(result, destinationDay, destinationShift).length + 1 <= destinationMaximum;

            let rejectionReason = "";
            if (!sourceWouldKeepMinimum) {
              rejectionReason = "origem ficaria abaixo do mínimo";
            } else if (!destinationWouldRespectMaximum) {
              rejectionReason = `destino ultrapassaria o máximo do turno ${destinationShift}`;
            } else if (duplicatedOnDestination) {
              rejectionReason = "operador já está no turno de destino";
            } else if (!validation.ok) {
              rejectionReason = validation.reason;
            }

            if (rejectionReason) {
              addRejection(rejectionCounts, rejectionExamples, {
                operator: candidate.employee.name,
                sourceDay,
                sourceShift: destinationShift,
                destinationDay,
                destinationShift,
                reason: rejectionReason,
              });
              continue;
            }

            const sourceAssignment = candidate.days[sourceDay - 1]!;
            const destinationAssignment = candidate.days[destinationDay - 1]!;
            sourceAssignment.kind = "FT";
            sourceAssignment.shift = null;
            destinationAssignment.kind = "WORK";
            destinationAssignment.shift = destinationShift;
            reallocationCountByEmployeeId.set(candidate.employee.id, reallocationCount + 1);

            const appliedReallocation: AppliedReallocation = {
              operator: candidate.employee.name,
              sourceDay,
              sourceShift: destinationShift,
              destinationDay,
              destinationShift,
              destinationReason: destination.reason,
            };
            appliedReallocations.push(appliedReallocation);
            criticalDayReportByDay
              .get(destinationDay)
              ?.reinforcements.push(`${candidate.employee.name} em ${destinationShift}`);
            applied = true;
            break;
          }

          if (applied) break;
        }

        if (!applied) {
          if (exhaustedCandidates) {
            addRejection(rejectionCounts, rejectionExamples, {
              operator: "-",
              sourceDay: 0,
              sourceShift: destinationShift,
              destinationDay,
              destinationShift,
              reason: "nenhum excedente real disponível em dia normal",
            });
          }
          break;
        }
      }
    }
  }

  rebuildDerivedFields(result);
  for (const day of criticalDayReports) day.after = getShiftTotals(result, day.day);

  if (result.metrics && appliedReallocations.length > 0) {
    const distributionByName = new Map<string, { employeeId: string; employeeName: string; count: number }>();
    for (const entry of result.metrics.ftReallocationDistribution) {
      distributionByName.set(entry.employeeName, { ...entry });
    }
    for (const item of appliedReallocations) {
      const row = result.rows.find((candidate) => candidate.employee.name === item.operator);
      const employeeId = row?.employee.id ?? item.operator;
      const current = distributionByName.get(item.operator) ?? {
        employeeId,
        employeeName: item.operator,
        count: 0,
      };
      current.count += 1;
      distributionByName.set(item.operator, current);
    }
    const ftReallocationDistribution = Array.from(distributionByName.values())
      .filter((entry) => entry.count > 0)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.employeeName.localeCompare(b.employeeName);
      });
    result.metrics = {
      ...result.metrics,
      totalAdjustments: result.metrics.totalAdjustments + appliedReallocations.length,
      totalFtReallocations: result.metrics.totalFtReallocations + appliedReallocations.length,
      maxFtReallocationsForOneEmployee: ftReallocationDistribution[0]?.count ?? 0,
      ftReallocationSquarePenalty: ftReallocationDistribution.reduce(
        (total, entry) => total + entry.count * entry.count,
        0,
      ),
      ftReallocationDistribution,
      twoByTwoPenalty:
        result.metrics.totalAdjustments +
        appliedReallocations.length +
        result.metrics.totalFtReallocations +
        appliedReallocations.length,
    };
  }

  result.reinforcementLogText = buildStructuredLog({
    result,
    criticalDays: criticalDayReports,
    excessReports: excessReportsBefore,
    appliedReallocations,
    rejectionCounts,
    rejectionExamples,
    protectedEncCount: protectedEncIds.size,
    potentialExcessCount,
  });

  result.decisionLog = [
    ...result.decisionLog.filter((line) => !line.startsWith("[PÓS-PROCESSAMENTO]")),
    `[PÓS-PROCESSAMENTO] Reforço em dias críticos: ${appliedReallocations.length} aplicada(s), ${Array.from(
      rejectionCounts.values(),
    ).reduce((sum, count) => sum + count, 0)} rejeitada(s).`,
    "[PÓS-PROCESSAMENTO] Log estruturado disponível para download.",
  ];

  if (appliedReallocations.length > 0) {
    result.decisionLog.push(
      `[PÓS-PROCESSAMENTO] Aplicadas: ${appliedReallocations
        .map((item) => `${item.operator} dia ${item.sourceDay}->${item.destinationDay} ${item.destinationShift}`)
        .join("; ")}.`,
    );
  }

  return result;
}
