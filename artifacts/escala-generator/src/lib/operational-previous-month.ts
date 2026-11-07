import * as XLSX from "xlsx";
import { daysInMonth } from "./calendar";
import { matchRoleFromName, normName, DEFAULT_EMPLOYEES } from "./employees";
import type { Employee, PrevDayCode, PreviousMonthInfo } from "./types";

export interface PrevMonthImportResult {
  prevMonth: PreviousMonthInfo;
  employees: Employee[];
  detectedYear: number;
  detectedMonth: number;
  sheetName: string;
  matchedNames: string[];
  unmatchedNames: string[];
}

const EXCEL_EPOCH_DAYS = 25569;

function excelSerialToDate(serial: number): Date {
  return new Date((serial - EXCEL_EPOCH_DAYS) * 86400 * 1000);
}

function isWorkbookSheet(ws: XLSX.WorkSheet | undefined): ws is XLSX.WorkSheet {
  return !!ws && !!ws["!ref"];
}

function classifyCell(raw: unknown): PrevDayCode {
  if (raw === null || raw === undefined || raw === "") return "OFF";
  let s = String(raw).trim().toUpperCase();
  if (!s) return "OFF";
  if (s === "F" || s === "X") return "OFF";
  if (s.startsWith("FT")) return "FT";
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
  if (s.startsWith("?/") || s.startsWith("/")) {
    s = s.replace(/^\??\//, "");
  }
  if (s.includes("/")) s = s.split("/")[0]!;
  if (s === "A") return "A";
  if (s === "B") return "B";
  if (s === "INT") return "INT";
  return "ABS";
}

function findMonthStartColumn(
  aoa: unknown[][],
  year: number,
  month: number,
): number | null {
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

export function detectMostRecentMonth(buffer: ArrayBuffer): {
  year: number;
  month: number;
  sheetName: string;
} | null {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const byMonth = new Map<
    string,
    { year: number; month: number; sheetName: string; date: Date }
  >();

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
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const key = `${year}-${month}`;
        const prev = byMonth.get(key);
        if (!prev || date.getTime() > prev.date.getTime()) {
          byMonth.set(key, { year, month, sheetName: name, date });
        }
      }
    }
  }

  const candidates = [...byMonth.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  if (candidates.length === 0) return null;

  // A planilha carrega colunas de datas futuras ainda vazias (ex.: até 2029), então a
  // maior data do cabeçalho NÃO é o mês vigente. Restringe aos meses já iniciados e
  // confirma que o mês tem ao menos um turno lançado antes de escolhê-lo.
  const agora = new Date().getTime();
  const iniciados = candidates.filter((c) => c.date.getTime() <= agora);
  const pool = (iniciados.length > 0 ? iniciados : candidates).slice(0, 4);

  for (const candidato of pool) {
    try {
      const parsed = parseOperationalPreviousMonth(buffer, candidato.year, candidato.month);
      const temTurno = Object.values(parsed.prevMonth.daysByEmployeeId).some((dias) =>
        dias.some((dia) => dia !== "OFF"),
      );
      if (temTurno) {
        return {
          year: candidato.year,
          month: candidato.month,
          sheetName: candidato.sheetName,
        };
      }
    } catch {
      // mês sem colunas completas nesse arquivo: tenta o mês anterior
    }
  }

  const fallback = pool[0] ?? candidates[0]!;
  return { year: fallback.year, month: fallback.month, sheetName: fallback.sheetName };
}

export function parseOperationalPreviousMonth(
  buffer: ArrayBuffer,
  year: number,
  month: number,
): PrevMonthImportResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

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

  for (let r = 4; r < Math.min(aoa.length, 50); r++) {
    const row = aoa[r];
    if (!row) continue;
    const nameCell = row[1];
    if (!nameCell) continue;
    const rawName = String(nameCell).trim();
    if (!rawName) continue;
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

    const match = matchRoleFromName(rawName);
    if (!match) {
      unmatchedNames.push(rawName);
      continue;
    }
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
