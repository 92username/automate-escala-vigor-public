import * as XLSX from "xlsx";
import { daysInMonth, monthLabel, weekdayLabel } from "./calendar";
import { matchRoleFromName, normName, DEFAULT_EMPLOYEES } from "./employees";
import { getDefaultVerticalCodeForOperator, normalizeVerticalCode } from "./vertical-operator-codes";
import type {
  AbsencePeriod,
  Employee,
  PrevDayCode,
  PreviousMonthInfo,
  ScheduleResult,
} from "./types";

export function cellLabel(
  kind: ScheduleResult["rows"][number]["days"][number]["kind"],
  shift: ScheduleResult["rows"][number]["days"][number]["shift"],
): string {
  switch (kind) {
    case "WORK":
      return shift ?? "";
    case "OFF":
      return "";
    case "FT":
      return "FT";
    case "FERIAS":
      return "F";
    case "LICENCA":
      return "LIC";
    case "CURSO":
      return "CUR";
    case "EXP":
      return "EXP";
    default:
      return "";
  }
}

export function exportScheduleToXlsx(result: ScheduleResult): Blob {
  const { year, month, rows, perDay } = result;
  const headerRow1: (string | number)[] = ["Funcionário", "Função"];
  const headerRow2: (string | number)[] = ["", ""];
  for (const d of perDay) {
    headerRow1.push(d.date);
    headerRow2.push(weekdayLabel(d.weekday));
  }
  headerRow1.push("Trab.", "FT", "A", "INT", "B", "SAB", "DOM");
  headerRow2.push("", "", "", "", "", "", "");

  const data: (string | number)[][] = [headerRow1, headerRow2];
  for (const row of rows) {
    const r: (string | number)[] = [row.employee.name, row.employee.role];
    for (const d of row.days) {
      r.push(cellLabel(d.kind, d.shift));
    }
    r.push(
      row.workedDays,
      row.ftDays,
      row.countA,
      row.countInt,
      row.countB,
      row.countSat,
      row.countSun,
    );
    data.push(r);
  }

  data.push([]);
  data.push(["Resumo por dia"]);
  data.push(["Dia", "Sem", "A", "INT", "B"]);
  for (const d of perDay) {
    data.push([
      d.date,
      weekdayLabel(d.weekday),
      d.A.join(", "),
      d.INT.join(", "),
      d.B.join(", "),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  const colCount = headerRow1.length;
  ws["!cols"] = Array.from({ length: colCount }, (_, i) =>
    i < 2 ? { wch: 18 } : { wch: 5 },
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${monthLabel(month)}-${year}`);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedXlsx {
  employees?: Employee[];
  absences?: AbsencePeriod[];
}

/**
 * Best-effort generic parser for our own export format.
 */
export function parseXlsx(buffer: ArrayBuffer): ParsedXlsx {
  const wb = XLSX.read(buffer, { type: "array" });
  const out: ParsedXlsx = {};
  const empSheet = wb.Sheets["Funcionarios"] ?? wb.Sheets["funcionarios"];
  if (empSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(empSheet);
    out.employees = rows
      .filter((r) => r["Nome"] || r["nome"] || r["name"])
      .map((r, idx) => {
        const name = String(r["Nome"] ?? r["nome"] ?? r["name"]);
        const role = String(
          r["Funcao"] ?? r["funcao"] ?? r["role"] ?? "OPE",
        ) as Employee["role"];
        const novice = Boolean(r["Novato"] ?? r["novato"] ?? r["novice"] ?? false);
        const verticalCode = String(
          r["Código"] ?? r["Codigo"] ?? r["codigo"] ?? r["verticalCode"] ?? "",
        );
        return {
          id: `imp-${idx}-${name.replace(/\s+/g, "-").toLowerCase()}`,
          name,
          role,
          verticalCode: verticalCode.trim()
            ? normalizeVerticalCode(verticalCode)
            : getDefaultVerticalCodeForOperator(name),
          novice,
        };
      });
  }
  const absSheet = wb.Sheets["Afastamentos"] ?? wb.Sheets["afastamentos"];
  if (absSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(absSheet);
    out.absences = rows
      .filter((r) => r["EmployeeId"] ?? r["employeeId"])
      .map((r, idx) => ({
        id: `imp-abs-${idx}`,
        employeeId: String(r["EmployeeId"] ?? r["employeeId"]),
        type: String(r["Tipo"] ?? r["type"] ?? "ferias") as AbsencePeriod["type"],
        startDay: Number(r["Inicio"] ?? r["startDay"] ?? 1),
        endDay: Number(r["Fim"] ?? r["endDay"] ?? 1),
      }));
  }
  return out;
}

// =============================================================================
// Operational xlsx parser ("Escala em Vigor")
//
// The official spreadsheet has one sheet per "active period" with the structure:
//   - Col 0..10:   employee metadata (Linha, Matrícula, Indicativo, etc.)
//   - Col 11+:     one column per calendar day (Excel date serial in row 1/2)
//   - Rows 4+:     one row per employee. Col 1 is "MATRICULA - NAME"
// Values per cell:
//   "A","B","INT"  -> shift assignment
//   "F" or empty   -> off (cycle off day)
//   "FT/A","FT/B"  -> FT (cycle-work day converted to technical off)
//   "/SEC","/ATM","/AD","INSS","DM/x","AR","ID" -> absence (cycle continues)
//   prefixes like "?/A", "INT/HE" -> normalize to A / INT
// =============================================================================

export interface PrevMonthImportResult {
  prevMonth: PreviousMonthInfo;
  employees: Employee[];
  detectedYear: number;
  detectedMonth: number;
  sheetName: string;
  matchedNames: string[];
  unmatchedNames: string[];
}

const EXCEL_EPOCH_DAYS = 25569; // 1970-01-01 in Excel date serial (1900 system)

function excelSerialToDate(serial: number): Date {
  return new Date((serial - EXCEL_EPOCH_DAYS) * 86400 * 1000);
}

function isWorkbookSheet(ws: XLSX.WorkSheet | undefined): ws is XLSX.WorkSheet {
  return !!ws && !!ws["!ref"];
}

/**
 * Convert a raw cell value from the operational xlsx into a PrevDayCode.
 */
function classifyCell(raw: unknown): PrevDayCode {
  if (raw === null || raw === undefined || raw === "") return "OFF";
  let s = String(raw).trim().toUpperCase();
  if (!s) return "OFF";
  if (s === "F" || s === "X") return "OFF";
  if (s.startsWith("FT")) return "FT";
  // Absence markers (cycle continues underneath)
  if (
    s.includes("/SEC") ||
    s.includes("/ATM") ||
    s.includes("/AD") ||
    s.startsWith("INSS") ||
    s.startsWith("DM") ||
    s === "AR" ||
    s === "ID" ||
    s === "FÉRIAS" ||
    s === "FERIAS" ||
    s === "FÉR" ||
    s === "FER" ||
    s === "LIC"
  ) {
    return "ABS";
  }
  // Prefix forms like "?/A" or "/A" — strip prefix and re-classify
  if (s.startsWith("?/") || s.startsWith("/")) {
    s = s.replace(/^\??\//, "");
  }
  // Compound forms like "INT/HE" or "A/HE"
  if (s.includes("/")) s = s.split("/")[0]!;
  if (s === "A") return "A";
  if (s === "B") return "B";
  if (s === "INT") return "INT";
  // Unknown markers default to OFF (will be ignored as ABS-like for scoring)
  return "ABS";
}

/**
 * Find the column index that corresponds to day 1 of the requested year/month.
 * The header row contains date serials starting at column 12 (one per day).
 * Returns null when not found.
 */
function findMonthStartColumn(
  aoa: unknown[][],
  year: number,
  month: number,
): number | null {
  // Try header rows 0, 1, 2, 3
  for (const headerRow of [2, 3, 1, 0]) {
    const row = aoa[headerRow];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      let date: Date | null = null;
      if (v instanceof Date) date = v;
      else if (typeof v === "number" && v > 40000 && v < 70000) {
        date = excelSerialToDate(v);
      }
      if (!date) continue;
      const yr = date.getUTCFullYear();
      const mo = date.getUTCMonth() + 1;
      if (yr === year && mo === month && date.getUTCDate() === 1) {
        return c;
      }
    }
  }
  return null;
}

/**
 * Auto-detect the most recent (largest) date present in any sheet, useful when
 * we want to default to "the previous month" without asking the user.
 */
export function detectMostRecentMonth(buffer: ArrayBuffer): {
  year: number;
  month: number;
  sheetName: string;
} | null {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  let best: { year: number; month: number; sheetName: string; date: Date } | null = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!isWorkbookSheet(ws)) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
    for (const headerRow of [2, 3, 1]) {
      const row = aoa[headerRow] as unknown[] | undefined;
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        let date: Date | null = null;
        if (v instanceof Date) date = v;
        else if (typeof v === "number" && v > 40000 && v < 70000) {
          date = excelSerialToDate(v);
        }
        if (!date) continue;
        if (!best || date.getTime() > best.date.getTime()) {
          best = {
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
            sheetName: name,
            date,
          };
        }
      }
    }
  }
  if (!best) return null;
  return { year: best.year, month: best.month, sheetName: best.sheetName };
}

/**
 * Parse the operational "Escala em Vigor" workbook to extract the previous
 * month's day-by-day status per employee, plus the employee list with roles
 * inferred from name.
 */
export function parseOperationalPreviousMonth(
  buffer: ArrayBuffer,
  year: number,
  month: number,
): PrevMonthImportResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  // Find the sheet that contains day 1 of the requested month
  let chosenSheet: string | null = null;
  let chosenAoa: unknown[][] | null = null;
  let chosenStartCol = -1;

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!isWorkbookSheet(ws)) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
    const col = findMonthStartColumn(aoa, year, month);
    if (col != null) {
      chosenSheet = name;
      chosenAoa = aoa;
      chosenStartCol = col;
      // Prefer the sheet that ALSO contains the next day, ie. is a full schedule
      const days = daysInMonth(year, month);
      const r2 = aoa[2] as unknown[] | undefined;
      if (r2 && r2.length >= col + days) break;
    }
  }

  if (!chosenSheet || !chosenAoa || chosenStartCol < 0) {
    throw new Error(
      `Não foi possível encontrar dados de ${month}/${year} no arquivo importado.`,
    );
  }

  const days = daysInMonth(year, month);
  const aoa = chosenAoa;

  const matchedNames: string[] = [];
  const unmatchedNames: string[] = [];
  const employees: Employee[] = [];
  const daysByEmployeeId: Record<string, PrevDayCode[]> = {};

  // Walk employee rows (start at row 4, allow up to row 50)
  for (let r = 4; r < Math.min(aoa.length, 50); r++) {
    const row = aoa[r];
    if (!row) continue;
    const nameCell = row[1];
    if (!nameCell) continue;
    const rawName = String(nameCell).trim();
    if (!rawName) continue;
    // Skip footer rows like "06h00/15h00", "TOTAL DO DIA", "ENCARREGADOS"
    if (
      /^\d{2}h\d{2}/i.test(rawName) ||
      /^TOTAL/i.test(rawName) ||
      /^ENCARR/i.test(rawName) ||
      /^A\*?$/i.test(rawName) ||
      /^B\*?$/i.test(rawName) ||
      /^INT\*?$/i.test(rawName)
    ) {
      continue;
    }

    // Try to match against known employees (and their normalized name)
    const match = matchRoleFromName(rawName);
    if (!match) {
      unmatchedNames.push(rawName);
      continue;
    }
    // Find the canonical Employee in DEFAULT_EMPLOYEES
    const canonical = DEFAULT_EMPLOYEES.find(
      (de) => normName(de.name) === normName(match.canonicalName),
    );
    if (!canonical) {
      unmatchedNames.push(rawName);
      continue;
    }

    matchedNames.push(canonical.name);
    const daysCodes: PrevDayCode[] = [];
    for (let i = 0; i < days; i++) {
      const cell = row[chosenStartCol + i];
      daysCodes.push(classifyCell(cell));
    }
    employees.push({
      id: canonical.id,
      name: canonical.name,
      role: canonical.role,
      verticalCode: canonical.verticalCode,
      novice: canonical.novice ?? match.novice,
      previousMonthDays: daysCodes,
    });
    daysByEmployeeId[canonical.id] = daysCodes;
  }

  // Add any DEFAULT employee that wasn't found in the file (so the team is complete).
  for (const def of DEFAULT_EMPLOYEES) {
    if (!employees.find((e) => e.id === def.id)) {
      employees.push({ ...def });
    }
  }

  return {
    prevMonth: { year, month, daysByEmployeeId },
    employees,
    detectedYear: year,
    detectedMonth: month,
    sheetName: chosenSheet,
    matchedNames,
    unmatchedNames,
  };
}

/**
 * Convenience: returns the (year, month) immediately preceding the given pair.
 */
export function previousYearMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}
