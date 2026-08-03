import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { daysInMonth, weekdayOf } from "../../calendar";
import type { DayAssignment, Employee, EmployeeRow, ScheduleResult, ShiftCode } from "../../types";
import { convertScheduleToVerticalSchedule } from "../mapper";
import { sampleVerticalSchedule } from "../sample";
import {
  DEFAULT_VERTICAL_SCHEDULE_DOCX_OUTPUT_PATH,
  fillVerticalScheduleDocxTemplate,
  ICA_VERTICAL_DOCX_TEMPLATE_ASSET_PATH,
  inspectVerticalScheduleDocxTemplate,
  loadOfficialIcaVerticalTemplateDocx,
} from "../docx-template-filler";

const workspaceRoot = join(process.cwd(), "..", "..");
const templatePath = join(workspaceRoot, ICA_VERTICAL_DOCX_TEMPLATE_ASSET_PATH);
const outputPath = join(workspaceRoot, DEFAULT_VERTICAL_SCHEDULE_DOCX_OUTPUT_PATH);

function assignment(day: number, shift: ShiftCode | null): DayAssignment {
  return {
    date: day,
    shift,
    kind: shift ? "WORK" : "OFF",
  };
}

function testEmployee(index: number, role: Employee["role"] = "OPE"): Employee {
  return {
    id: `${role.toLowerCase()}-${index}`,
    name: `${role} ${index}`,
    role,
    verticalCode: `Z${String(index).padStart(2, "0")}`,
  };
}

function testRow(employee: Employee, workedDays: number, totalDays: number): EmployeeRow {
  const days = Array.from({ length: totalDays }, (_, index) => assignment(index + 1, index < workedDays ? "A" : null));
  return {
    employee,
    days,
    workedDays: days.filter((day) => day.kind === "WORK").length,
    ftDays: days.filter((day) => day.kind === "FT").length,
    countA: days.filter((day) => day.shift === "A").length,
    countB: days.filter((day) => day.shift === "B").length,
    countInt: days.filter((day) => day.shift === "INT").length,
    countSat: 0,
    countSun: 0,
  };
}

function createHeaderCalculationScheduleFixture(): ScheduleResult {
  const year = 2026;
  const month = 5;
  const totalDays = daysInMonth(year, month);
  const regularRows = Array.from({ length: 17 }, (_, index) => testRow(testEmployee(index + 1), index < 7 ? 20 : 19, totalDays));
  const admRows = [testRow(testEmployee(18, "ADM"), 20, totalDays), testRow(testEmployee(19, "ADM"), 20, totalDays)];
  const rows = [...regularRows, ...admRows];

  return {
    year,
    month,
    scenario: "operacional",
    status: "gerada_ok",
    rows,
    warnings: [],
    violations: [],
    decisionLog: [],
    perDay: Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      return {
        date: day,
        weekday: weekdayOf(year, month, day),
        isHoliday: false,
        A: rows.filter((row) => row.days[index]?.kind === "WORK").map((row) => row.employee.name),
        INT: [],
        B: [],
      };
    }),
  };
}

async function loadOutputZip(): Promise<JSZip> {
  const outputBytes = await readFile(outputPath);
  return JSZip.loadAsync(outputBytes);
}

describe("vertical schedule DOCX template filler", () => {
  it("finds the exact ICA 63-33 clean DOCX template", async () => {
    const templateStats = await stat(templatePath);
    const templateBytes = await loadOfficialIcaVerticalTemplateDocx();

    expect(templateStats.isFile()).toBe(true);
    expect(templateStats.size).toBeGreaterThan(0);
    expect(templateBytes.byteLength).toBe(templateStats.size);
  });

  it("inspects the template table structure", async () => {
    const structure = await inspectVerticalScheduleDocxTemplate();

    expect(structure.hasDocumentXml).toBe(true);
    expect(structure.partCount).toBeGreaterThan(0);
    expect(structure.tableCount).toBe(2);
    expect(structure.tables[0]).toMatchObject({
      role: "header-schedule-legend",
      rowCount: 55,
      cellCount: 349,
    });
    expect(structure.tables[1]).toMatchObject({
      role: "observations-signatures",
      rowCount: 4,
      cellCount: 4,
    });
  });

  it("generates a non-empty editable DOCX with expected document parts", async () => {
    const result = await fillVerticalScheduleDocxTemplate(sampleVerticalSchedule);
    const outputStats = await stat(result.outputPath);

    expect(result.outputPath).toBe(outputPath);
    expect(result.docxBytes.byteLength).toBeGreaterThan(0);
    expect(outputStats.size).toBe(result.docxBytes.byteLength);
    expect(result.docxBytes[0]).toBe(0x50);
    expect(result.docxBytes[1]).toBe(0x4b);

    const zip = await loadOutputZip();
    expect(zip.file("[Content_Types].xml")).toBeTruthy();
    expect(zip.file("_rels/.rels")).toBeTruthy();
    expect(zip.file("word/document.xml")).toBeTruthy();
    expect(zip.file("word/_rels/document.xml.rels")).toBeTruthy();
    expect(zip.file("word/styles.xml")).toBeTruthy();
    expect(zip.file("word/settings.xml")).toBeTruthy();
  });

  it("generates a valid zip package with well-formed word/document.xml", async () => {
    const result = await fillVerticalScheduleDocxTemplate(sampleVerticalSchedule);
    const zip = await JSZip.loadAsync(result.docxBytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).toBeTruthy();
    expect(documentXml).toMatch(/^<\?xml[\s\S]*?<w:document\b[^>]*\bmc:Ignorable="[^"]+"/);
    expect(zip.file("[Content_Types].xml")).toBeTruthy();
    expect(zip.file("word/document.xml")).toBeTruthy();

    const dom = new JSDOM();
    const parsed = new dom.window.DOMParser().parseFromString(documentXml ?? "", "application/xml");
    const parserErrors = parsed.getElementsByTagName("parsererror");

    expect(parserErrors).toHaveLength(0);
  });

  it("fills safe header fields in the existing table", async () => {
    const result = await fillVerticalScheduleDocxTemplate(sampleVerticalSchedule);
    const zip = await loadOutputZip();
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(result.filledFields).toEqual(expect.arrayContaining([
      "header.crcea",
      "header.monthYear",
      "header.escalante",
      "header.localidade",
      "header.totalStaff",
      "header.scheduleStaff",
      "header.headOfOrg",
      "header.orgao",
      "header.monthlyAverageHours",
      "header.trainingHours",
      "header.headOfDivision",
    ]));
    expect(documentXml).toContain("CRCEA-SE");
    expect(documentXml).toContain("JANEIRO/2026");
    expect(documentXml).toContain("Cap João Silva");
    expect(documentXml).toContain("Manaus-AM");
    expect(documentXml).toContain("APP SBEG");
    expect(documentXml).toContain("144/152");
  });

  it("writes calculated effective staff and monthly hour average into document.xml", async () => {
    const schedule = convertScheduleToVerticalSchedule(createHeaderCalculationScheduleFixture(), {
      header: {
        crcea: "CRCEA-SE",
        localidade: "ARACAJU-SE",
        orgao: "APP",
        escalante: "A DEFINIR",
      },
    });

    expect(schedule.header.totalStaff).toBe(19);
    expect(schedule.header.scheduleStaff).toBe(17);
    expect(schedule.header.monthlyAverageHours).toBe("124 / 139");

    const result = await fillVerticalScheduleDocxTemplate(schedule);
    const zip = await JSZip.loadAsync(result.docxBytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(result.filledFields).toEqual(expect.arrayContaining([
      "header.totalStaff",
      "header.scheduleStaff",
      "header.monthlyAverageHours",
    ]));
    expect(documentXml).toContain(">19<");
    expect(documentXml).toContain(">17<");
    expect(documentXml).toContain("124 / 139");
  });

  it("fills daily schedule rows in the existing monthly table", async () => {
    const result = await fillVerticalScheduleDocxTemplate(sampleVerticalSchedule);
    const zip = await loadOutputZip();
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(result.filledFields).toEqual(expect.arrayContaining([
      "day.1.weekday",
      "day.1.shiftA",
      "day.1.off",
      "day.2.shiftINT",
      "day.3.shiftB",
      "day.3.observation",
    ]));
    expect(documentXml).toContain("QUI");
    expect(documentXml).toContain("A01");
    expect(documentXml).toContain("A02");
    expect(documentXml).toContain("A03");
    expect(documentXml).toContain("A05");
    expect(documentXml).toContain("Férias programadas para A02.");
  });

  it("fills legend code and operator rows in the existing legend area", async () => {
    const result = await fillVerticalScheduleDocxTemplate(sampleVerticalSchedule);
    const zip = await loadOutputZip();
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(result.filledFields).toEqual(expect.arrayContaining([
      "legend.0.code",
      "legend.0.operator",
      "legend.4.code",
      "legend.4.operator",
    ]));
    expect(documentXml).toContain("A01");
    expect(documentXml).toContain("Cap João Silva");
    expect(documentXml).toContain("A05");
    expect(documentXml).toContain("Op Bruno Alves");
  });

  it("fills numbered observations in the reserved observations area", async () => {
    const result = await fillVerticalScheduleDocxTemplate(sampleVerticalSchedule);
    const zip = await loadOutputZip();
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(result.filledFields).toEqual(expect.arrayContaining(["observations"]));
    expect(documentXml).toContain("1. Férias programadas para A02.");
    expect(documentXml).toContain("2. Instrução programada: 5 horas de CTR.");
    expect(documentXml).toContain("3. Escala vertical de exemplo para validação de layout e contrato de dados.");
  });
});
