import { describe, expect, it } from 'vitest'
import type { Employee, EmployeeRow, ScheduleResult, ShiftCode } from '../../types'
import { daysInMonth, weekdayOf } from '../../calendar'
import {
  applyCriticalDayReinforcement,
  validateTwoByTwoPatternForOperator,
} from '../critical-reinforcement'

function employee(id: string, name: string, role: Employee['role']): Employee {
  return { id, name, role }
}

function row(employee: Employee, year: number, month: number, workDays: Array<{ day: number; shift: ShiftCode }>): EmployeeRow {
  const days = Array.from({ length: daysInMonth(year, month) }, (_, index) => ({
    date: index + 1,
    kind: 'OFF' as const,
    shift: null,
  }))

  for (const workDay of workDays) {
    days[workDay.day - 1] = {
      date: workDay.day,
      kind: 'WORK',
      shift: workDay.shift,
    }
  }

  return {
    employee,
    days,
    workedDays: days.filter((day) => day.kind === 'WORK').length,
    ftDays: days.filter((day) => day.kind === 'FT').length,
    countA: days.filter((day) => day.kind === 'WORK' && day.shift === 'A').length,
    countB: days.filter((day) => day.kind === 'WORK' && day.shift === 'B').length,
    countInt: days.filter((day) => day.kind === 'WORK' && day.shift === 'INT').length,
    countSat: 0,
    countSun: 0,
  }
}

function buildPerDay(resultRows: EmployeeRow[], year: number, month: number, holidays: number[]): ScheduleResult['perDay'] {
  return Array.from({ length: daysInMonth(year, month) }, (_, index) => {
    const date = index + 1
    return {
      date,
      weekday: weekdayOf(year, month, date),
      isHoliday: holidays.includes(date),
      A: resultRows.filter((row) => row.days[index]?.kind === 'WORK' && row.days[index]?.shift === 'A').map((row) => row.employee.name),
      INT: resultRows.filter((row) => row.days[index]?.kind === 'WORK' && row.days[index]?.shift === 'INT').map((row) => row.employee.name),
      B: resultRows.filter((row) => row.days[index]?.kind === 'WORK' && row.days[index]?.shift === 'B').map((row) => row.employee.name),
    }
  })
}

describe('Reforço em dias críticos', () => {
  it('realoca excedente de dia normal para feriado e marca FT na origem', () => {
    const year = 2026
    const month = 3
    const holidays = [8]
    const enc = employee('enc-1', 'ENC 1', 'ENC')
    const ope1 = employee('ope-1', 'OPE 1', 'OPE')
    const ope2 = employee('ope-2', 'OPE 2', 'OPE')
    const marcos = employee('ope-marcos', 'Marcos', 'OPE')

    const rows = [
      row(enc, year, month, [{ day: 4, shift: 'A' }, { day: 8, shift: 'A' }]),
      row(marcos, year, month, [{ day: 4, shift: 'A' }]),
      row(ope1, year, month, [{ day: 4, shift: 'A' }, { day: 8, shift: 'A' }]),
      row(ope2, year, month, [{ day: 4, shift: 'A' }, { day: 8, shift: 'A' }]),
    ]

    const result: ScheduleResult = {
      year,
      month,
      scenario: 'operacional',
      status: 'gerada_ok',
      rows,
      warnings: [],
      violations: [],
      decisionLog: [],
      perDay: buildPerDay(rows, year, month, holidays),
    }

    applyCriticalDayReinforcement(result)

    const marcosRow = result.rows.find((item) => item.employee.id === marcos.id)!
    const encRow = result.rows.find((item) => item.employee.id === enc.id)!

    expect(marcosRow.days[3]).toMatchObject({ kind: 'FT', shift: null })
    expect(marcosRow.days[7]).toMatchObject({ kind: 'WORK', shift: 'A' })
    expect(encRow.days[3]).toMatchObject({ kind: 'WORK', shift: 'A' })
    expect(result.perDay[3]!.A).not.toContain('Marcos')
    expect(result.perDay[7]!.A).toContain('Marcos')
    expect(result.perDay[3]!.A).toHaveLength(3)
    expect(result.decisionLog.some((line) => line.includes('Reforço em dias críticos'))).toBe(true)
    expect(result.reinforcementLogText).toContain('[OK] Marcos')
  })

  it('rejeita realocação que criaria 3 dias consecutivos de trabalho', () => {
    const year = 2026
    const month = 3
    const marcos = employee('ope-marcos', 'Marcos', 'OPE')
    const marcosRow = row(marcos, year, month, [
      { day: 4, shift: 'A' },
      { day: 9, shift: 'A' },
      { day: 10, shift: 'A' },
    ])

    const validation = validateTwoByTwoPatternForOperator(marcosRow, 4, 8, 0)

    expect(validation.ok).toBe(false)
    expect(validation.reason).toContain('sequência de 3 dias trabalhados')
  })

  it('rejeita mais de uma realocação por operador no mês', () => {
    const year = 2026
    const month = 3
    const marcos = employee('ope-marcos', 'Marcos', 'OPE')
    const marcosRow = row(marcos, year, month, [{ day: 4, shift: 'A' }])

    const validation = validateTwoByTwoPatternForOperator(marcosRow, 4, 8, 1)

    expect(validation.ok).toBe(false)
    expect(validation.reason).toContain('uma realocação')
  })

  it('prioriza feriado informado pelo usuário antes de outros dias críticos', () => {
    const year = 2026
    const month = 3
    const holidays = [9]
    const enc = employee('enc-1', 'ENC 1', 'ENC')
    const ope1 = employee('ope-1', 'OPE 1', 'OPE')
    const ope2 = employee('ope-2', 'OPE 2', 'OPE')
    const marcos = employee('ope-marcos', 'Marcos', 'OPE')

    const rows = [
      row(enc, year, month, [{ day: 4, shift: 'A' }, { day: 9, shift: 'A' }]),
      row(marcos, year, month, [{ day: 4, shift: 'A' }]),
      row(ope1, year, month, [{ day: 4, shift: 'A' }, { day: 9, shift: 'A' }]),
      row(ope2, year, month, [{ day: 4, shift: 'A' }, { day: 9, shift: 'A' }]),
    ]
    const result: ScheduleResult = {
      year,
      month,
      scenario: 'operacional',
      status: 'gerada_ok',
      rows,
      warnings: [],
      violations: [],
      decisionLog: [],
      perDay: buildPerDay(rows, year, month, holidays),
    }

    applyCriticalDayReinforcement(result)

    const marcosRow = result.rows.find((item) => item.employee.id === marcos.id)!
    expect(marcosRow.days[3]).toMatchObject({ kind: 'FT', shift: null })
    expect(marcosRow.days[8]).toMatchObject({ kind: 'WORK', shift: 'A' })
    expect(result.perDay[8]!.A).toContain('Marcos')
    expect(result.reinforcementLogText).toContain('Destino: Dia 9 A')
  })

  it('não permite destino INT acima de 3 operadores', () => {
    const year = 2026
    const month = 3
    const holidays = [9]
    const int1 = employee('ope-int-1', 'INT 1', 'OPE')
    const int2 = employee('ope-int-2', 'INT 2', 'OPE')
    const int3 = employee('ope-int-3', 'INT 3', 'OPE')
    const marcos = employee('ope-marcos', 'Marcos', 'OPE')

    const rows = [
      row(int1, year, month, [{ day: 4, shift: 'INT' }, { day: 9, shift: 'INT' }]),
      row(int2, year, month, [{ day: 4, shift: 'INT' }, { day: 9, shift: 'INT' }]),
      row(int3, year, month, [{ day: 4, shift: 'INT' }, { day: 9, shift: 'INT' }]),
      row(marcos, year, month, [{ day: 4, shift: 'INT' }]),
    ]
    const result: ScheduleResult = {
      year,
      month,
      scenario: 'operacional',
      status: 'gerada_ok',
      rows,
      warnings: [],
      violations: [],
      decisionLog: [],
      perDay: buildPerDay(rows, year, month, holidays),
    }

    applyCriticalDayReinforcement(result)

    expect(result.perDay[8]!.INT).toHaveLength(3)
    expect(result.perDay[8]!.INT).not.toContain('Marcos')
  })
})
