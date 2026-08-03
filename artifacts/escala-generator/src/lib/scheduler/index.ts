import type { ScheduleInput, ScheduleResult } from "../types";
import { addDecisionLog, createScheduleContext, markCriticalIssue } from "./context";
import { fillEncAssignments, fillSubOpeAssignments } from "./assignment";
import { enforceWeekendOff } from "./weekend";
import { rebalanceCoverage } from "./rebalance";
import { validateSchedule } from "./validation";
import { buildResult } from "./result";
import { applyCriticalDayReinforcement } from "./critical-reinforcement";
import {
  buildAlternative,
  collectScheduleMetrics,
  compareScores,
  cloneMetrics,
  cloneResultForAlternative,
  formatFtDistribution,
  OPTIMIZATION_PROFILES,
  scheduleFingerprint,
  scoreSchedule,
} from "./optimization";

type GenerateOptions = {
  debug?: boolean;
  optimizationAttempts?: number;
};

type AttemptResult = {
  seed: number;
  result: ScheduleResult;
  metrics: NonNullable<ScheduleResult["metrics"]>;
  fingerprint: string;
};

function generateScheduleAttempt(
  input: ScheduleInput,
  options?: { debug?: boolean; attemptSeed?: number },
): AttemptResult {
  const context = createScheduleContext(input, { attemptSeed: options?.attemptSeed ?? 0 });
  context.debug = options?.debug ?? false;
  const warnings: string[] = [];
  const violations: string[] = [];

  addDecisionLog(context, "[INÍCIO] Geração da escala iniciada.");
  addDecisionLog(context, "[REGRAS] Mínimos operacionais e regras de sequência aplicados.");

  fillEncAssignments(context, warnings);
  fillSubOpeAssignments(context);
  enforceWeekendOff(context, violations);
  rebalanceCoverage(context, warnings);
  validateSchedule(context, warnings, violations);

  if (violations.length > 0) {
    markCriticalIssue(context, "Pendências graves encontradas durante a validação.");
  }

  const result = buildResult(context, warnings, violations);
  const metrics = collectScheduleMetrics(result, context);
  result.metrics = metrics;
  addDecisionLog(context, `[FIM] Escala gerada com status ${result.status}.`);

  const finalResult = {
    ...result,
    decisionLog: context.decisionLog,
    metrics,
  };

  return {
    seed: options?.attemptSeed ?? 0,
    result: finalResult,
    metrics,
    fingerprint: scheduleFingerprint(finalResult),
  };
}

function compareAttemptsForProfile(
  profile: (typeof OPTIMIZATION_PROFILES)[number]["profile"],
  a: AttemptResult,
  b: AttemptResult,
): number {
  const byScore = compareScores(scoreSchedule(a.metrics, profile), scoreSchedule(b.metrics, profile));
  if (byScore !== 0) return byScore;
  return a.seed - b.seed;
}

function selectAlternatives(attempts: AttemptResult[]): NonNullable<ScheduleResult["alternatives"]> {
  const usedFingerprints = new Map<string, string>();

  return OPTIMIZATION_PROFILES.map((profile) => {
    const ranked = attempts.slice().sort((a, b) => compareAttemptsForProfile(profile.profile, a, b));
    const fresh = ranked.find((attempt) => !usedFingerprints.has(attempt.fingerprint));
    const chosen = fresh ?? ranked[0]!;
    const duplicateOf = usedFingerprints.get(chosen.fingerprint);
    const id = profile.profile;
    if (!duplicateOf) usedFingerprints.set(chosen.fingerprint, id);
    return buildAlternative(chosen, profile, id, duplicateOf);
  });
}

export function generateSchedule(input: ScheduleInput, options?: GenerateOptions): ScheduleResult {
  const attemptsCount = Math.max(1, options?.optimizationAttempts ?? 48);
  const attempts: AttemptResult[] = [];

  for (let seed = 0; seed < attemptsCount; seed++) {
    attempts.push(generateScheduleAttempt(input, { debug: options?.debug, attemptSeed: seed }));
  }

  const alternatives = selectAlternatives(attempts);
  const selected = alternatives[0]!;
  const result = cloneResultForAlternative(selected.result);
  const metrics = cloneMetrics(selected.metrics);
  const optimizationSummary = {
    attempts: attemptsCount,
    profiles: alternatives.map((alternative) => ({
      profile: alternative.profile,
      label: alternative.label,
      selectedAlternativeId: alternative.id,
      duplicateOf: alternative.duplicateOf,
      score: [...alternative.score],
    })),
  };

  result.metrics = metrics;
  applyCriticalDayReinforcement(result);
  result.alternatives = alternatives.map((alternative) => {
    const alternativeResult = applyCriticalDayReinforcement(alternative.result);
    return {
      ...alternative,
      metrics: alternativeResult.metrics ?? alternative.metrics,
      result: alternativeResult,
    };
  });
  result.selectedAlternativeId = selected.id;
  result.optimizationSummary = optimizationSummary;
  result.decisionLog = [
    `[OTIMIZAÇÃO] ${attemptsCount} tentativa(s) avaliadas; perfil selecionado: ${selected.label}.`,
    `[OTIMIZAÇÃO] Ajustes=${metrics.totalAdjustments}; maior FT por realocação=${metrics.maxFtReallocationsForOneEmployee}; carga=${metrics.workloadMin}-${metrics.workloadMax}; FT=${formatFtDistribution(metrics.ftReallocationDistribution, input.employees)}.`,
    ...result.decisionLog,
  ];

  return result;
}
