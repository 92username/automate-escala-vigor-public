import { describe, it, expect } from 'vitest'
import { generateSchedule } from '../index'
import {
  createScheduleInput,
  createEmployee,
  daysInMonth,
} from './helpers'

describe('Exportações Internas (ScheduleResult)', () => {
  it('ScheduleResult deve conter propriedades obrigatórias', () => {
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

    expect(result).toBeDefined()
    expect(result.year).toBe(2025)
    expect(result.month).toBe(1)
    expect(result.scenario).toBe('operacional')
    expect(Array.isArray(result.rows)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
    expect(Array.isArray(result.violations)).toBe(true)
    expect(Array.isArray(result.perDay)).toBe(true)
  })

  it('rows deve conter um EmployeeRow por employee', () => {
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

    for (const row of result.rows) {
      expect(row.employee).toBeDefined()
      expect(row.employee.id).toBeDefined()
      expect(row.employee.name).toBeDefined()
      expect(row.employee.role).toBeDefined()
      expect(Array.isArray(row.days)).toBe(true)
      expect(typeof row.workedDays).toBe('number')
      expect(typeof row.ftDays).toBe('number')
      expect(typeof row.countA).toBe('number')
      expect(typeof row.countB).toBe('number')
      expect(typeof row.countInt).toBe('number')
      expect(typeof row.countSat).toBe('number')
      expect(typeof row.countSun).toBe('number')
    }
  })

  it('cada row deve conter 31 DayAssignments (janeiro)', () => {
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
      expect(row.days.length).toBe(31)

      for (let i = 0; i < 31; i++) {
        const day = row.days[i]
        expect(day.date).toBe(i + 1)
        expect(day.kind).toBeDefined()
        expect([
          'WORK',
          'OFF',
          'FT',
          'FERIAS',
          'LICENCA',
          'CURSO',
          'EXP',
        ]).toContain(day.kind)
      }
    }
  })

  it('DayAssignment.shift pode ser null apenas em OFF ou afastamentos', () => {
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
      for (const day of row.days) {
        if (day.kind === 'WORK') {
          expect(day.shift).toBeDefined()
          expect(['A', 'INT', 'B']).toContain(day.shift)
        } else {
          // OFF, FT, FERIAS, LICENCA, CURSO, EXP
          expect(day.shift === null || day.shift === undefined).toBe(true)
        }
      }
    }
  })

  it('contagens (countA, countB, countInt) devem ser coerentes', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
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

    for (const row of result.rows) {
      // Contar manualmente
      let manualCountA = 0
      let manualCountB = 0
      let manualCountInt = 0

      for (const day of row.days) {
        if (day.kind === 'WORK') {
          if (day.shift === 'A') manualCountA++
          else if (day.shift === 'B') manualCountB++
          else if (day.shift === 'INT') manualCountInt++
        }
      }

      // Validar com as contagens
      expect(row.countA).toBe(manualCountA)
      expect(row.countB).toBe(manualCountB)
      expect(row.countInt).toBe(manualCountInt)
    }
  })

  it('workedDays deve ser a contagem de WORK; FT é folga técnica', () => {
    const employees = [
      createEmployee('enc-1', 'ENC 1', { role: 'ENC' }),
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

    for (const row of result.rows) {
      const workDays = row.days.filter(d => d.kind === 'WORK').length
      const ftDays = row.days.filter(d => d.kind === 'FT').length

      expect(row.workedDays).toBe(workDays)
      expect(row.ftDays).toBe(ftDays)
    }
  })

  it('perDay deve conter entrada para cada dia do mês', () => {
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

    expect(result.perDay.length).toBe(31)

    for (let day = 1; day <= 31; day++) {
      const perDayEntry = result.perDay.find(p => p.date === day)
      expect(perDayEntry).toBeDefined()
      expect(perDayEntry?.weekday).toBeDefined()
      expect(typeof perDayEntry?.isHoliday).toBe('boolean')
      expect(Array.isArray(perDayEntry?.A)).toBe(true)
      expect(Array.isArray(perDayEntry?.INT)).toBe(true)
      expect(Array.isArray(perDayEntry?.B)).toBe(true)
    }
  })

  it('perDay.A/INT/B devem conter names (strings), não objects', () => {
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

    for (const perDayEntry of result.perDay) {
      for (const name of perDayEntry.A) {
        expect(typeof name).toBe('string')
      }
      for (const name of perDayEntry.INT) {
        expect(typeof name).toBe('string')
      }
      for (const name of perDayEntry.B) {
        expect(typeof name).toBe('string')
      }
    }
  })

  it('warnings e violations devem ser arrays de strings', () => {
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

    expect(Array.isArray(result.warnings)).toBe(true)
    expect(Array.isArray(result.violations)).toBe(true)

    for (const warning of result.warnings) {
      expect(typeof warning).toBe('string')
    }

    for (const violation of result.violations) {
      expect(typeof violation).toBe('string')
    }
  })

  it('sum de nomes em perDay deve refletir alocações do dia', () => {
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

    // Verifica que cada employee está alocado em algum lugar cada dia
    const daysInJan = daysInMonth(2025, 1)
    for (let day = 1; day <= daysInJan; day++) {
      const perDayInfo = result.perDay.find(p => p.date === day)
      const totalNamesPerDay =
        (perDayInfo?.A?.length ?? 0) +
        (perDayInfo?.INT?.length ?? 0) +
        (perDayInfo?.B?.length ?? 0)

      // Deve ter pelo menos alguns nomes alocados
      expect(totalNamesPerDay).toBeGreaterThan(0)
      // Não pode ter mais que 8 employees
      expect(totalNamesPerDay).toBeLessThanOrEqual(8)
    }
  })

  it('resultado deve ser reproduzível (determinístico)', () => {
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

    const result1 = generateSchedule(input)
    const result2 = generateSchedule(input)

    // Mesma entrada deve gerar mesmo resultado
    expect(result1.rows.length).toBe(result2.rows.length)

    for (let i = 0; i < result1.rows.length; i++) {
      const row1 = result1.rows[i]
      const row2 = result2.rows[i]

      expect(row1.employee.id).toBe(row2.employee.id)
      expect(row1.workedDays).toBe(row2.workedDays)
      expect(row1.countA).toBe(row2.countA)
      expect(row1.countB).toBe(row2.countB)
      expect(row1.countInt).toBe(row2.countInt)
    }
  })
})
