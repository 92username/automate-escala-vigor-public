import { describe, expect, it } from "vitest";
import {
  VERTICAL_LEGEND_DICTIONARY,
  lookupLegendMeaning,
  matchLegendDictionaryEntry,
} from "../legend-dictionary";

describe("vertical legend dictionary", () => {
  it("matches exact legend codes", () => {
    expect(lookupLegendMeaning("F")).toBe("Férias");
    expect(lookupLegendMeaning("FT")).toBe("Folga Técnica");
    expect(lookupLegendMeaning("/AD")).toBe("Expediente Administrativo");
    expect(lookupLegendMeaning("CMA")).toBe("INSPSAU");
    expect(lookupLegendMeaning("DM")).toBe("Dispensa Médica");
    expect(lookupLegendMeaning("HE")).toBe("Hora Extra");
  });

  it("matches pattern-based legend codes", () => {
    expect(matchLegendDictionaryEntry("ft/x")).toEqual(
      expect.objectContaining({
        normalizedCode: "FT/X",
        entry: expect.objectContaining({
          kind: "pattern",
          meaning: "Folga Técnica",
        }),
      }),
    );
    expect(matchLegendDictionaryEntry("/ABC123")).toEqual(
      expect.objectContaining({
        normalizedCode: "/ABC123",
        entry: expect.objectContaining({
          kind: "pattern",
          meaning: "Curso",
        }),
      }),
    );
    expect(matchLegendDictionaryEntry("CMA/X")).toEqual(
      expect.objectContaining({
        entry: expect.objectContaining({
          kind: "pattern",
          meaning: "INSPSAU",
        }),
      }),
    );
    expect(matchLegendDictionaryEntry("DM/X")).toEqual(
      expect.objectContaining({
        entry: expect.objectContaining({
          kind: "pattern",
          meaning: "Dispensa Médica",
        }),
      }),
    );
    expect(matchLegendDictionaryEntry("ABC/HE")).toEqual(
      expect.objectContaining({
        entry: expect.objectContaining({
          kind: "pattern",
          meaning: "Hora Extra",
        }),
      }),
    );
  });

  it("matches real schedule codes observed in the operational CSV", () => {
    const examples = [
      ["?/A", "Designação pendente de turno"],
      ["?/B", "Designação pendente de turno"],
      ["?/INT", "Designação pendente de turno"],
      ["?/A/CMA", "Designação pendente de turno"],
      ["/A", "Anotação de turno"],
      ["/INT", "Anotação de turno"],
      ["/INT/TATIC", "Anotação de turno"],
      ["A+HE", "Hora Extra"],
      ["INT+HE", "Hora Extra"],
      ["TATIC", "TATIC"],
      ["TATIC/AD", "TATIC"],
      ["TATIC/HEFT/A", "TATIC"],
      ["A/DM/", "Turno A com Dispensa Médica"],
      ["/ATM11", "Curso"],
      ["/SEC002E", "Curso"],
      ["VOO", "Voo operacional"],
    ] as const;

    for (const [code, meaning] of examples) {
      expect(matchLegendDictionaryEntry(code)).toEqual(
        expect.objectContaining({
          input: code,
          normalizedCode: code,
          entry: expect.objectContaining({ meaning }),
        }),
      );
    }
  });

  it("returns undefined for unknown codes", () => {
    expect(matchLegendDictionaryEntry("XYZ")).toBeUndefined();
    expect(lookupLegendMeaning("XYZ")).toBeUndefined();
    expect(VERTICAL_LEGEND_DICTIONARY).toHaveLength(18);
  });
});
