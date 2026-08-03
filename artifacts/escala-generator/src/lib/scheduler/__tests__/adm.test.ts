import { describe, it, expect } from 'vitest'
import { generateSchedule } from '../index'
import { DEFAULT_EMPLOYEES } from '../../employees'
import { createEmployee, createScheduleInput } from './helpers'
import { weekdayOf } from '../../calendar'

describe('ADM / Expediente Administrativo', () => {
  it('Bruno deve existir em DEFAULT_EMPLOYEES abaixo de Rogerio e acima de Fabio', () => {
    const rogerioIndex = DEFAULT_EMPLOYEES.findIndex((employee) => employee.name === 'Rogerio')
    const brunoIndex = DEFAULT_EMPLOYEES.findIndex((employee) => employee.name === 'Bruno')
    const fabioIndex = DEFAULT_EMPLOYEES.findIndex((employee) => employee.name === 'Fabio')

    expect(rogerioIndex).toBeGreaterThanOrEqual(0)
    expect(brunoIndex).toBeGreaterThan(rogerioIndex)
    expect(fabioIndex).toBeGreaterThan(brunoIndex)
    expect(DEFAULT_EMPLOYEES[brunoIndex]?.role).toBe('ADM')
  })

  it('ADM trabalha em dias úteis e folga em fins de semana e feriados', () => {
    const employees = [
      createEmployee('adm-bruno', 'Bruno', { role: 'ADM' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      holidays: [1],
      employees,
    })

    const result = generateSchedule(input)
    const admRow = result.rows.find((row) => row.employee.id === 'adm-bruno')

    expect(admRow).toBeDefined()
    expect(admRow?.workedDays).toBe(0)

    for (const day of [1, 4, 5]) {
      const assignment = admRow?.days.find((entry) => entry.date === day)
      expect(assignment?.kind).toBe('OFF')
    }

    for (let day = 1; day <= 31; day++) {
      const assignment = admRow?.days.find((entry) => entry.date === day)
      if (!assignment) continue

      const weekday = weekdayOf(2025, 1, day)
      if (day === 1 || weekday === 0 || weekday === 6) {
        expect(assignment.kind).toBe('OFF')
      } else {
        expect(assignment.kind).toBe('EXP')
      }
    }
  })

  it('ADM não entra na cobertura operacional nem nas violações de mínimo', () => {
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
      createEmployee('adm-bruno', 'Bruno', { role: 'ADM' }),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
    })

    const result = generateSchedule(input)
    const admRow = result.rows.find((row) => row.employee.id === 'adm-bruno')

    expect(admRow).toBeDefined()
    expect(result.violations.some((violation) => violation.includes('Bruno'))).toBe(false)
    for (const day of result.perDay) {
      expect(day.A).not.toContain('Bruno')
      expect(day.INT).not.toContain('Bruno')
      expect(day.B).not.toContain('Bruno')
    }
  })

  it('generateSchedule continua funcionando sem depender de cenário exp', () => {
    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees: [
        createEmployee('adm-bruno', 'Bruno', { role: 'ADM' }),
        createEmployee('ope-1', 'OPE 1', { role: 'OPE' }),
        createEmployee('ope-2', 'OPE 2', { role: 'OPE' }),
        createEmployee('sub-1', 'SUB 1', { role: 'SUB' }),
        createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
      ],
    })

    const result = generateSchedule(input)

    expect(result.rows.some((row) => row.employee.role === 'ADM')).toBe(true)
    expect(result.rows.length).toBe(5)
    expect(result.warnings.length).toBeGreaterThanOrEqual(0)
    expect(result.violations.length).toBeGreaterThanOrEqual(0)
  })
})
