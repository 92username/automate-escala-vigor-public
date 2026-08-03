import { describe, expect, it } from "vitest";
import { convertScheduleToVerticalSchedule } from "../mapper";
import { createVerticalScheduleFixture } from "../fixtures";

describe("convertScheduleToVerticalSchedule mapper", () => {
  it("maps a generated schedule into a full VerticalSchedule", () => {
    const result = convertScheduleToVerticalSchedule(createVerticalScheduleFixture(), {
      header: {
        crcea: "CRCEA-SE",
        localidade: "Manaus-AM",
        orgao: "APP SBEG",
        escalante: "Cap João Silva",
        monthlyAverageHours: "144/152",
        trainingHours: "5h",
        headOfOrg: "Maj Pedro Souza",
        headOfDivision: "Ten Cel Carlos Lima",
      },
      generatedAt: "2026-01-01T12:00:00.000Z",
      notes: ["Exemplo convertido do schedule horizontal."],
    });

    expect(result.header.crcea).toBe("CRCEA-SE");
    expect(result.header.month).toBe(1);
    expect(result.header.year).toBe(2026);
    expect(result.header.monthYearLabel).toBe("JANEIRO/2026");
    expect(result.header.totalStaff).toBe(4);
    expect(result.header.scheduleStaff).toBe(4);

    expect(result.daySchedule.days).toHaveLength(31);
    expect(result.daySchedule.shifts).toHaveLength(93);
    expect(result.daySchedule.offs).toHaveLength(31);
    expect(result.legend).toHaveLength(4);

    const firstDay = result.daySchedule.shifts.filter((entry) => entry.day === 1);
    expect(firstDay.map((entry) => entry.shift)).toEqual(["A", "INT", "B"]);
    expect(firstDay.every((entry) => Array.isArray(entry.operatorCodes))).toBe(true);

    const firstOff = result.daySchedule.offs[0];
    expect(firstOff?.operatorCodes.length).toBeGreaterThan(0);

    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.monthlySummary.totalDays).toBe(31);
    expect(result.monthlySummary.totalOperators).toBe(4);
    expect(result.monthlySummary.totalLegendEntries).toBe(4);
    expect(result.monthlySummary.totalObservations).toBe(result.observations.length);
    expect(result.sourceSchedule?.rows.length).toBe(4);
  });

  it("uses the provided header config rather than scheduler internals", () => {
    const result = convertScheduleToVerticalSchedule(createVerticalScheduleFixture(), {
      header: {
        crcea: "CRCEA-XX",
        localidade: "Testville-TS",
        orgao: "TEST UNIT",
        escalante: "Ten Teste",
      },
    });

    expect(result.header.crcea).toBe("CRCEA-XX");
    expect(result.header.localidade).toBe("Testville-TS");
    expect(result.header.orgao).toBe("TEST UNIT");
    expect(result.header.escalante).toBe("Ten Teste");
  });

  it("uses edited verticalCode before official defaults", () => {
    const fixture = createVerticalScheduleFixture();
    fixture.rows[0]!.employee = {
      ...fixture.rows[0]!.employee,
      name: "Flavio",
      verticalCode: "Z99",
    };

    const result = convertScheduleToVerticalSchedule(fixture, {
      header: {
        crcea: "CRCEA-SE",
        localidade: "Aracaju-SE",
        orgao: "APP",
        escalante: "Teste",
      },
    });

    expect(result.legend.map((entry) => entry.code)).toContain("Z99");
    expect(result.daySchedule.shifts.some((entry) => entry.operatorCodes.includes("Z99"))).toBe(true);
  });

  it("uses official default code when verticalCode is absent", () => {
    const fixture = createVerticalScheduleFixture();
    fixture.rows[0]!.employee = {
      ...fixture.rows[0]!.employee,
      name: "Guilherme",
      verticalCode: undefined,
    };

    const result = convertScheduleToVerticalSchedule(fixture, {
      header: {
        crcea: "CRCEA-SE",
        localidade: "Aracaju-SE",
        orgao: "APP",
        escalante: "Teste",
      },
    });

    expect(result.legend.map((entry) => entry.code)).toContain("B07");
  });

  it("orders legend entries by official team prefixes A, B, and C", () => {
    const fixture = createVerticalScheduleFixture();
    fixture.rows[0]!.employee = { ...fixture.rows[0]!.employee, name: "Leandro", verticalCode: undefined };
    fixture.rows[1]!.employee = { ...fixture.rows[1]!.employee, name: "Flavio", verticalCode: undefined };
    fixture.rows[2]!.employee = { ...fixture.rows[2]!.employee, name: "Gilberto", verticalCode: undefined };
    fixture.rows[3]!.employee = { ...fixture.rows[3]!.employee, name: "Operador Extra", verticalCode: "Z99" };

    const result = convertScheduleToVerticalSchedule(fixture, {
      header: {
        crcea: "CRCEA-SE",
        localidade: "Aracaju-SE",
        orgao: "APP",
        escalante: "Teste",
      },
    });

    expect(result.legend.map((entry) => entry.code)).toEqual(["A01", "B01", "C02", "Z99"]);
  });
});
