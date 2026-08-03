import { describe, expect, it } from "vitest";
import { sampleVerticalSchedule } from "../sample";

describe("vertical export sample data", () => {
  it("provides a full 31-day sample schedule", () => {
    expect(sampleVerticalSchedule.section).toBe("monthlySummary");
    expect(sampleVerticalSchedule.header.monthYearLabel).toBe("JANEIRO/2026");
    expect(sampleVerticalSchedule.header.month).toBe(1);
    expect(sampleVerticalSchedule.header.year).toBe(2026);

    expect(sampleVerticalSchedule.daySchedule.days).toHaveLength(31);
    expect(sampleVerticalSchedule.daySchedule.shifts).toHaveLength(31);
    expect(sampleVerticalSchedule.daySchedule.offs).toHaveLength(31);

    expect(sampleVerticalSchedule.legend).toHaveLength(5);
    expect(sampleVerticalSchedule.observations).toHaveLength(3);

    expect(sampleVerticalSchedule.monthlySummary.totalDays).toBe(31);
    expect(sampleVerticalSchedule.monthlySummary.totalOperators).toBe(5);
    expect(sampleVerticalSchedule.monthlySummary.totalLegendEntries).toBe(5);
    expect(sampleVerticalSchedule.monthlySummary.totalObservations).toBe(3);
  });

  it("includes shift turns, rest codes, and legend entries", () => {
    const day1 = sampleVerticalSchedule.daySchedule.shifts.find((entry) => entry.day === 1);
    const day2 = sampleVerticalSchedule.daySchedule.shifts.find((entry) => entry.day === 2);
    const day3 = sampleVerticalSchedule.daySchedule.shifts.find((entry) => entry.day === 3);

    expect(day1?.shift).toBe("A");
    expect(day2?.shift).toBe("INT");
    expect(day3?.shift).toBe("B");

    const restDay5 = sampleVerticalSchedule.daySchedule.offs.find((entry) => entry.day === 5);
    expect(restDay5?.operatorCodes.length).toBeGreaterThan(0);
    expect(sampleVerticalSchedule.legend[0]?.code).toBe("A01");
  });
});
