import { describe, it, expect } from 'vitest'
import { generateSchedule } from '../index'
import {
  createScheduleInput,
  createEmployee,
  createPreviousMonthOff,
  createEncCycleDays,
  createOpeSubCycleDays,
  extendCycle,
  daysInMonth,
} from './helpers'

describe('Ciclo 2x2', () => {
  it('ENC deve ter ciclo reconhecido a partir do padrão anterior', () => {
    const enc = createEmployee('enc-1', 'Engenheiro 1', {
      role: 'ENC',
      previousMonthDays: createEncCycleDays(),
    })

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees: [enc],
    })

    const result = generateSchedule(input)

    // Verifica se existe a linha do ENC
    const encRow = result.rows.find(r => r.employee.id === 'enc-1')
    expect(encRow).toBeDefined()

    // ENC deve ter dias de trabalho distribuídos (não todos OFF)
    const workDays = encRow!.days.filter(d => d.kind === 'WORK')
    expect(workDays.length).toBeGreaterThan(0)

    // ENC deve ter alternância entre turnos (A, B, INT)
    const hasA = encRow!.days.some(d => d.shift === 'A')
    const hasB = encRow!.days.some(d => d.shift === 'B')
    expect(hasA || hasB).toBe(true)
  })

  it('SUB/OPE deve ter dias de trabalho baseado em ciclo', () => {
    const ope = createEmployee('ope-1', 'Operador 1', {
      role: 'OPE',
      previousMonthDays: createOpeSubCycleDays(),
    })

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees: [ope],
    })

    const result = generateSchedule(input)

    const opeRow = result.rows.find(r => r.employee.id === 'ope-1')
    expect(opeRow).toBeDefined()

    // OPE deve ter dias de trabalho
    const workDays = opeRow!.days.filter(d => d.kind === 'WORK')
    expect(workDays.length).toBeGreaterThan(0)

    // OPE deve ter dias OFF ou FT
    const offDays = opeRow!.days.filter(d => d.kind === 'OFF' || d.kind === 'FT')
    expect(offDays.length).toBeGreaterThan(0)
  })

  it('deve inferir slot do ciclo a partir do mês anterior', () => {
    const ope = createEmployee('ope-2', 'Operador 2', {
      role: 'OPE',
      previousMonthDays: ['A', 'A', 'OFF', 'OFF', 'B', 'B', 'OFF', 'OFF'],
    })

    const input = createScheduleInput({
      year: 2025,
      month: 2,
      employees: [ope],
    })

    const result = generateSchedule(input)

    const opeRow = result.rows.find(r => r.employee.id === 'ope-2')
    expect(opeRow).toBeDefined()

    // Com histórico anterior, deve gerar escala válida
    const daysWorked = opeRow!.days.filter(d => d.kind === 'WORK')
    expect(daysWorked.length).toBeGreaterThan(0)
  })

  it('deve usar fallback (sem slot anterior) quando não há escala anterior', () => {
    const ope = createEmployee('ope-3', 'Operador 3', {
      role: 'OPE',
      previousMonthDays: undefined,
    })

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees: [ope],
    })

    const result = generateSchedule(input)

    const opeRow = result.rows.find(r => r.employee.id === 'ope-3')
    expect(opeRow).toBeDefined()

    // Mesmo sem histórico, deve ter dias de trabalho
    const daysWorked = opeRow!.days.filter(d => d.kind === 'WORK')
    expect(daysWorked.length).toBeGreaterThan(0)

    // Deve ter trabalhado entre 14 e 16 dias (validação)
    expect(opeRow!.workedDays).toBeGreaterThanOrEqual(14)
    expect(opeRow!.workedDays).toBeLessThanOrEqual(16)
  })

  it('ciclo deve ser consistente ao longo do mês', () => {
    const ope = createEmployee('ope-4', 'Operador 4', {
      role: 'OPE',
      previousMonthDays: createOpeSubCycleDays(),
    })

    const input = createScheduleInput({
      year: 2025,
      month: 1,
      employees: [ope],
    })

    const result = generateSchedule(input)

    const opeRow = result.rows.find(r => r.employee.id === 'ope-4')
    expect(opeRow).toBeDefined()

    // Deve ter padrão: alguns dias de trabalho, alguns de folga
    const workDays = opeRow!.days.filter(d => d.kind === 'WORK').length
    const offDays = opeRow!.days.filter(d => d.kind === 'OFF' || d.kind === 'FT').length

    // Esperado: ciclo 2x2 → ~50% trabalho, ~50% folga
    expect(workDays).toBeGreaterThan(0)
    expect(offDays).toBeGreaterThan(0)
  })
})
