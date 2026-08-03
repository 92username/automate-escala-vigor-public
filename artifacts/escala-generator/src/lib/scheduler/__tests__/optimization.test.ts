import { describe, expect, it } from 'vitest'
import type { ScheduleMetrics } from '../../types'
import { generateSchedule } from '../index'
import { compareScores, scoreSchedule } from '../optimization'
import { createEmployee, createScheduleInput } from './helpers'

function metrics(overrides: Partial<ScheduleMetrics>): ScheduleMetrics {
  return {
    totalAdjustments: 0,
    totalFtReallocations: 0,
    maxFtReallocationsForOneEmployee: 0,
    ftReallocationSquarePenalty: 0,
    ftReallocationDistribution: [],
    workloadMin: 15,
    workloadMax: 15,
    workloadSpread: 0,
    shiftBalancePenalty: 0,
    twoByTwoPenalty: 0,
    violationCount: 0,
    warningCount: 0,
    criticalWarningCount: 0,
    ...overrides,
  }
}

describe('Otimização de alternativas', () => {
  it('generateSchedule retorna alternativas renderizáveis e compatíveis', () => {
    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees: [
        createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
        createEmployee('sub-1', 'SUB 1', { role: 'SUB' }),
        createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
        createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
        createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
      ],
    })

    const result = generateSchedule(input, { optimizationAttempts: 4 })

    expect(result.rows.length).toBe(5)
    expect(result.alternatives?.length).toBe(3)
    expect(result.selectedAlternativeId).toBe('best_overall')
    for (const alternative of result.alternatives ?? []) {
      expect(alternative.result.rows.length).toBe(5)
      expect(alternative.metrics).toBeDefined()
      expect(Array.isArray(alternative.score)).toBe(true)
    }
  })

  it('alternativas são determinísticas para a mesma entrada', () => {
    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees: [
        createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
        createEmployee('sub-1', 'SUB 1', { role: 'SUB' }),
        createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
        createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
        createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
      ],
    })

    const first = generateSchedule(input, { optimizationAttempts: 6 })
    const second = generateSchedule(input, { optimizationAttempts: 6 })

    expect(first.alternatives?.map((alternative) => alternative.id)).toEqual(
      second.alternatives?.map((alternative) => alternative.id),
    )
    expect(first.alternatives?.map((alternative) => alternative.score)).toEqual(
      second.alternatives?.map((alternative) => alternative.score),
    )
  })

  it('menos ajustes vence no perfil Menos Ajustes', () => {
    const fewerAdjustments = metrics({ totalAdjustments: 1, twoByTwoPenalty: 2 })
    const moreAdjustments = metrics({ totalAdjustments: 3, twoByTwoPenalty: 6 })

    expect(
      compareScores(
        scoreSchedule(fewerAdjustments, 'fewest_adjustments'),
        scoreSchedule(moreAdjustments, 'fewest_adjustments'),
      ),
    ).toBeLessThan(0)
  })

  it('distribuição 1/1/1 vence concentração 3/0/0 quando o total de FT empata', () => {
    const concentrated = metrics({
      totalFtReallocations: 3,
      maxFtReallocationsForOneEmployee: 3,
      ftReallocationSquarePenalty: 9,
    })
    const distributed = metrics({
      totalFtReallocations: 3,
      maxFtReallocationsForOneEmployee: 1,
      ftReallocationSquarePenalty: 3,
    })

    expect(
      compareScores(
        scoreSchedule(distributed, 'most_balanced'),
        scoreSchedule(concentrated, 'most_balanced'),
      ),
    ).toBeLessThan(0)
  })

  it('violações críticas vencem qualquer melhoria estética', () => {
    const validButMessy = metrics({ totalAdjustments: 10, workloadSpread: 4 })
    const invalidButPretty = metrics({ violationCount: 1 })

    expect(
      compareScores(
        scoreSchedule(validButMessy, 'best_overall'),
        scoreSchedule(invalidButPretty, 'best_overall'),
      ),
    ).toBeLessThan(0)
  })
})
