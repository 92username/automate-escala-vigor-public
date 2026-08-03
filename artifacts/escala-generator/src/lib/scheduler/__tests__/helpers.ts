import type {
  Employee,
  ScheduleInput,
  AbsencePeriod,
  PreviousMonthInfo,
  PrevDayCode,
} from '../../types'

/**
 * Create a minimal employee for testing
 */
export function createEmployee(
  id: string,
  name: string,
  options?: {
    role?: 'ENC' | 'SUB' | 'OPE' | 'ESP' | 'ADM'
    novice?: boolean
    previousMonthDays?: PrevDayCode[]
  }
): Employee {
  return {
    id,
    name,
    role: options?.role ?? 'OPE',
    novice: options?.novice ?? false,
    previousMonthDays: options?.previousMonthDays,
  }
}

/**
 * Create a minimal schedule input for testing
 */
export function createScheduleInput(options?: {
  year?: number
  month?: number
  scenario?: 'operacional' | 'exp'
  employees?: Employee[]
  absences?: AbsencePeriod[]
  holidays?: number[]
  previousMonth?: PreviousMonthInfo
}): ScheduleInput {
  return {
    year: options?.year ?? 2025,
    month: options?.month ?? 1,
    scenario: options?.scenario ?? 'operacional',
    employees: options?.employees ?? [],
    absences: options?.absences ?? [],
    holidays: options?.holidays ?? [],
    previousMonth: options?.previousMonth,
  }
}

/**
 * Create an absence period for testing
 */
export function createAbsence(
  employeeId: string,
  type: 'ferias' | 'licenca' | 'curso',
  startDay: number,
  endDay: number
): AbsencePeriod {
  return {
    id: `${employeeId}-${type}-${startDay}-${endDay}`,
    employeeId,
    type,
    startDay,
    endDay,
  }
}

/**
 * Create a previous month info for testing (all OFF schedule)
 */
export function createPreviousMonthOff(year: number, month: number, daysInMonth: number): PreviousMonthInfo {
  const daysByEmployeeId: Record<string, PrevDayCode[]> = {}
  return {
    year,
    month,
    daysByEmployeeId,
  }
}

/**
 * Create a standard cycle pattern for an employee (ENC: AAFFBBFF)
 */
export function createEncCycleDays(): PrevDayCode[] {
  return ['A', 'A', 'OFF', 'OFF', 'B', 'B', 'OFF', 'OFF']
}

/**
 * Create a standard cycle pattern for SUB/OPE (WWFF = work work off off)
 */
export function createOpeSubCycleDays(): PrevDayCode[] {
  return ['A', 'A', 'OFF', 'OFF']
}

/**
 * Extend cycle to fill N days (repeating pattern)
 */
export function extendCycle(pattern: PrevDayCode[], targetLength: number): PrevDayCode[] {
  const result: PrevDayCode[] = []
  for (let i = 0; i < targetLength; i++) {
    result.push(pattern[i % pattern.length])
  }
  return result
}

/**
 * Assert that a violation is in the warnings list
 */
export function assertHasWarning(warnings: string[], substring: string): boolean {
  return warnings.some(w => w.includes(substring))
}

/**
 * Assert that a violation is in the violations list
 */
export function assertHasViolation(violations: string[], substring: string): boolean {
  return violations.some(v => v.includes(substring))
}

/**
 * Count assignments of a given shift for an employee in the result
 */
export function countShiftAssignments(
  employeeId: string,
  shift: 'A' | 'INT' | 'B',
  result: any
): number {
  const row = result.rows?.find((r: any) => r.employee.id === employeeId)
  if (!row) return 0

  return row.days?.filter(
    (d: any) => d.kind === 'WORK' && d.shift === shift
  ).length ?? 0
}

/**
 * Check if an employee has consecutive Sat+Sun off
 */
export function hasConsecutiveSatSunOff(
  employeeId: string,
  result: any
): boolean {
  const row = result.rows?.find((r: any) => r.employee.id === employeeId)
  if (!row) return false

  // Simple scan for consecutive OFF on Sat (6) and Sun (0)
  const perDay = result.perDay ?? []
  for (let i = 0; i < perDay.length - 1; i++) {
    const d1 = perDay[i]
    const d2 = perDay[i + 1]
    const isSatSun =
      (d1.weekday === 6 && d2.weekday === 0) ||
      (d1.weekday === 0 && d2.weekday === 6)
    if (isSatSun) {
      const a1 = row.days?.find((d: any) => d.date === d1.date)
      const a2 = row.days?.find((d: any) => d.date === d2.date)
      if (a1?.kind === 'OFF' && a2?.kind === 'OFF') {
        return true
      }
    }
  }
  return false
}

/**
 * Get assignments for an employee on a specific day
 */
export function getEmployeeAssignmentForDay(
  employeeId: string,
  day: number,
  result: any
): any {
  const row = result.rows?.find((r: any) => r.employee.id === employeeId)
  if (!row) return undefined
  return row.days?.find((d: any) => d.date === day)
}

/**
 * Count total days in a month (simple: 28 for Feb, 30 for Apr/Jun/Sep/Nov, 31 for others)
 */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return 28 + (year % 4 === 0 ? 1 : 0)
  if ([4, 6, 9, 11].includes(month)) return 30
  return 31
}
