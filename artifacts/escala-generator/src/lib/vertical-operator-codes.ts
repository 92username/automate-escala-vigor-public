export interface OfficialVerticalOperator {
  code: string;
  name: string;
  aliases: string[];
}

export function normalizeOperatorName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const OFFICIAL_VERTICAL_OPERATORS: OfficialVerticalOperator[] = [
  { code: "A01", name: "Flavio", aliases: ["FLAVIO"] },
  { code: "A02", name: "Octavio", aliases: ["OCTAVIO"] },
  { code: "A03", name: "Jose", aliases: ["JOSE"] },
  { code: "A04", name: "William", aliases: ["WILLIAM"] },
  { code: "A05", name: "Thiago", aliases: ["THIAGO"] },
  { code: "A06", name: "Claudius", aliases: ["CLAUDIUS"] },
  { code: "A07", name: "Rogerio", aliases: ["ROGERIO"] },
  { code: "A08", name: "Bruno", aliases: ["BRUNO"] },
  { code: "A09", name: "Fabio", aliases: ["FABIO"] },
  { code: "B01", name: "Gilberto", aliases: ["GILBERTO"] },
  { code: "B02", name: "Megrivi", aliases: ["MEGRIVI"] },
  { code: "B03", name: "Antonio", aliases: ["ANTONIO"] },
  { code: "B04", name: "Ivan", aliases: ["IVAN"] },
  { code: "B05", name: "Gilson", aliases: ["GILSON"] },
  { code: "B06", name: "Luis", aliases: ["LUIS", "VINICIUS"] },
  { code: "B07", name: "Guilherme", aliases: ["GUILHERME"] },
  { code: "B08", name: "Luiz", aliases: ["LUIZ"] },
  { code: "C01", name: "Carlos", aliases: ["CARLOS"] },
  { code: "C02", name: "Leandro", aliases: ["LEANDRO"] },
];

const OFFICIAL_VERTICAL_OPERATOR_BY_ALIAS = new Map<string, OfficialVerticalOperator>();

for (const operator of OFFICIAL_VERTICAL_OPERATORS) {
  OFFICIAL_VERTICAL_OPERATOR_BY_ALIAS.set(normalizeOperatorName(operator.name), operator);
  for (const alias of operator.aliases) {
    OFFICIAL_VERTICAL_OPERATOR_BY_ALIAS.set(normalizeOperatorName(alias), operator);
  }
}

export function getOfficialVerticalOperatorForName(name: string): OfficialVerticalOperator | undefined {
  const normalized = normalizeOperatorName(name);
  if (!normalized) return undefined;

  const exactMatch = OFFICIAL_VERTICAL_OPERATOR_BY_ALIAS.get(normalized);
  if (exactMatch) return exactMatch;

  return OFFICIAL_VERTICAL_OPERATORS.find((operator) =>
    operator.aliases.some((alias) => {
      const normalizedAlias = normalizeOperatorName(alias);
      return normalized === normalizedAlias || normalized.includes(normalizedAlias);
    }),
  );
}

export function getDefaultVerticalCodeForOperator(name: string): string | undefined {
  return getOfficialVerticalOperatorForName(name)?.code;
}

export function getOfficialVerticalNameForOperator(name: string): string | undefined {
  return getOfficialVerticalOperatorForName(name)?.name;
}

export function normalizeVerticalCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function fallbackVerticalCode(index: number): string {
  return `A${String(index + 1).padStart(2, "0")}`;
}
