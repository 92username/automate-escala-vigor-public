import type {
  Employee,
  ScheduleAlternative,
  ScheduleMetrics,
  ScheduleOptimizationProfile,
  ScheduleResult,
} from "../types";
import type { ScheduleContext } from "./context";

export const OPTIMIZATION_PROFILES: Array<{
  profile: ScheduleOptimizationProfile;
  label: string;
  description: string;
}> = [
  {
    profile: "best_overall",
    label: "Melhor Geral",
    description: "Equilibra ajustes, FT distribuida e carga de trabalho.",
  },
  {
    profile: "fewest_adjustments",
    label: "Menos Ajustes",
    description: "Preserva melhor a escala 2x2 e reduz realocacoes.",
  },
  {
    profile: "most_balanced",
    label: "Mais Equilibrada",
    description: "Prioriza carga parecida e FT menos concentrada.",
  },
];

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function collectScheduleMetrics(result: ScheduleResult, context: ScheduleContext): ScheduleMetrics {
  const ftDistribution = context.active
    .map((employee) => ({
      employeeId: employee.id,
      employeeName: employee.name,
      count: context.ftReallocationCountByEmployeeId.get(employee.id) ?? 0,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.employeeName.localeCompare(b.employeeName);
    });

  const workloads = result.rows.map((row) => row.workedDays);
  const workloadMin = workloads.length > 0 ? Math.min(...workloads) : 0;
  const workloadMax = workloads.length > 0 ? Math.max(...workloads) : 0;
  const shiftBalancePenalty = result.rows.reduce((total, row) => {
    const counts = [row.countA, row.countB, row.countInt];
    return total + Math.max(...counts) - Math.min(...counts);
  }, 0);
  const totalFtReallocations = sum(context.ftReallocationCountByEmployeeId.values());
  const totalAdjustments = sum(context.monthlyReallocationCountByEmployeeId.values());
  const maxFtReallocationsForOneEmployee = ftDistribution[0]?.count ?? 0;
  const ftReallocationSquarePenalty = ftDistribution.reduce(
    (total, entry) => total + entry.count * entry.count,
    0,
  );
  const criticalWarningCount =
    context.criticalIssues.length + result.decisionLog.filter((line) => line.includes("[WARNING CRÍTICO]")).length;

  return {
    totalAdjustments,
    totalFtReallocations,
    maxFtReallocationsForOneEmployee,
    ftReallocationSquarePenalty,
    ftReallocationDistribution: ftDistribution,
    workloadMin,
    workloadMax,
    workloadSpread: workloadMax - workloadMin,
    shiftBalancePenalty,
    twoByTwoPenalty: totalAdjustments + totalFtReallocations,
    violationCount: result.violations.length,
    warningCount: result.warnings.length,
    criticalWarningCount,
  };
}

function baseScore(metrics: ScheduleMetrics): number[] {
  return [metrics.violationCount, metrics.criticalWarningCount];
}

export function scoreSchedule(metrics: ScheduleMetrics, profile: ScheduleOptimizationProfile): number[] {
  if (profile === "fewest_adjustments") {
    return [
      ...baseScore(metrics),
      metrics.totalAdjustments,
      metrics.twoByTwoPenalty,
      metrics.totalFtReallocations,
      metrics.maxFtReallocationsForOneEmployee,
      metrics.ftReallocationSquarePenalty,
      metrics.workloadSpread,
      metrics.shiftBalancePenalty,
      metrics.warningCount,
    ];
  }

  if (profile === "most_balanced") {
    return [
      ...baseScore(metrics),
      metrics.workloadSpread,
      metrics.maxFtReallocationsForOneEmployee,
      metrics.ftReallocationSquarePenalty,
      metrics.shiftBalancePenalty,
      metrics.totalAdjustments,
      metrics.twoByTwoPenalty,
      metrics.warningCount,
    ];
  }

  return [
    ...baseScore(metrics),
    metrics.totalAdjustments,
    metrics.maxFtReallocationsForOneEmployee,
    metrics.ftReallocationSquarePenalty,
    metrics.workloadSpread,
    metrics.shiftBalancePenalty,
    metrics.twoByTwoPenalty,
    metrics.warningCount,
  ];
}

export function compareScores(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function scheduleFingerprint(result: ScheduleResult): string {
  return result.rows
    .map((row) => `${row.employee.id}:${row.days.map((day) => `${day.kind}:${day.shift ?? ""}`).join(",")}`)
    .join("|");
}

export function cloneResultForAlternative(result: ScheduleResult): ScheduleResult {
  const { alternatives, optimizationSummary, selectedAlternativeId, ...plain } = result;
  void alternatives;
  void optimizationSummary;
  void selectedAlternativeId;
  return {
    ...plain,
    rows: plain.rows.map((row) => ({
      ...row,
      employee: { ...row.employee },
      days: row.days.map((day) => ({ ...day })),
    })),
    warnings: [...plain.warnings],
    violations: [...plain.violations],
    decisionLog: [...plain.decisionLog],
    perDay: plain.perDay.map((day) => ({
      ...day,
      A: [...day.A],
      INT: [...day.INT],
      B: [...day.B],
    })),
    metrics: plain.metrics ? cloneMetrics(plain.metrics) : undefined,
    debug: plain.debug
      ? {
          decisions: plain.debug.decisions.map((decision) => ({ ...decision })),
        }
      : undefined,
  };
}

export function cloneMetrics(metrics: ScheduleMetrics): ScheduleMetrics {
  return {
    ...metrics,
    ftReallocationDistribution: metrics.ftReallocationDistribution.map((entry) => ({ ...entry })),
  };
}

export function formatFtDistribution(
  distribution: ScheduleMetrics["ftReallocationDistribution"],
  employees: Employee[],
): string {
  if (distribution.length === 0) return "Sem FT por realocacao";
  const knownIds = new Set(distribution.map((entry) => entry.employeeId));
  const zeroExamples = employees
    .filter((employee) => !knownIds.has(employee.id) && (employee.role === "SUB" || employee.role === "OPE"))
    .slice(0, 2)
    .map((employee) => `${employee.name} 0`);
  return [...distribution.map((entry) => `${entry.employeeName} ${entry.count}`), ...zeroExamples].join(", ");
}

export function buildAlternative(
  attempt: { result: ScheduleResult; metrics: ScheduleMetrics; seed: number },
  profile: (typeof OPTIMIZATION_PROFILES)[number],
  id: string,
  duplicateOf?: string,
): ScheduleAlternative {
  const result = cloneResultForAlternative(attempt.result);
  const metrics = cloneMetrics(attempt.metrics);
  result.metrics = metrics;
  result.selectedAlternativeId = id;
  result.decisionLog = [
    `[OTIMIZAÇÃO] Perfil ${profile.label}; ajustes=${metrics.totalAdjustments}; maior FT por realocação=${metrics.maxFtReallocationsForOneEmployee}; carga=${metrics.workloadMin}-${metrics.workloadMax}.`,
    ...result.decisionLog,
  ];
  return {
    id,
    label: profile.label,
    description: duplicateOf ? `${profile.description} Tambem vencedora em outro perfil.` : profile.description,
    profile: profile.profile,
    duplicateOf,
    metrics,
    score: scoreSchedule(metrics, profile.profile),
    result,
  };
}
