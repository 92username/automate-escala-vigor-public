import type { Employee, Role } from "./types";
import { normalizeOperatorName } from "./vertical-operator-codes";

export const NOVICE_NAMES = new Set(["Luis", "Guilherme", "Luiz"]);

export const DEFAULT_EMPLOYEES: Employee[] = [
  // ENC — Encarregados (8-day cycle: A A X X B B X X)
  { id: "enc-flavio", name: "Flavio", role: "ENC", verticalCode: "A01" },
  { id: "enc-octavio", name: "Octavio", role: "ENC", verticalCode: "A02" },
  { id: "enc-jose", name: "Jose", role: "ENC", verticalCode: "A03" },
  { id: "enc-william", name: "William", role: "ENC", verticalCode: "A04" },

  // SUB — Substitutos (4-day cycle: W W X X)
  { id: "sub-thiago", name: "Thiago", role: "SUB", verticalCode: "A05" },
  { id: "sub-claudius", name: "Claudius", role: "SUB", verticalCode: "A06" },
  { id: "sub-rogerio", name: "Rogerio", role: "SUB", verticalCode: "A07" },

  // ADM — Expediente administrativo
  { id: "adm-bruno", name: "Bruno", role: "ADM", verticalCode: "A08" },

  // OPE — Operadores
  { id: "ope-fabio", name: "Fabio", role: "OPE", verticalCode: "A09" },
  { id: "ope-gilberto", name: "Gilberto", role: "OPE", verticalCode: "B01" },
  { id: "ope-megrivi", name: "Megrivi", role: "OPE", verticalCode: "B02" },
  { id: "ope-antonio", name: "Antonio", role: "OPE", verticalCode: "B03" },
  { id: "ope-ivan", name: "Ivan", role: "OPE", verticalCode: "B04" },
  { id: "ope-gilson", name: "Gilson", role: "OPE", verticalCode: "B05" },
  { id: "ope-luis", name: "Luis", role: "OPE", verticalCode: "B06", novice: true },
  { id: "ope-guilherme", name: "Guilherme", role: "OPE", verticalCode: "B07", novice: true },
  { id: "ope-luiz", name: "Luiz", role: "OPE", verticalCode: "B08", novice: true },

  // ESP — Especiais
  { id: "esp-carlos", name: "Carlos", role: "ESP", verticalCode: "C01" },
  { id: "esp-leandro", name: "Leandro", role: "ESP", verticalCode: "C02" },
];

export function isNovice(employee: Employee): boolean {
  return employee.novice === true || NOVICE_NAMES.has(employee.name);
}

/**
 * Normalize a name (remove accents, uppercase, trim).
 */
export function normName(s: string): string {
  return normalizeOperatorName(s);
}

const ROLE_HINTS: Array<{ role: Role; tokens: string[]; novice?: boolean }> = [
  { role: "ENC", tokens: ["FLAVIO"] },
  { role: "ENC", tokens: ["OCTAVIO"] },
  { role: "ENC", tokens: ["JOSE"] },
  { role: "ENC", tokens: ["WILLIAM"] },
  { role: "SUB", tokens: ["THIAGO"] },
  { role: "SUB", tokens: ["CLAUDIUS"] },
  { role: "SUB", tokens: ["ROGERIO"] },
  { role: "OPE", tokens: ["FABIO"] },
  { role: "OPE", tokens: ["GILBERTO"] },
  { role: "OPE", tokens: ["MEGRIVI"] },
  { role: "OPE", tokens: ["ANTONIO"] },
  { role: "OPE", tokens: ["IVAN"] },
  { role: "OPE", tokens: ["GILSON"] },
  { role: "OPE", tokens: ["LUIS"], novice: true },
  { role: "OPE", tokens: ["GUILHERME"], novice: true },
  { role: "OPE", tokens: ["LUIZ"], novice: true },
  { role: "ESP", tokens: ["CARLOS"] },
  { role: "ESP", tokens: ["LEANDRO"] },
  { role: "ADM", tokens: ["BRUNO"] },
];

/**
 * Best-effort role matching from a free-text name found in the imported xlsx.
 * Returns null when no rule matches.
 */
export function matchRoleFromName(
  rawName: string,
): { role: Role; novice?: boolean; canonicalName: string } | null {
  const n = normName(rawName);
  for (const hint of ROLE_HINTS) {
    if (hint.tokens.every((t) => n.includes(t))) {
      const def = DEFAULT_EMPLOYEES.find(
        (e) => normName(e.name) === normName(hint.tokens[0]!) ||
          n.includes(normName(e.name)),
      );
      return {
        role: hint.role,
        novice: hint.novice,
        canonicalName: def?.name ?? rawName,
      };
    }
  }
  return null;
}
