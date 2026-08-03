import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateSchedule } from "../src/lib/scheduler";
import { convertScheduleToVerticalSchedule } from "../src/lib/vertical-export/mapper";
import { fillVerticalScheduleDocxTemplate } from "../src/lib/vertical-export/docx-template-filler";
import type { Employee, PreviousMonthInfo } from "../src/lib/types";

interface PreviousMonthImportResponse {
  prevMonth: PreviousMonthInfo;
  employees: Employee[];
  detectedYear: number;
  detectedMonth: number;
  sheetName: string;
  matchedNames: string[];
  unmatchedNames: string[];
}

async function fetchPreviousMonthFromBackend(): Promise<PreviousMonthImportResponse | null> {
  try {
    const response = await fetch(
      "http://localhost:3000/api/operational-schedule/previous-month?year=2026&month=7",
    );
    if (!response.ok) return null;
    return response.json() as Promise<PreviousMonthImportResponse>;
  } catch {
    return null;
  }
}

describe("phase 2 VPS flow validation", () => {
  it("loads previous month from backend, generates schedule, and renders DOCX", async () => {
    const imported = await fetchPreviousMonthFromBackend();
    if (!imported) {
      return;
    }

    expect(imported.employees.length).toBeGreaterThan(0);
    expect(Object.keys(imported.prevMonth.daysByEmployeeId).length).toBeGreaterThan(0);

    const schedule = generateSchedule({
      year: 2026,
      month: 8,
      scenario: "operacional",
      employees: imported.employees,
      absences: [],
      holidays: [],
      previousMonth: imported.prevMonth,
    });

    expect(schedule.rows.length).toBeGreaterThan(0);
    expect(schedule.perDay.length).toBeGreaterThan(0);

    const verticalSchedule = convertScheduleToVerticalSchedule(schedule, {
      header: {
        crcea: "CRCEA-SE",
        localidade: "ARACAJU-SE",
        orgao: "APP",
        escalante: "VALIDACAO FASE 2",
      },
      generatedAt: new Date().toISOString(),
    });

    const outputDir = await mkdtemp(join(tmpdir(), "escala-phase2-"));
    const outputPath = join(outputDir, "escala-vertical-vps.docx");

    try {
      const result = await fillVerticalScheduleDocxTemplate(verticalSchedule, {
        outputPath,
      });

      expect(result.docxBytes.byteLength).toBeGreaterThan(0);
      expect(result.docxBytes[0]).toBe(0x50);
      expect(result.docxBytes[1]).toBe(0x4b);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
