import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import type { VerticalSchedule } from "./models";

export const ICA_VERTICAL_DOCX_TEMPLATE_ASSET_PATH =
  "assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx";

export const DEFAULT_VERTICAL_SCHEDULE_DOCX_OUTPUT_PATH =
  "artifacts/escala-generator/tmp/vertical-schedule-filled.docx";

const DOCUMENT_XML_PATH = "word/document.xml";

export interface VerticalDocxTemplateTableSummary {
  tableIndex: number;
  role: "header-schedule-legend" | "observations-signatures" | "unknown";
  rowCount: number;
  cellCount: number;
  firstRows: string[][];
}

export interface VerticalDocxTemplateStructureSummary {
  partCount: number;
  hasDocumentXml: boolean;
  tableCount: number;
  tables: VerticalDocxTemplateTableSummary[];
}

export interface FillVerticalScheduleDocxTemplateOptions {
  templatePath?: string;
  outputPath?: string;
}

export interface FillVerticalScheduleDocxTemplateResult {
  docxBytes: Uint8Array;
  outputPath: string;
  structure: VerticalDocxTemplateStructureSummary;
  filledFields: string[];
}

interface WorkspacePaths {
  root: string;
  templatePath: string;
}

interface XmlRange {
  start: number;
  end: number;
  xml: string;
}

interface TableRange extends XmlRange {
  rows: RowRange[];
}

interface RowRange extends XmlRange {
  cells: XmlRange[];
}

async function resolveWorkspacePaths(templatePath = ICA_VERTICAL_DOCX_TEMPLATE_ASSET_PATH): Promise<WorkspacePaths> {
  const cwd = process.cwd();
  const candidates = [
    { root: cwd, templatePath: join(cwd, templatePath) },
    { root: join(cwd, "..", ".."), templatePath: join(cwd, "..", "..", templatePath) },
    { root: join(cwd, "..", "..", ".."), templatePath: join(cwd, "..", "..", "..", templatePath) },
  ];

  for (const candidate of candidates) {
    try {
      await readFile(candidate.templatePath);
      return candidate;
    } catch {
      // Try the next workspace-relative candidate.
    }
  }

  throw new Error(`ICA vertical DOCX template not found: ${templatePath}`);
}

function resolveOutputPath(root: string, outputPath = DEFAULT_VERTICAL_SCHEDULE_DOCX_OUTPUT_PATH): string {
  if (outputPath.startsWith("/")) return outputPath;
  return join(root, outputPath);
}

function xmlText(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function textFromXml(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => stripXml(match[1] ?? ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function findXmlRanges(xml: string, regex: RegExp): XmlRange[] {
  return [...xml.matchAll(regex)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    xml: match[0],
  }));
}

function parseRows(table: XmlRange): RowRange[] {
  return findXmlRanges(table.xml, /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g).map((row) => ({
    ...row,
    cells: findXmlRanges(row.xml, /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g).map((cell) => ({
      ...cell,
      start: row.start + cell.start,
      end: row.start + cell.end,
    })),
  }));
}

function parseTables(documentXml: string): TableRange[] {
  return findXmlRanges(documentXml, /<w:tbl[\s\S]*?<\/w:tbl>/g).map((table) => ({
    ...table,
    rows: parseRows(table),
  }));
}

function summarizeTable(table: TableRange, tableIndex: number): VerticalDocxTemplateTableSummary {
  const firstRows = table.rows.slice(0, 14).map((row) => row.cells.map((cell) => textFromXml(cell.xml)));
  const allText = textFromXml(table.xml);
  const role = allText.includes("DIA DO MÊS") && allText.includes("LEGENDA")
    ? "header-schedule-legend"
    : allText.includes("ESPAÇO RESERVADO PARA OBSERVAÇÕES")
      ? "observations-signatures"
      : "unknown";

  return {
    tableIndex,
    role,
    rowCount: table.rows.length,
    cellCount: table.rows.reduce((total, row) => total + row.cells.length, 0),
    firstRows,
  };
}

async function loadTemplateZip(templatePath?: string): Promise<{ zip: JSZip; paths: WorkspacePaths }> {
  const paths = await resolveWorkspacePaths(templatePath);
  const bytes = await readFile(paths.templatePath);
  return {
    zip: await JSZip.loadAsync(bytes),
    paths,
  };
}

async function loadDocumentXml(zip: JSZip): Promise<string> {
  const documentXml = zip.file(DOCUMENT_XML_PATH);
  if (!documentXml) {
    throw new Error(`DOCX template is missing ${DOCUMENT_XML_PATH}`);
  }
  return documentXml.async("string");
}

export async function loadOfficialIcaVerticalTemplateDocx(): Promise<Uint8Array> {
  const { paths } = await loadTemplateZip();
  return readFile(paths.templatePath);
}

export async function inspectVerticalScheduleDocxTemplate(
  templatePath?: string,
): Promise<VerticalDocxTemplateStructureSummary> {
  const { zip } = await loadTemplateZip(templatePath);
  const documentXml = await loadDocumentXml(zip);
  const tables = parseTables(documentXml);

  return {
    partCount: Object.keys(zip.files).length,
    hasDocumentXml: true,
    tableCount: tables.length,
    tables: tables.map((table, index) => summarizeTable(table, index)),
  };
}

function buildParagraph(text: string, bold = false): string {
  const boldXml = bold ? "<w:b/>" : "";
  return [
    "<w:p>",
    "<w:pPr><w:pStyle w:val=\"TableParagraph\"/><w:jc w:val=\"center\"/></w:pPr>",
    `<w:r><w:rPr>${boldXml}<w:sz w:val="12"/></w:rPr><w:t>${xmlText(text)}</w:t></w:r>`,
    "</w:p>",
  ].join("");
}

function buildLeftParagraph(text: string): string {
  return [
    "<w:p>",
    "<w:pPr><w:pStyle w:val=\"TableParagraph\"/><w:spacing w:after=\"0\"/><w:jc w:val=\"left\"/></w:pPr>",
    `<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>${xmlText(text)}</w:t></w:r>`,
    "</w:p>",
  ].join("");
}

function replaceCellWithLabelAndValue(cellXml: string, value: string): string {
  const openMatch = cellXml.match(/^<w:tc(?:\s[^>]*)?>/);
  const propertiesMatch = cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/);
  const label = textFromXml(cellXml);

  if (!openMatch || !propertiesMatch || !label || !value) return cellXml;

  return [
    openMatch[0],
    propertiesMatch[0],
    buildParagraph(label, true),
    buildParagraph(value),
    "</w:tc>",
  ].join("");
}

function replaceCellText(cellXml: string, value: string): string {
  const openMatch = cellXml.match(/^<w:tc(?:\s[^>]*)?>/);
  const propertiesMatch = cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/);

  if (!openMatch || !propertiesMatch) return cellXml;

  return [
    openMatch[0],
    propertiesMatch[0],
    value ? buildParagraph(value) : buildParagraph(""),
    "</w:tc>",
  ].join("");
}

function replaceCellWithLines(cellXml: string, lines: string[]): string {
  const openMatch = cellXml.match(/^<w:tc(?:\s[^>]*)?>/);
  const propertiesMatch = cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/);

  if (!openMatch || !propertiesMatch) return cellXml;

  return [
    openMatch[0],
    propertiesMatch[0],
    ...(lines.length > 0 ? lines.map(buildLeftParagraph) : [buildLeftParagraph("")]),
    "</w:tc>",
  ].join("");
}

function replaceRange(source: string, range: XmlRange, replacement: string): string {
  return `${source.slice(0, range.start)}${replacement}${source.slice(range.end)}`;
}

type CellReplacement = {
  range: XmlRange;
  field: string;
  xml: string;
};

function findMainTable(documentXml: string): TableRange | undefined {
  const tables = parseTables(documentXml);
  return tables.find((table) => summarizeTable(table, 0).role === "header-schedule-legend");
}

function findObservationsTable(documentXml: string): TableRange | undefined {
  const tables = parseTables(documentXml);
  return tables.find((table) => summarizeTable(table, 0).role === "observations-signatures");
}

function scheduleShiftText(schedule: VerticalSchedule, day: number, shift: "A" | "INT" | "B"): string {
  return schedule.daySchedule.shifts
    .filter((entry) => entry.day === day && entry.shift === shift)
    .flatMap((entry) => entry.operatorCodes)
    .join(" ");
}

function scheduleOffText(schedule: VerticalSchedule, day: number): string {
  return schedule.daySchedule.offs
    .filter((entry) => entry.day === day)
    .flatMap((entry) => entry.operatorCodes)
    .join(" ");
}

function scheduleObservationText(schedule: VerticalSchedule, day: number): string {
  return schedule.daySchedule.observations
    .filter((entry) => entry.day === day)
    .map((entry) => `${entry.label}: ${entry.text}`)
    .join("\n");
}

function buildHeaderReplacements(table: TableRange, schedule: VerticalSchedule): CellReplacement[] {
  const header = schedule.header;
  const values: Array<{ row: number; cell: number; field: string; value: string }> = [
    { row: 0, cell: 0, field: "header.crcea", value: header.crcea },
    { row: 0, cell: 1, field: "header.monthYear", value: header.monthYearLabel },
    { row: 0, cell: 2, field: "header.escalante", value: header.escalante },
    { row: 1, cell: 0, field: "header.localidade", value: header.localidade },
    { row: 1, cell: 1, field: "header.totalStaff", value: String(header.totalStaff) },
    { row: 1, cell: 2, field: "header.scheduleStaff", value: String(header.scheduleStaff) },
    { row: 1, cell: 3, field: "header.headOfOrg", value: header.headOfOrg ?? "" },
    { row: 2, cell: 0, field: "header.orgao", value: header.orgao },
    { row: 2, cell: 1, field: "header.monthlyAverageHours", value: String(header.monthlyAverageHours ?? "") },
    { row: 2, cell: 2, field: "header.trainingHours", value: String(header.trainingHours ?? "") },
    { row: 2, cell: 3, field: "header.headOfDivision", value: header.headOfDivision ?? "" },
  ];

  return values
    .map((entry) => {
      const row = table.rows[entry.row];
      const cell = row?.cells[entry.cell];
      if (!cell || !entry.value) return undefined;
      return {
        range: cell,
        field: entry.field,
        xml: replaceCellWithLabelAndValue(cell.xml, entry.value),
      };
    })
    .filter((entry): entry is CellReplacement => Boolean(entry));
}

function buildScheduleReplacements(table: TableRange, schedule: VerticalSchedule): CellReplacement[] {
  const replacements: CellReplacement[] = [];

  /*
   * Table 1 map from the clean DOCX template:
   * - zero-based rows 4..34 are visual day rows 01..31.
   * - each day row has seven cells:
   *   0 day number, 1 weekday, 2 Turno A, 3 Turno INT, 4 Turno B,
   *   5 Folga, 6 Observacao.
   *
   * The day-number cells already contain 01..31 in the template, so Step 2
   * leaves them intact and only fills the adjacent weekday/operator cells.
   */
  for (const day of schedule.daySchedule.days) {
    const row = table.rows[3 + day.day];
    if (!row || textFromXml(row.cells[0]?.xml ?? "") !== String(day.day).padStart(2, "0")) {
      continue;
    }

    const values = [
      { cell: 1, field: `day.${day.day}.weekday`, value: day.weekdayLabel },
      { cell: 2, field: `day.${day.day}.shiftA`, value: scheduleShiftText(schedule, day.day, "A") },
      { cell: 3, field: `day.${day.day}.shiftINT`, value: scheduleShiftText(schedule, day.day, "INT") },
      { cell: 4, field: `day.${day.day}.shiftB`, value: scheduleShiftText(schedule, day.day, "B") },
      { cell: 5, field: `day.${day.day}.off`, value: scheduleOffText(schedule, day.day) },
      { cell: 6, field: `day.${day.day}.observation`, value: scheduleObservationText(schedule, day.day) },
    ];

    for (const entry of values) {
      const cell = row.cells[entry.cell];
      if (!cell || !entry.value) continue;
      replacements.push({
        range: cell,
        field: entry.field,
        xml: replaceCellText(cell.xml, entry.value),
      });
    }
  }

  return replacements;
}

function legendCellForIndex(table: TableRange, index: number): { codeCell?: XmlRange; operatorCell?: XmlRange } {
  /*
   * Table 1 legend map from the clean DOCX template:
   * - rows 37..44 are the first legend band with three code/operator pairs:
   *   cells 0/1, 2/3, 4/5.
   * - rows 47..54 are the second legend band with two code/operator pairs:
   *   cells 0/1, 2/3. Cells 4/5 are intentionally unused in the template.
   * This gives 40 safe slots without creating rows or changing layout.
   */
  if (index < 24) {
    const columnPair = Math.floor(index / 8);
    const row = table.rows[37 + (index % 8)];
    return {
      codeCell: row?.cells[columnPair * 2],
      operatorCell: row?.cells[columnPair * 2 + 1],
    };
  }

  const secondBandIndex = index - 24;
  if (secondBandIndex < 16) {
    const columnPair = Math.floor(secondBandIndex / 8);
    const row = table.rows[47 + (secondBandIndex % 8)];
    return {
      codeCell: row?.cells[columnPair * 2],
      operatorCell: row?.cells[columnPair * 2 + 1],
    };
  }

  return {};
}

function buildLegendReplacements(table: TableRange, schedule: VerticalSchedule): CellReplacement[] {
  const replacements: CellReplacement[] = [];

  schedule.legend.forEach((entry, index) => {
    const { codeCell, operatorCell } = legendCellForIndex(table, index);
    if (!codeCell || !operatorCell) return;

    replacements.push({
      range: codeCell,
      field: `legend.${index}.code`,
      xml: replaceCellText(codeCell.xml, entry.code),
    });
    replacements.push({
      range: operatorCell,
      field: `legend.${index}.operator`,
      xml: replaceCellText(operatorCell.xml, entry.operator),
    });
  });

  return replacements;
}

function fillMainTable(documentXml: string, schedule: VerticalSchedule): { documentXml: string; filledFields: string[] } {
  const mainTable = findMainTable(documentXml);

  if (!mainTable) {
    return { documentXml, filledFields: [] };
  }

  let tableXml = mainTable.xml;
  const replacements = [
    ...buildHeaderReplacements(mainTable, schedule),
    ...buildScheduleReplacements(mainTable, schedule),
    ...buildLegendReplacements(mainTable, schedule),
  ].sort((a, b) => b.range.start - a.range.start);
  const replacedFields = new Set(replacements.map((replacement) => replacement.field));

  for (const replacement of replacements) {
    tableXml = replaceRange(tableXml, replacement.range, replacement.xml);
  }

  return {
    documentXml: replaceRange(documentXml, mainTable, tableXml),
    filledFields: replacements
      .map((entry) => entry.field)
      .reverse()
      .filter((field) => replacedFields.has(field)),
  };
}

function observationLines(schedule: VerticalSchedule): string[] {
  return schedule.observations.map((entry, index) => `${index + 1}. ${entry.text}`);
}

function fillObservationsTable(
  documentXml: string,
  schedule: VerticalSchedule,
): { documentXml: string; filledFields: string[] } {
  const observationsTable = findObservationsTable(documentXml);
  const observationCell = observationsTable?.rows[1]?.cells[0];

  if (!observationsTable || !observationCell || schedule.observations.length === 0) {
    return { documentXml, filledFields: [] };
  }

  const tableXml = replaceRange(observationsTable.xml, observationCell, replaceCellWithLines(observationCell.xml, observationLines(schedule)));

  return {
    documentXml: replaceRange(documentXml, observationsTable, tableXml),
    filledFields: ["observations"],
  };
}

export async function fillVerticalScheduleDocxTemplate(
  schedule: VerticalSchedule,
  options: FillVerticalScheduleDocxTemplateOptions = {},
): Promise<FillVerticalScheduleDocxTemplateResult> {
  const { zip, paths } = await loadTemplateZip(options.templatePath);
  const documentXml = await loadDocumentXml(zip);
  const structure = await inspectVerticalScheduleDocxTemplate(options.templatePath);
  const filledMainTable = fillMainTable(documentXml, schedule);
  const filledObservationsTable = fillObservationsTable(filledMainTable.documentXml, schedule);

  zip.file(DOCUMENT_XML_PATH, filledObservationsTable.documentXml);
  const docxBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const outputPath = resolveOutputPath(paths.root, options.outputPath);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, docxBytes);

  return {
    docxBytes,
    outputPath,
    structure,
    filledFields: [...filledMainTable.filledFields, ...filledObservationsTable.filledFields],
  };
}
