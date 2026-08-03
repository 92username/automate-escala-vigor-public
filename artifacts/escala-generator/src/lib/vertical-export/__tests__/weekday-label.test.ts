import { describe, expect, it } from "vitest";
import { formatOfficialVerticalWeekdayLabel } from "../weekday-label";

describe("official vertical weekday label", () => {
  it("formats dynamically calculated weekdays in ICA uppercase Portuguese", () => {
    expect(formatOfficialVerticalWeekdayLabel(2026, 6, 6)).toBe("SÁB");
    expect(formatOfficialVerticalWeekdayLabel(2026, 6, 7)).toBe("DOM");
    expect(formatOfficialVerticalWeekdayLabel(2027, 2, 1)).toBe("SEG");
  });
});
