import { daysInMonth } from "./calendar";
import type { Employee, PrevDayCode, PreviousMonthInfo } from "./types";

const ENC_PATTERN: Array<"A" | "B" | "X"> = ["A", "A", "X", "X", "B", "B", "X", "X"];
const SUB_OPE_PATTERN: Array<"W" | "X"> = ["W", "W", "X", "X"];

/**
 * Infer the cycle slot of day 1 of the current month for an employee, given
 * the previous month's day-by-day status.
 *
 * - For ENC: returns slot in 0..7 (8-day cycle A A X X B B X X)
 * - For SUB/OPE: returns slot in 0..3 (4-day cycle W W X X)
 * - For ESP/ADM: returns 0 (not applicable)
 */
export function inferCycleSlotForDay1(
  employee: Employee,
  prevMonth: PreviousMonthInfo | undefined,
  fallbackSlot: number,
): number {
  if (employee.role !== "ENC" && employee.role !== "SUB" && employee.role !== "OPE") {
    return 0;
  }
  const prevDays = prevMonth?.daysByEmployeeId[employee.id] ?? employee.previousMonthDays;
  if (!prevDays || prevDays.length === 0) {
    return fallbackSlot;
  }
  if (employee.role === "ENC") {
    return inferEncSlot(prevDays, prevMonth ? prevMonth.month : null, fallbackSlot);
  }
  return inferSubOpeSlot(prevDays, fallbackSlot);
}

function inferSubOpeSlot(prev: PrevDayCode[], fallbackSlot: number): number {
  // Try every alignment a in 0..3 (slot of day 1 of prev month), score each.
  // Then for day 1 of new month, position = (a + prev.length) mod 4.
  let best = { score: -1, align: fallbackSlot };
  for (let a = 0; a < 4; a++) {
    let score = 0;
    for (let i = 0; i < prev.length; i++) {
      const code = prev[i]!;
      const slot = (a + i) % 4;
      const expected = SUB_OPE_PATTERN[slot]!; // W or X
      const isWork = code === "A" || code === "B" || code === "INT";
      const isOff = code === "OFF" || code === "FT";
      // Absence (ABS) is ignored for scoring (cycle continues underneath but we don't know).
      if (code === "ABS") continue;
      if ((expected === "W" && isWork) || (expected === "X" && isOff)) {
        score += 1;
      } else if ((expected === "W" && isOff) || (expected === "X" && isWork)) {
        // Penalize mismatches less when FT (which can replace work) is involved
        if (code === "FT" && expected === "W") {
          // FT replaces a work day → still consistent
          score += 1;
        } else {
          score -= 1;
        }
      }
    }
    if (score > best.score) best = { score, align: a };
  }
  return ((best.align + prev.length) % 4 + 4) % 4;
}

function inferEncSlot(
  prev: PrevDayCode[],
  _prevMonth: number | null,
  fallbackSlot: number,
): number {
  let best = { score: -1, align: fallbackSlot };
  for (let a = 0; a < 8; a++) {
    let score = 0;
    for (let i = 0; i < prev.length; i++) {
      const code = prev[i]!;
      const slot = (a + i) % 8;
      const expected = ENC_PATTERN[slot]!; // A, B, or X
      if (code === "ABS") continue;
      if (code === "INT") {
        // ENC never on INT; skip neutral
        continue;
      }
      if (expected === "A") {
        if (code === "A") score += 2;
        else if (code === "FT") score += 1;
        else if (code === "OFF" || code === "B") score -= 2;
      } else if (expected === "B") {
        if (code === "B") score += 2;
        else if (code === "FT") score += 1;
        else if (code === "OFF" || code === "A") score -= 2;
      } else {
        // X
        if (code === "OFF") score += 2;
        else if (code === "A" || code === "B") score -= 2;
        else if (code === "FT") score -= 1;
      }
    }
    if (score > best.score) best = { score, align: a };
  }
  return ((best.align + prev.length) % 8 + 8) % 8;
}

/**
 * Build a default fallback cycle slot for each role so the team is staggered
 * when no previous-month data is provided.
 */
export function defaultFallbackSlot(employee: Employee, indexInRole: number): number {
  if (employee.role === "ENC") {
    // Spread 4 ENCs across positions 0, 4, 2, 6 to avoid same-shift conflicts.
    const map = [0, 4, 2, 6];
    return map[indexInRole % 4]!;
  }
  if (employee.role === "SUB" || employee.role === "OPE") {
    // Spread across 0..3 to roughly balance work and off across the team.
    return indexInRole % 4;
  }
  return 0;
}

/**
 * Quickly compute prev-month length given a PreviousMonthInfo.
 */
export function prevMonthLength(prev: PreviousMonthInfo | undefined): number {
  if (!prev) return 0;
  return daysInMonth(prev.year, prev.month);
}
