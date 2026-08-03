import { describe, expect, it } from "vitest";
import { parseRealScheduleCsv } from "../real-schedule-parser";
import {
  convertRealScheduleParseResultToVerticalSchedule,
  formatVerticalOperatorName,
} from "../real-schedule-to-vertical";

function buildCsvRow(values: string[]): string {
  return values.join(";");
}

function buildFixtureCsv(): string {
  const rows = [
    buildCsvRow(["", "", "", "", "", "", "", ""]),
    buildCsvRow(["", "", "julho/2023", "", "", "agosto/2023", "", ""]),
    buildCsvRow(["", "", "qua", "qui", "sex", "sab", "dom", "seg"]),
    buildCsvRow(["", "", "01", "02", "03", "01", "02", "03"]),
    buildCsvRow(["", "7000001 - FLAVIO - JG00001", "A", "  DM  ", "FT/X", "/ABC123", "A/HE", "XYZ"]),
    buildCsvRow(["", "7000002 - LEANDRO", "INT", "B", "A", "", "", ""]),
  ];

  return `${rows.join("\n")}\n`;
}

function buildAutomaticObservationsFixtureCsv(): string {
  const totalColumns = 19;
  const blankRow = Array.from({ length: totalColumns }, () => "");
  const monthRow = [...blankRow];
  monthRow[2] = "maio/2026";
  const weekdayRow = ["", "", ...Array.from({ length: 17 }, () => "qui")];
  const dayRow = ["", "", ...Array.from({ length: 17 }, (_, index) => String(index + 1).padStart(2, "0"))];
  const rows = [
    blankRow,
    monthRow,
    weekdayRow,
    dayRow,
    ...Array.from({ length: 21 }, () => blankRow),
    ["", "100 - OPE FERIAS", "F", "F", "F", "", "A", "B", "INT", "", "", "", "", "", "", "", "", "", ""],
    ["", "101 - OPE ATM", "A", "B", "INT", "", "ATM11", " ATM11 ", "B", "ATM11", "", "", "", "", "", "", "", "", ""],
    ["", "102 - OPE DM", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "DM"],
    ["", "103 - OPE CEMAL", "CEMAL", "CMA", "CEMAL", "CMA", "CEMAL", "CEMAL", "CEMAL", "CEMAL", "CEMAL", "CEMAL", "CEMAL", "CEMAL", "CEMAL", "CEMAL", "CEMAL", "CEMAL", "CEMAL"],
    ["", "104 - APOIO UM", "A", "", "B", "INT", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "105 - APOIO DOIS", "", "A", "", "B", "INT", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "106 - OPE ESPECIAIS", "SEC002", "A", "DM", "B", "FO", "INT", "LTS", "", "LP", "A", "MISSÃO", "B", "TREINAMENTO", "", "CMA/HE", "", ""],
  ];

  return `${rows.map(buildCsvRow).join("\n")}\n`;
}

const header = {
  crcea: "CRCEA-SE",
  localidade: "ARACAJU",
  orgao: "APP",
  escalante: "ESCALANTE TESTE",
};

const matriculaPrefixPattern = /^\d[\d./]*(?:-\d[\d./]*)?\s*-\s*/;
const jgSuffixPattern = /\s*-\s*JG\d+\s*$/i;
const observationRegistry = [
  { code: "B02", name: "OPE FERIAS", group: "B" as const, active: true, status: "active" as const },
  { code: "A03", name: "OPE ATM", group: "A" as const, active: true, status: "active" as const },
  { code: "B04", name: "OPE DM", group: "B" as const, active: true, status: "active" as const },
  { code: "A08", name: "OPE CEMAL", group: "A" as const, active: true, status: "active" as const },
  { code: "C01", name: "APOIO UM", group: "C" as const, active: true, status: "active" as const },
  { code: "C02", name: "APOIO DOIS", group: "C" as const, active: true, status: "active" as const },
  { code: "B05", name: "OPE ESPECIAIS", group: "B" as const, active: true, status: "active" as const },
];

describe("convertRealScheduleParseResultToVerticalSchedule", () => {
  it("formats vertical operator names from raw spreadsheet labels", () => {
    expect(formatVerticalOperatorName("7000009 - ALFA BETA GAMMA")).toBe("ALFA B GAMMA");
    expect(formatVerticalOperatorName("OPERADOR TESTE DE CAMPO - JG16758")).toBe("OPERADOR T DE CAMPO");
    expect(formatVerticalOperatorName("  BRAVO   DE   TESTE   UM  ")).toBe("BRAVO DE T UM");
    expect(formatVerticalOperatorName("GAMMA DELTA E SIGMA")).toBe("GAMMA D E SIGMA");
    expect(formatVerticalOperatorName("OMEGA DE TESTE")).toBe("OMEGA DE TESTE");
    expect(formatVerticalOperatorName("PESSOA EXEMPLO DO REI")).toBe("PESSOA E DO REI");
    expect(formatVerticalOperatorName("NOME TESTE DAS DORES")).toBe("NOME T DAS DORES");
    expect(formatVerticalOperatorName("TEXTO EXEMPLO E AMOSTRA")).toBe("TEXTO E E AMOSTRA");
  });

  it("maps parser output into VerticalSchedule using registry operator codes", () => {
    const parsed = parseRealScheduleCsv(buildFixtureCsv(), { yearOverride: 2026 });
    const schedule = convertRealScheduleParseResultToVerticalSchedule(parsed, {
      header,
      generatedAt: "2026-06-28T12:00:00.000Z",
    });

    expect(schedule.section).toBe("monthlySummary");
    expect(schedule.header.month).toBe(7);
    expect(schedule.header.year).toBe(2026);
    expect(schedule.header.monthYearLabel).toBe("JULHO/2026");
    expect(schedule.daySchedule.days).toEqual([
      expect.objectContaining({ day: 1, weekday: 3, weekdayLabel: "QUA" }),
      expect.objectContaining({ day: 2, weekday: 4, weekdayLabel: "QUI" }),
      expect.objectContaining({ day: 3, weekday: 5, weekdayLabel: "SEX" }),
    ]);

    expect(schedule.legend).toEqual([
      expect.objectContaining({
        code: "A01",
        operator: "FLAVIO",
        role: "A",
        sourceOperatorLabel: "7000001 - FLAVIO - JG00001",
        source: "schedule",
        responsibility: "system",
      }),
      expect.objectContaining({
        code: "C02",
        operator: "LEANDRO",
        sourceOperatorLabel: "7000002 - LEANDRO",
      }),
    ]);
    for (const entry of schedule.legend) {
      expect(entry.operator.trim()).not.toBe("");
      expect(entry.operator).not.toMatch(matriculaPrefixPattern);
      expect(entry.operator).not.toMatch(jgSuffixPattern);
    }

    expect(schedule.daySchedule.shifts).toContainEqual({
      day: 1,
      shift: "A",
      operatorCodes: ["A01"],
    });
    expect(schedule.daySchedule.shifts).toContainEqual({
      day: 1,
      shift: "INT",
      operatorCodes: ["C02"],
    });
    expect(schedule.daySchedule.shifts).toContainEqual({
      day: 2,
      shift: "B",
      operatorCodes: ["C02"],
    });

    expect(schedule.daySchedule.offs).toContainEqual({
      day: 2,
      operatorCodes: ["A01"],
    });
    expect(schedule.daySchedule.offs).toContainEqual({
      day: 3,
      operatorCodes: ["A01"],
    });
    expect(schedule.monthlySummary).toEqual(
      expect.objectContaining({
        generatedAt: "2026-06-28T12:00:00.000Z",
        totalDays: 3,
        totalOperators: 2,
        totalLegendEntries: 2,
      }),
    );
  });

  it("preserves unknown operators, unknown codes, and raw source references as diagnostics", () => {
    const parsed = parseRealScheduleCsv(buildFixtureCsv(), { yearOverride: 2026 });
    const schedule = convertRealScheduleParseResultToVerticalSchedule(parsed, { header });

    expect(schedule.sourceReference).toEqual(
      expect.objectContaining({
        type: "real-schedule-csv",
        monthBlockIndex: 0,
        rawHeaderValue: "julho/2023",
        displayedYear: 2023,
        effectiveYear: 2026,
        yearOverride: 2026,
        columnStartIndex: 2,
        columnEndIndex: 5,
        headerRowIndex: 1,
        weekdayRowIndex: 2,
        dayRowIndex: 3,
      }),
    );

    expect(schedule.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "info",
        code: "UNKNOWN_CELL_CODE_OUTSIDE_SELECTED_MONTH",
        rowIndex: 4,
        columnIndex: 7,
        rawValue: "XYZ",
      }),
    );
    expect(schedule.diagnostics).not.toContainEqual(expect.objectContaining({ code: "UNMATCHED_OPERATOR" }));
  });

  it("uses temporary OP codes only for genuinely unknown operators and emits a warning", () => {
    const rows = [
      buildCsvRow(["", "", "", "", ""]),
      buildCsvRow(["", "", "maio/2026", "", ""]),
      buildCsvRow(["", "", "sex", "sab", "dom"]),
      buildCsvRow(["", "", "01", "02", "03"]),
      buildCsvRow(["", "999 - OPERADOR DESCONHECIDO", "A", "", "B"]),
    ];
    const parsed = parseRealScheduleCsv(`${rows.join("\n")}\n`);
    const schedule = convertRealScheduleParseResultToVerticalSchedule(parsed, { header });

    expect(schedule.legend).toEqual([
      expect.objectContaining({
        code: "OP01",
        operator: "OPERADOR DESCONHECIDO",
      }),
    ]);
    expect(schedule.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "UNMATCHED_OPERATOR",
        rawValue: "999 - OPERADOR DESCONHECIDO",
      }),
    );
  });

  it("generates automatic observations only from real operator rows", () => {
    const parsed = parseRealScheduleCsv(buildAutomaticObservationsFixtureCsv(), {
      operatorRegistry: observationRegistry,
    });
    const schedule = convertRealScheduleParseResultToVerticalSchedule(parsed, { header });
    const observationTexts = schedule.observations.map((entry) => entry.text);

    expect(schedule.legend.map((entry) => entry.code)).toEqual(["B02", "A03", "B04", "A08", "C01", "C02", "B05"]);
    expect(observationTexts).toEqual([
      "Dias 01 a 03 - OPE FERIAS - Férias",
      "Efetivo de Apoio: C01 e C02 - carga horária reduzida para manutenção de respectiva CHT, conforme item 5.3 da ICA 100-18/2020;",
      "Dias 05 a 06 - OPE ATM - ATM11",
      "Dia 08 - OPE ATM - ATM11",
      "Dia 17 - OPE DM - DM",
      "Dias 01 a 17 - OPE CEMAL - Inspeção de Saúde - CEMAL",
      "Dia 01 - OPE ESPECIAIS - SEC002",
      "Dia 03 - OPE ESPECIAIS - DM",
      "Dia 05 - OPE ESPECIAIS - FO",
      "Dia 07 - OPE ESPECIAIS - LTS",
      "Dia 09 - OPE ESPECIAIS - LP",
      "Dia 11 - OPE ESPECIAIS - MISSÃO",
      "Dia 13 - OPE ESPECIAIS - TREINAMENTO",
      "Dia 15 - OPE ESPECIAIS - Inspeção de Saúde - CEMAL",
    ]);
    expect(schedule.daySchedule.observations).toEqual([]);
    expect(observationTexts.join("\n")).not.toMatch(/\b- A$|\b- B$|\b- INT$/m);
    expect(observationTexts).toContain("Dia 01 - OPE ESPECIAIS - SEC002");
    expect(schedule.monthlySummary.totalOperators).toBe(7);
    expect(schedule.monthlySummary.totalObservations).toBe(14);
  });

  it("emits the support staff observation only when C01 or C02 have scheduled shifts", () => {
    const totalColumns = 5;
    const blankRow = Array.from({ length: totalColumns }, () => "");
    const rows = [
      blankRow,
      ["", "", "maio/2026", "", ""],
      ["", "", "sex", "sab", "dom"],
      ["", "", "01", "02", "03"],
      ["", "104 - APOIO UM", "F", "", "DM"],
      ["", "105 - APOIO DOIS", "", "", ""],
    ];
    const parsed = parseRealScheduleCsv(`${rows.map(buildCsvRow).join("\n")}\n`, {
      operatorRegistry: observationRegistry,
    });
    const schedule = convertRealScheduleParseResultToVerticalSchedule(parsed, { header });

    expect(schedule.legend.map((entry) => entry.code)).toEqual(["C01"]);
    expect(schedule.observations.map((entry) => entry.text)).toEqual([
      "Dia 01 - APOIO UM - Férias",
      "Dia 03 - APOIO UM - DM",
    ]);
  });
});
