import { describe, expect, it } from "vitest";
import {
  getDefaultVerticalCodeForOperator,
  normalizeOperatorName,
  normalizeVerticalCode,
} from "../vertical-operator-codes";

describe("vertical operator codes", () => {
  it("normalizes operator names by removing accents, case, punctuation, and extra spaces", () => {
    expect(normalizeOperatorName("  José   ")).toBe("JOSE");
  });

  it("returns official codes for short names", () => {
    expect(getDefaultVerticalCodeForOperator("Flavio")).toBe("A01");
    expect(getDefaultVerticalCodeForOperator("Octavio")).toBe("A02");
    expect(getDefaultVerticalCodeForOperator("Vinicius")).toBe("B06");
    expect(getDefaultVerticalCodeForOperator("Guilherme")).toBe("B07");
    expect(getDefaultVerticalCodeForOperator("Leandro")).toBe("C02");
  });

  it("returns official codes for common first-name variants", () => {
    expect(getDefaultVerticalCodeForOperator("Jose")).toBe("A03");
    expect(getDefaultVerticalCodeForOperator("Luis")).toBe("B06");
    expect(getDefaultVerticalCodeForOperator("Vinicius")).toBe("B06");
    expect(getDefaultVerticalCodeForOperator("Luiz")).toBe("B08");
  });

  it.each([
    ["FLAVIO", "A01"],
    ["FLAVIO A LIMA", "A01"],
    ["OCTAVIO", "A02"],
    ["OCTAVIO V F DE OLIVEIRA", "A02"],
    ["JOSE", "A03"],
    ["WILLIAM", "A04"],
    ["THIAGO", "A05"],
    ["CLAUDIUS", "A06"],
    ["ROGERIO", "A07"],
    ["BRUNO", "A08"],
    ["FABIO", "A09"],
    ["GILBERTO", "B01"],
    ["MEGRIVI", "B02"],
    ["ANTONIO", "B03"],
    ["IVAN", "B04"],
    ["GILSON", "B05"],
    ["VINICIUS", "B06"],
    ["GUILHERME", "B07"],
    ["LUIZ", "B08"],
    ["CARLOS", "C01"],
    ["LEANDRO", "C02"],
  ])("maps %s to %s", (name, code) => {
    expect(getDefaultVerticalCodeForOperator(name)).toBe(code);
  });

  it("normalizes edited vertical codes", () => {
    expect(normalizeVerticalCode(" b06 ")).toBe("B06");
  });
});
