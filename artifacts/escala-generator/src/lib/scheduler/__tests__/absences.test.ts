import { describe, it, expect } from 'vitest'
import { generateSchedule } from '../index'
import {
  createScheduleInput,
  createEmployee,
  createAbsence,
  getEmployeeAssignmentForDay,
} from './helpers'

describe('Afastamentos (Absences)', () => {
  it('férias deve impedir alocação no período especificado', () => {
    const employees = [
      createEmployee('ope-1', 'Operador 1', { role: 'OPE' }),
      createEmployee('ope-2', 'Operador 2', { role: 'OPE' }),
      createEmployee('ope-3', 'Operador 3', { role: 'OPE' }),
      createEmployee('ope-4', 'Operador 4', { role: 'OPE' }),
      createEmployee('ope-5', 'Operador 5', { role: 'OPE' }),
    ]

    const absences = [
      createAbsence('ope-1', 'ferias', 5, 12), // Férias do dia 5 ao 12
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
      absences,
    })

    const result = generateSchedule(input)

    const opeRow = result.rows.find(r => r.employee.id === 'ope-1')
    expect(opeRow).toBeDefined()

    // Durante as férias (dias 5-12), o employee não deve estar alocado para trabalho
    for (let day = 5; day <= 12; day++) {
      const assignment = getEmployeeAssignmentForDay('ope-1', day, result)
      expect(assignment).toBeDefined()
      expect(assignment?.kind).toBe('FERIAS')
    }
  })

  it('licença deve impedir alocação no período especificado', () => {
    const employees = [
      createEmployee('ope-1', 'Operador 1', { role: 'OPE' }),
      createEmployee('ope-2', 'Operador 2', { role: 'OPE' }),
      createEmployee('ope-3', 'Operador 3', { role: 'OPE' }),
      createEmployee('ope-4', 'Operador 4', { role: 'OPE' }),
      createEmployee('ope-5', 'Operador 5', { role: 'OPE' }),
    ]

    const absences = [
      createAbsence('ope-2', 'licenca', 8, 10), // Licença do dia 8 ao 10
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
      absences,
    })

    const result = generateSchedule(input)

    const opeRow = result.rows.find(r => r.employee.id === 'ope-2')
    expect(opeRow).toBeDefined()

    // Durante a licença (dias 8-10), o employee não deve estar alocado para trabalho
    for (let day = 8; day <= 10; day++) {
      const assignment = getEmployeeAssignmentForDay('ope-2', day, result)
      expect(assignment).toBeDefined()
      expect(assignment?.kind).toBe('LICENCA')
    }
  })

  it('curso deve impedir alocação no período especificado', () => {
    const employees = [
      createEmployee('ope-1', 'Operador 1', { role: 'OPE' }),
      createEmployee('ope-2', 'Operador 2', { role: 'OPE' }),
      createEmployee('ope-3', 'Operador 3', { role: 'OPE' }),
      createEmployee('ope-4', 'Operador 4', { role: 'OPE' }),
      createEmployee('ope-5', 'Operador 5', { role: 'OPE' }),
    ]

    const absences = [
      createAbsence('ope-3', 'curso', 15, 18), // Curso do dia 15 ao 18
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
      absences,
    })

    const result = generateSchedule(input)

    const opeRow = result.rows.find(r => r.employee.id === 'ope-3')
    expect(opeRow).toBeDefined()

    // Durante o curso (dias 15-18), o employee não deve estar alocado para trabalho
    for (let day = 15; day <= 18; day++) {
      const assignment = getEmployeeAssignmentForDay('ope-3', day, result)
      expect(assignment).toBeDefined()
      expect(assignment?.kind).toBe('CURSO')
    }
  })

  it('múltiplos afastamentos de um mesmo employee devem ser respeitados', () => {
    const employees = [
      createEmployee('ope-1', 'Operador 1', { role: 'OPE' }),
      createEmployee('ope-2', 'Operador 2', { role: 'OPE' }),
      createEmployee('ope-3', 'Operador 3', { role: 'OPE' }),
      createEmployee('ope-4', 'Operador 4', { role: 'OPE' }),
      createEmployee('ope-5', 'Operador 5', { role: 'OPE' }),
    ]

    const absences = [
      createAbsence('ope-1', 'ferias', 3, 5),
      createAbsence('ope-1', 'licenca', 10, 12),
      createAbsence('ope-1', 'curso', 20, 22),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
      absences,
    })

    const result = generateSchedule(input)

    const opeRow = result.rows.find(r => r.employee.id === 'ope-1')
    expect(opeRow).toBeDefined()

    // Verifica cada período de afastamento
    const absencePeriods = [
      { start: 3, end: 5, type: 'FERIAS' },
      { start: 10, end: 12, type: 'LICENCA' },
      { start: 20, end: 22, type: 'CURSO' },
    ]

    for (const period of absencePeriods) {
      for (let day = period.start; day <= period.end; day++) {
        const assignment = getEmployeeAssignmentForDay('ope-1', day, result)
        expect(assignment?.kind).toBe(period.type)
      }
    }
  })

  it('afastamentos de diferentes employees devem ser independentes', () => {
    const employees = [
      createEmployee('ope-1', 'Operador 1', { role: 'OPE' }),
      createEmployee('ope-2', 'Operador 2', { role: 'OPE' }),
      createEmployee('ope-3', 'Operador 3', { role: 'OPE' }),
      createEmployee('ope-4', 'Operador 4', { role: 'OPE' }),
      createEmployee('ope-5', 'Operador 5', { role: 'OPE' }),
    ]

    const absences = [
      createAbsence('ope-1', 'ferias', 5, 10),
      createAbsence('ope-2', 'licenca', 8, 15),
      createAbsence('ope-3', 'curso', 12, 18),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
      absences,
    })

    const result = generateSchedule(input)

    // Verifica que cada employee é marcado como afastado apenas nos dias corretos
    for (let day = 5; day <= 18; day++) {
      const a1 = getEmployeeAssignmentForDay('ope-1', day, result)
      const a2 = getEmployeeAssignmentForDay('ope-2', day, result)
      const a3 = getEmployeeAssignmentForDay('ope-3', day, result)

      if (day >= 5 && day <= 10) {
        expect(a1?.kind).toBe('FERIAS')
      }
      if (day >= 8 && day <= 15) {
        expect(a2?.kind).toBe('LICENCA')
      }
      if (day >= 12 && day <= 18) {
        expect(a3?.kind).toBe('CURSO')
      }
    }
  })

  it('employee em afastamento não deve trabalhar dia algum do período', () => {
    const employees = [
      createEmployee('ope-1', 'Operador 1', { role: 'OPE' }),
      createEmployee('ope-2', 'Operador 2', { role: 'OPE' }),
      createEmployee('ope-3', 'Operador 3', { role: 'OPE' }),
      createEmployee('ope-4', 'Operador 4', { role: 'OPE' }),
      createEmployee('ope-5', 'Operador 5', { role: 'OPE' }),
    ]

    const absences = [
      createAbsence('ope-1', 'ferias', 7, 14),
    ]

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees,
      absences,
    })

    const result = generateSchedule(input)

    const opeRow = result.rows.find(r => r.employee.id === 'ope-1')
    expect(opeRow).toBeDefined()

    // Nenhum dia entre 7 e 14 deve ter WORK ou FT
    for (let day = 7; day <= 14; day++) {
      const assignment = getEmployeeAssignmentForDay('ope-1', day, result)
      expect(['WORK', 'FT']).not.toContain(assignment?.kind)
    }
  })
})
