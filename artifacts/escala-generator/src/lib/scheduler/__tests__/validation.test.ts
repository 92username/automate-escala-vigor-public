import { describe, it, expect } from 'vitest'
import { generateSchedule } from '../index'
import { validateSchedule } from '../validation'
import {
  createAbsence,
  createScheduleInput,
  createEmployee,
  daysInMonth,
  assertHasWarning,
  assertHasViolation,
} from './helpers'

type ValidationShift = 'A' | 'INT' | 'B'

function buildValidationContext(options: {
  employees: ReturnType<typeof createEmployee>[]
  workedById?: Record<string, number>
  absences?: ReturnType<typeof createAbsence>[]
  dayAssignments: Record<number, Array<{ employeeId: string; shift: ValidationShift }>>
  daysCount?: number
}) {
  const daysCount = options.daysCount ?? 1
  const daysCtx = Array.from({ length: daysCount }, (_, index) => {
    const date = index + 1
    const assignments = new Map<string, ValidationShift>()
    for (const assignment of options.dayAssignments[date] ?? []) {
      assignments.set(assignment.employeeId, assignment.shift)
    }

    return {
      date,
      weekday: 1,
      isHoliday: false,
      assignments,
      ftSet: new Set<string>(),
      absences: new Map<string, 'ferias' | 'licenca' | 'curso'>(),
    }
  })

  const state = new Map<string, {
    worked: number
    ft: number
    countA: number
    countB: number
    countInt: number
    satSunOff: Set<number>
  }>()
  const absenceByEmployee = new Map<string, Map<number, 'ferias' | 'licenca' | 'curso'>>()

  for (const employee of options.employees) {
    state.set(employee.id, {
      worked: options.workedById?.[employee.id] ?? 14,
      ft: 0,
      countA: 0,
      countB: 0,
      countInt: 0,
      satSunOff: new Set<number>(),
    })
  }

  for (const absence of options.absences ?? []) {
    let inner = absenceByEmployee.get(absence.employeeId)
    if (!inner) {
      inner = new Map()
      absenceByEmployee.set(absence.employeeId, inner)
    }

    for (let day = absence.startDay; day <= absence.endDay; day++) {
      inner.set(day, absence.type)
      if (day >= 1 && day <= daysCount) {
        daysCtx[day - 1]?.absences.set(absence.employeeId, absence.type)
      }
    }
  }

  return {
    year: 2025,
    month: 1,
    scenario: 'operacional' as const,
    employees: options.employees,
    absences: options.absences ?? [],
    holidays: [],
    active: options.employees,
    daysCount,
    holidaySet: new Set<number>(),
    absenceInfo: { byEmployee: absenceByEmployee },
    daysCtx,
    state,
    startSlotById: new Map<string, number>(),
    debug: false,
    decisionLogs: [],
  }
}

describe('Validações Finais', () => {
  it('dias trabalhados deve estar entre 14 e 16', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
      createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
      createEmployee('ope-4', 'OPE 4', { role: 'OPE' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
    })

    const result = generateSchedule(input)

    // Cada employee deve ter trabalhado entre 14 e 16 dias
    for (const row of result.rows) {
      expect(row.workedDays).toBeGreaterThanOrEqual(14)
      expect(row.workedDays).toBeLessThanOrEqual(16)
    }
  })

  it('máximo de 1 ENC por turno por dia', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('enc-2', 'ENC 2', { role: 'ENC' }),
      createEmployee('sub-1', 'SUB 1', { role: 'SUB' }),
      createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
    })

    const result = generateSchedule(input)

    // Verifica cada dia e turno
    const daysInJan = daysInMonth(2025, 1)
    for (let day = 1; day <= daysInJan; day++) {
      const perDayInfo = result.perDay.find(p => p.date === day)
      if (perDayInfo) {
        const shifts = ['A', 'INT', 'B'] as const
        for (const shift of shifts) {
          const shiftNames = perDayInfo[shift]
          // Máximo 1 ENC por turno
          const encNames = shiftNames?.filter(name =>
            employees.find(e => e.id === 'enc-1' && e.name === name) ||
            employees.find(e => e.id === 'enc-2' && e.name === name)
          )
          expect(encNames?.length ?? 0).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('deve validar mínimo de pessoas por turno quando possível', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('enc-2', 'ENC 2', { role: 'ENC' }),
      createEmployee('sub-1', 'SUB 1', { role: 'SUB' }),
      createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
      createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
      createEmployee('ope-4', 'OPE 4', { role: 'OPE' }),
      createEmployee('ope-5', 'OPE 5', { role: 'OPE' }),
      createEmployee('ope-6', 'OPE 6', { role: 'OPE' }),
      createEmployee('ope-7', 'OPE 7', { role: 'OPE' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
    })

    const result = generateSchedule(input)

    // Com 10 employees (2 ENC, 1 SUB, 7 OPE), deve ser possível atingir mínimos
    const daysInJan = daysInMonth(2025, 1)
    let minA = 0,
      minInt = 0,
      minB = 0
    for (let day = 1; day <= daysInJan; day++) {
      const perDayInfo = result.perDay.find(p => p.date === day)
      if (perDayInfo) {
        minA += perDayInfo.A?.length ?? 0
        minInt += perDayInfo.INT?.length ?? 0
        minB += perDayInfo.B?.length ?? 0
      }
    }

    // Média deve estar dentro de esperado
    const avgA = minA / daysInJan
    const avgInt = minInt / daysInJan
    const avgB = minB / daysInJan

    // Com 10 employees, devemos ter médias respectáveis
    expect(avgA).toBeGreaterThan(0)
    expect(avgInt).toBeGreaterThan(0)
    expect(avgB).toBeGreaterThan(0)
  })

  it('deve validar presença de ENC/SUB em turnos críticos', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('enc-2', 'ENC 2', { role: 'ENC' }),
      createEmployee('sub-1', 'SUB 1', { role: 'SUB' }),
      createEmployee('sub-2', 'SUB 2', { role: 'SUB' }),
      createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
      createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
      createEmployee('ope-4', 'OPE 4', { role: 'OPE' }),
      createEmployee('ope-5', 'OPE 5', { role: 'OPE' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
    })

    const result = generateSchedule(input)

    // Com 2 ENC e 2 SUB, deve ser possível atingir boas coberturas
    const daysInJan = daysInMonth(2025, 1)
    let daysWithEncSubInA = 0
    let daysWithEncSubInB = 0

    for (let day = 1; day <= daysInJan; day++) {
      const perDayInfo = result.perDay.find(p => p.date === day)
      if (perDayInfo) {
        const aTeam = perDayInfo.A
        if (aTeam && aTeam.length > 0) {
          const hasEncOrSub = aTeam.some(name =>
            employees.find(
              e =>
                (e.role === 'ENC' || e.role === 'SUB') && e.name === name
            )
          )
          if (hasEncOrSub) daysWithEncSubInA++
        }

        const bTeam = perDayInfo.B
        if (bTeam && bTeam.length > 0) {
          const hasEncOrSub = bTeam.some(name =>
            employees.find(
              e =>
                (e.role === 'ENC' || e.role === 'SUB') && e.name === name
            )
          )
          if (hasEncOrSub) daysWithEncSubInB++
        }
      }
    }

    // Com 4 ENC/SUB e ciclos de trabalho, espera-se alta cobertura
    expect(daysWithEncSubInA).toBeGreaterThan(0)
    expect(daysWithEncSubInB).toBeGreaterThan(0)
  })

  it('ENC não pode estar em INT', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('enc-2', 'ENC 2', { role: 'ENC' }),
      createEmployee('sub-1', 'SUB 1', { role: 'SUB' }),
      createEmployee('sub-2', 'SUB 2', { role: 'SUB' }),
      createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
      createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
      createEmployee('ope-4', 'OPE 4', { role: 'OPE' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
    })

    const result = generateSchedule(input)

    // Verifica que ENC não está em INT
    const daysInJan = daysInMonth(2025, 1)
    for (let day = 1; day <= daysInJan; day++) {
      const perDayInfo = result.perDay.find(p => p.date === day)
      if (perDayInfo && perDayInfo.INT) {
        const intTeam = perDayInfo.INT
        const hasEnc = intTeam.some(name =>
          employees.find(e => e.role === 'ENC' && e.name === name)
        )
        expect(hasEnc).toBe(false)
      }
    }
  })

  it('mínimo de 14 dias de trabalho deve ser alcançado', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
      createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
      createEmployee('ope-4', 'OPE 4', { role: 'OPE' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
    })

    const result = generateSchedule(input)

    for (const row of result.rows) {
      expect(row.workedDays).toBeGreaterThanOrEqual(14)
    }
  })

  it('máximo de 16 dias de trabalho deve ser respeitado', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
      createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
      createEmployee('ope-4', 'OPE 4', { role: 'OPE' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
    })

    const result = generateSchedule(input)

    for (const row of result.rows) {
      expect(row.workedDays).toBeLessThanOrEqual(16)
    }
  })

  it('todos os employees devem aparecer no resultado', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('sub-1', 'SUB 1', { role: 'SUB' }),
      createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
      createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
    })

    const result = generateSchedule(input)

    expect(result.rows.length).toBe(employees.length)
    for (const employee of employees) {
      const found = result.rows.find(r => r.employee.id === employee.id)
      expect(found).toBeDefined()
    }
  })

  it('cada employee deve ter 31 dias de atribuição (janeiro)', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
    })

    const result = generateSchedule(input)

    for (const row of result.rows) {
      expect(row.days.length).toBe(31) // Janeiro tem 31 dias
    }
  })

  it('operador com afastamento e menos de 14 dias gera warning, não violation', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('enc-2', 'ENC 2', { role: 'ENC' }),
      createEmployee('sub-1', 'SUB 1', { role: 'SUB' }),
      createEmployee('ope-afastado', 'OPE Afastado', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
      createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
      createEmployee('ope-4', 'OPE 4', { role: 'OPE' }),
      createEmployee('ope-5', 'OPE 5', { role: 'OPE' }),
    ]

    const context = buildValidationContext({
      employees,
      workedById: {
        'enc-1': 14,
        'enc-2': 14,
        'sub-1': 14,
        'ope-afastado': 13,
        'ope-2': 14,
        'ope-3': 14,
        'ope-4': 14,
        'ope-5': 14,
      },
      absences: [createAbsence('ope-afastado', 'ferias', 17, 30)],
      dayAssignments: {
        1: [
          { employeeId: 'enc-1', shift: 'A' },
          { employeeId: 'ope-2', shift: 'A' },
          { employeeId: 'ope-3', shift: 'A' },
          { employeeId: 'ope-4', shift: 'INT' },
          { employeeId: 'ope-5', shift: 'INT' },
          { employeeId: 'sub-1', shift: 'B' },
          { employeeId: 'enc-2', shift: 'B' },
        ],
      },
    })

    const warnings: string[] = []
    const violations: string[] = []

    validateSchedule(context as any, warnings, violations)

    expect(warnings[0]).toContain('OPE Afastado: 13 dias trabalhados')
    expect(warnings[0]).toContain('(Férias: 17 a 30)')
    expect(assertHasViolation(violations, 'OPE Afastado: 13 dias trabalhados (mínimo 14).')).toBe(false)
  })

  it('operador sem afastamento e menos de 14 dias continua gerando violation', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      createEmployee('enc-2', 'ENC 2', { role: 'ENC' }),
      createEmployee('sub-1', 'SUB 1', { role: 'SUB' }),
      createEmployee('ope-sem-afastamento', 'OPE Sem Afastamento', { role: 'OPE' }),
      createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
      createEmployee('ope-3', 'OPE 3', { role: 'OPE' }),
      createEmployee('ope-4', 'OPE 4', { role: 'OPE' }),
      createEmployee('ope-5', 'OPE 5', { role: 'OPE' }),
    ]

    const context = buildValidationContext({
      employees,
      workedById: {
        'enc-1': 14,
        'enc-2': 14,
        'sub-1': 14,
        'ope-sem-afastamento': 13,
        'ope-2': 14,
        'ope-3': 14,
        'ope-4': 14,
        'ope-5': 14,
      },
      dayAssignments: {
        1: [
          { employeeId: 'enc-1', shift: 'A' },
          { employeeId: 'ope-2', shift: 'A' },
          { employeeId: 'ope-3', shift: 'A' },
          { employeeId: 'ope-4', shift: 'INT' },
          { employeeId: 'ope-5', shift: 'INT' },
          { employeeId: 'sub-1', shift: 'B' },
          { employeeId: 'enc-2', shift: 'B' },
        ],
      },
    })

    const warnings: string[] = []
    const violations: string[] = []

    validateSchedule(context as any, warnings, violations)

    expect(assertHasWarning(warnings, 'OPE Sem Afastamento')).toBe(false)
    expect(assertHasViolation(violations, 'OPE Sem Afastamento: 13 dias trabalhados (mínimo 14).')).toBe(true)
  })

  it('turno INT apenas com novatos não gera violation', () => {
    const employees = [
      createEmployee('enc-novato', 'ENC Novato', { role: 'ENC', novice: true }),
      createEmployee('sub-novato', 'SUB Novato', { role: 'SUB', novice: true }),
      createEmployee('ope-novato-1', 'OPE Novato 1', { role: 'OPE', novice: true }),
      createEmployee('ope-novato-2', 'OPE Novato 2', { role: 'OPE', novice: true }),
      createEmployee('ope-novato-3', 'OPE Novato 3', { role: 'OPE', novice: true }),
      createEmployee('ope-exp-1', 'OPE Experiente 1', { role: 'OPE' }),
      createEmployee('ope-exp-2', 'OPE Experiente 2', { role: 'OPE' }),
      createEmployee('ope-exp-3', 'OPE Experiente 3', { role: 'OPE' }),
    ]

    const context = buildValidationContext({
      employees,
      dayAssignments: {
        1: [
          { employeeId: 'enc-novato', shift: 'A' },
          { employeeId: 'ope-novato-1', shift: 'A' },
          { employeeId: 'ope-novato-2', shift: 'A' },
          { employeeId: 'ope-novato-3', shift: 'INT' },
          { employeeId: 'ope-exp-1', shift: 'INT' },
          { employeeId: 'ope-exp-2', shift: 'B' },
          { employeeId: 'sub-novato', shift: 'B' },
        ],
      },
    })

    const warnings: string[] = []
    const violations: string[] = []

    validateSchedule(context as any, warnings, violations)

    expect(assertHasViolation(violations, 'Dia 1 turno INT: equipe composta apenas por novatos.')).toBe(false)
  })

  it('turno A apenas com novatos gera violation', () => {
    const employees = [
      createEmployee('enc-novato', 'ENC Novato', { role: 'ENC', novice: true }),
      createEmployee('ope-novato-1', 'OPE Novato 1', { role: 'OPE', novice: true }),
      createEmployee('ope-novato-2', 'OPE Novato 2', { role: 'OPE', novice: true }),
      createEmployee('ope-exp-1', 'OPE Experiente 1', { role: 'OPE' }),
      createEmployee('ope-exp-2', 'OPE Experiente 2', { role: 'OPE' }),
      createEmployee('ope-exp-3', 'OPE Experiente 3', { role: 'OPE' }),
      createEmployee('ope-exp-4', 'OPE Experiente 4', { role: 'OPE' }),
    ]

    const context = buildValidationContext({
      employees,
      dayAssignments: {
        1: [
          { employeeId: 'enc-novato', shift: 'A' },
          { employeeId: 'ope-novato-1', shift: 'A' },
          { employeeId: 'ope-novato-2', shift: 'A' },
          { employeeId: 'ope-exp-1', shift: 'INT' },
          { employeeId: 'ope-exp-2', shift: 'INT' },
          { employeeId: 'ope-exp-3', shift: 'B' },
          { employeeId: 'ope-exp-4', shift: 'B' },
        ],
      },
    })

    const warnings: string[] = []
    const violations: string[] = []

    validateSchedule(context as any, warnings, violations)

    expect(assertHasViolation(violations, 'Dia 1 turno A: equipe composta apenas por novatos.')).toBe(true)
  })

  it('turno B apenas com novatos gera violation', () => {
    const employees = [
      createEmployee('sub-novato', 'SUB Novato', { role: 'SUB', novice: true }),
      createEmployee('ope-novato-1', 'OPE Novato 1', { role: 'OPE', novice: true }),
      createEmployee('ope-novato-2', 'OPE Novato 2', { role: 'OPE', novice: true }),
      createEmployee('ope-exp-1', 'OPE Experiente 1', { role: 'OPE' }),
      createEmployee('ope-exp-2', 'OPE Experiente 2', { role: 'OPE' }),
      createEmployee('ope-exp-3', 'OPE Experiente 3', { role: 'OPE' }),
      createEmployee('ope-exp-4', 'OPE Experiente 4', { role: 'OPE' }),
    ]

    const context = buildValidationContext({
      employees,
      dayAssignments: {
        1: [
          { employeeId: 'ope-exp-1', shift: 'A' },
          { employeeId: 'ope-exp-2', shift: 'A' },
          { employeeId: 'ope-exp-3', shift: 'A' },
          { employeeId: 'ope-exp-4', shift: 'INT' },
          { employeeId: 'ope-novato-1', shift: 'INT' },
          { employeeId: 'sub-novato', shift: 'B' },
          { employeeId: 'ope-novato-2', shift: 'B' },
        ],
      },
    })

    const warnings: string[] = []
    const violations: string[] = []

    validateSchedule(context as any, warnings, violations)

    expect(assertHasViolation(violations, 'Dia 1 turno B: equipe composta apenas por novatos.')).toBe(true)
  })
})
