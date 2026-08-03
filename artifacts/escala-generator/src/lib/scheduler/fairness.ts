import { isNovice } from "../employees";
import type { Employee, ShiftCode } from "../types";
import type { RowState, ScheduleContext } from "./context";
import { logDecision, seededTieBreak } from "./context";

type Candidate = { e: Employee; shifts: ShiftCode[] };

function allNovice(team: Employee[]): boolean {
  if (team.length === 0) return false;
  return team.every((e) => isNovice(e));
}

export function chooseBestCandidate(
  context: ScheduleContext,
  date: number,
  shift: ShiftCode,
  candidates: Candidate[],
  state: Map<string, RowState>,
): Employee | null {
  const ctx = context.daysCtx[date - 1]!;
  const eligible = candidates.filter(
    (c) => !ctx.assignments.has(c.e.id) && c.shifts.includes(shift),
  );
  if (eligible.length === 0) return null;

  const shiftRatio: Record<ShiftCode, number> = { A: 2, INT: 2, B: 1 };
  const ratio = shiftRatio[shift];

  eligible.sort((a, b) => {
    const sa = state.get(a.e.id)!;
    const sb = state.get(b.e.id)!;
    const team = context.active.filter((e) => ctx.assignments.get(e.id) === shift);
    const aWouldStillNovice = isNovice(a.e) && allNovice([...team, a.e]);
    const bWouldStillNovice = isNovice(b.e) && allNovice([...team, b.e]);
    if (aWouldStillNovice !== bWouldStillNovice) return aWouldStillNovice ? 1 : -1;

    const aShiftCount = shift === "A" ? sa.countA : shift === "B" ? sa.countB : sa.countInt;
    const bShiftCount = shift === "A" ? sb.countA : shift === "B" ? sb.countB : sb.countInt;
    const aImb = 5 * aShiftCount - ratio * sa.worked;
    const bImb = 5 * bShiftCount - ratio * sb.worked;
    if (aImb !== bImb) return aImb - bImb;

    if (sa.worked !== sb.worked) return sa.worked - sb.worked;
    if (aShiftCount !== bShiftCount) return aShiftCount - bShiftCount;
    return seededTieBreak(a.e.id, b.e.id, context.attemptSeed);
  });

  const picked = eligible[0]?.e ?? null;
  if (picked) {
    logDecision(
      context,
      date,
      shift,
      picked.id,
      "selected",
      `fairness: imbalance=${
        (5 * (shift === "A" ? state.get(picked.id)!.countA : shift === "B" ? state.get(picked.id)!.countB : state.get(picked.id)!.countInt) -
          ratio * state.get(picked.id)!.worked)
      }, worked=${state.get(picked.id)!.worked}`,
    );
  }
  return picked;
}
