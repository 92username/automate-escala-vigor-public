import { describe, expect, it } from "vitest";
import { parseRealScheduleCsv } from "../real-schedule-parser";

function buildCsvRow(values: string[]): string {
  return values.join(";");
}

function buildFixtureCsv(): string {
  const rows = [
    buildCsvRow(["", "", "", "", "", "", "", ""]),
    buildCsvRow(["", "", "julho/2023", "", "", "agosto/2023", "", ""]),
    buildCsvRow(["", "", "qua", "qui", "sex", "sab", "dom", "seg"]),
    buildCsvRow(["", "", "01", "02", "03", "01", "02", "03"]),
    buildCsvRow(["", "7000001 - FLAVIO", "A", "  DM  ", "FT/X", "/ABC123", "A/HE", "XYZ"]),
    buildCsvRow(["", "7000002 - LEANDRO", "INT", "B", "A", "", "", ""]),
  ];

  return `${rows.join("\n")}\n`;
}

function buildDynamicOperatorRowsCsv(): string {
  const blank = ["", "", "", "", ""];
  const rows = [
    buildCsvRow(blank),
    buildCsvRow(["", "", "maio/2026", "", ""]),
    buildCsvRow(["", "", "qui", "sex", "sab"]),
    buildCsvRow(["", "", "01", "02", "03"]),
    buildCsvRow(["", "OPERADOR", "A", "B", "INT"]),
    buildCsvRow(["", "TOTAL", "1", "2", "3"]),
    ...Array.from({ length: 20 }, () => buildCsvRow(blank)),
    buildCsvRow(["", "100 - OPE DINAMICO UM", "A", "", "DM"]),
    buildCsvRow(["", "101 - OPE DINAMICO DOIS", "", "F", ""]),
    buildCsvRow(["", "OBSERVAÇÃO", "texto", "", ""]),
    ...Array.from({ length: 5 }, () => buildCsvRow(blank)),
    buildCsvRow(["", "102 - OPE DEPOIS DO FIM", "A", "A", "A"]),
  ];

  return `${rows.join("\n")}\n`;
}

function buildDynamicOperatorRowsCsvWithOperators(operatorRows: string[][]): string {
  const blank = ["", "", "", "", ""];
  const rows = [
    buildCsvRow(blank),
    buildCsvRow(["", "", "maio/2026", "", ""]),
    buildCsvRow(["", "", "qui", "sex", "sab"]),
    buildCsvRow(["", "", "01", "02", "03"]),
    ...operatorRows.map(buildCsvRow),
    ...Array.from({ length: 5 }, () => buildCsvRow(blank)),
  ];

  return `${rows.join("\n")}\n`;
}

describe("real schedule CSV parser", () => {
  it("parses month blocks, operators, and daily values from a CSV fixture", () => {
    const result = parseRealScheduleCsv(buildFixtureCsv(), { yearOverride: 2026 });

    expect(result.headerRowIndex).toBe(1);
    expect(result.weekdayRowIndex).toBe(2);
    expect(result.dayRowIndex).toBe(3);
    expect(result.monthHeaders).toHaveLength(2);
    expect(result.monthBlocks).toHaveLength(2);
    expect(result.selectedMonthBlock).toBeDefined();

    const firstHeader = result.monthHeaders[0];
    expect(firstHeader).toEqual(
      expect.objectContaining({
        columnIndex: 2,
        rawValue: "julho/2023",
        normalizedValue: "JULHO/2023",
        month: 7,
        monthName: "JULHO",
        displayedYear: 2023,
        effectiveYear: 2026,
      }),
    );

    const firstBlock = result.selectedMonthBlock;
    expect(firstBlock).toEqual(
      expect.objectContaining({
        blockIndex: 0,
        month: 7,
        monthName: "JULHO",
        displayedYear: 2023,
        effectiveYear: 2026,
        effectiveMonthYearLabel: "JULHO/2026",
      }),
    );
    expect(firstBlock?.dayColumns).toHaveLength(3);
    expect(firstBlock?.dayColumns[0]).toEqual(
      expect.objectContaining({
        columnIndex: 2,
        rawDayValue: "01",
        normalizedDayValue: "01",
        day: 1,
        rawWeekdayValue: "qua",
        normalizedWeekdayValue: "qua",
      }),
    );

    expect(firstBlock?.operatorRows).toHaveLength(2);
    expect(firstBlock?.operatorRows[0]).toEqual(
      expect.objectContaining({
        rowIndex: 4,
        rawLabel: "7000001 - FLAVIO",
        normalizedLabel: "FLAVIO",
        operatorCode: "A01",
      }),
    );
    expect(firstBlock?.operatorRows[0].cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rawValue: "A", normalizedValue: "A", kind: "shift" }),
        expect.objectContaining({
          rawValue: "  DM  ",
          normalizedValue: "DM",
          kind: "legend",
          legendMatch: expect.objectContaining({
            normalizedCode: "DM",
            entry: expect.objectContaining({ meaning: "Dispensa Médica" }),
          }),
        }),
        expect.objectContaining({
          rawValue: "FT/X",
          normalizedValue: "FT/X",
          kind: "legend",
          legendMatch: expect.objectContaining({
            normalizedCode: "FT/X",
          }),
        }),
      ]),
    );

    const secondOperator = firstBlock?.operatorRows[1];
    expect(secondOperator).toEqual(
      expect.objectContaining({
        rowIndex: 5,
        rawLabel: "7000002 - LEANDRO",
        normalizedLabel: "LEANDRO",
        operatorCode: "C02",
      }),
    );
    expect(secondOperator?.cells[0]).toEqual(
      expect.objectContaining({ rawValue: "INT", normalizedValue: "INT", kind: "shift" }),
    );
    expect(secondOperator?.cells[2]).toEqual(
      expect.objectContaining({ rawValue: "A", normalizedValue: "A", kind: "shift" }),
    );

    expect(result.unknownOperators).toEqual([]);
    expect(result.unknownCodes).toContainEqual(
      expect.objectContaining({
        blockIndex: 1,
        rowIndex: 4,
        columnIndex: 7,
        rawValue: "XYZ",
        normalizedValue: "XYZ",
      }),
    );
  });

  it("keeps the displayed year while applying the override to the primary block", () => {
    const result = parseRealScheduleCsv(buildFixtureCsv(), { yearOverride: 2026 });

    expect(result.monthHeaders[0]?.effectiveYear).toBe(2026);
    expect(result.monthHeaders[1]?.displayedYear).toBe(2023);
    expect(result.monthHeaders[1]?.effectiveYear).toBe(2023);
  });

  it("ignores month blocks outside selectedMonths", () => {
    const result = parseRealScheduleCsv(buildFixtureCsv(), {
      yearOverride: 2026,
      selectedMonths: [{ month: 7, year: 2026 }],
    });

    expect(result.monthHeaders).toHaveLength(2);
    expect(result.monthBlocks).toHaveLength(1);
    expect(result.selectedMonthBlock).toEqual(
      expect.objectContaining({
        blockIndex: 0,
        month: 7,
        effectiveYear: 2026,
      }),
    );
    expect(result.unknownCodes).not.toContainEqual(
      expect.objectContaining({
        blockIndex: 1,
        rawValue: "XYZ",
      }),
    );
  });

  it("detects operator rows dynamically below the day header without a fixed B5:B24 range", () => {
    const result = parseRealScheduleCsv(buildDynamicOperatorRowsCsv(), {
      yearOverride: 2026,
      selectedMonths: [5],
      operatorRegistry: [
        { code: "A01", name: "OPE DINAMICO UM", group: "A", active: true, status: "active" },
        { code: "A02", name: "OPE DINAMICO DOIS", group: "A", active: true, status: "active" },
        { code: "A03", name: "OPE DEPOIS DO FIM", group: "A", active: true, status: "active" },
      ],
    });

    expect(result.selectedMonthBlock?.dayColumns.map((column) => column.day)).toEqual([1, 2, 3]);
    expect(result.selectedMonthBlock?.operatorRows.map((row) => row.rawLabel)).toEqual([
      "100 - OPE DINAMICO UM",
      "101 - OPE DINAMICO DOIS",
    ]);
    expect(result.selectedMonthBlock?.operatorRows.map((row) => row.rowIndex)).toEqual([26, 27]);
    expect(result.selectedMonthBlock?.operatorRows.map((row) => row.operatorCode)).toEqual(["A01", "A02"]);
  });

  it("keeps detecting all real operators when a new operator is added after the old row 23", () => {
    const result = parseRealScheduleCsv(buildDynamicOperatorRowsCsv(), {
      yearOverride: 2026,
      selectedMonths: [5],
      operatorRegistry: [
        { code: "A01", name: "OPE DINAMICO UM", group: "A", active: true, status: "active" },
        { code: "A02", name: "OPE DINAMICO DOIS", group: "A", active: true, status: "active" },
      ],
    });

    expect(result.selectedMonthBlock?.operatorRows.map((row) => row.rawLabel)).toEqual([
      "100 - OPE DINAMICO UM",
      "101 - OPE DINAMICO DOIS",
    ]);
  });

  it("continues parsing when an operator is removed from the operational schedule", () => {
    const result = parseRealScheduleCsv(
      buildDynamicOperatorRowsCsvWithOperators([["", "100 - OPE DINAMICO UM", "A", "", "DM"]]),
      {
        yearOverride: 2026,
        selectedMonths: [5],
        operatorRegistry: [
          { code: "A01", name: "OPE DINAMICO UM", group: "A", active: true, status: "active" },
          { code: "A02", name: "OPE DINAMICO DOIS", group: "A", active: true, status: "active" },
        ],
      },
    );

    expect(result.selectedMonthBlock?.operatorRows.map((row) => row.rawLabel)).toEqual(["100 - OPE DINAMICO UM"]);
    expect(result.selectedMonthBlock?.operatorRows.map((row) => row.operatorCode)).toEqual(["A01"]);
  });

  it("reduces unknown code diagnostics when selected month boundaries are configured", () => {
    const unrestricted = parseRealScheduleCsv(buildFixtureCsv(), { yearOverride: 2026 });
    const bounded = parseRealScheduleCsv(buildFixtureCsv(), {
      yearOverride: 2026,
      selectedMonths: [7],
    });

    expect(unrestricted.unknownCodes).toHaveLength(1);
    expect(bounded.unknownCodes).toHaveLength(0);
  });
});
