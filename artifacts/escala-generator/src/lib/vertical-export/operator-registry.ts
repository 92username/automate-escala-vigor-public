export type VerticalOperatorGroup = "A" | "B" | "C";

export type VerticalOperatorRegistryStatus = "active" | "inactive";

export interface VerticalOperatorRegistryEntry {
  code: string;
  name: string;
  aliases?: string[];
  group: VerticalOperatorGroup;
  active: boolean;
  status: VerticalOperatorRegistryStatus;
}

export const VERTICAL_OPERATOR_REGISTRY: VerticalOperatorRegistryEntry[] = [
  { code: "A01", name: "Flavio", group: "A", active: true, status: "active" },
  { code: "A02", name: "Octavio", group: "A", active: true, status: "active" },
  { code: "A03", name: "Jose", group: "A", active: true, status: "active" },
  { code: "A04", name: "William", group: "A", active: true, status: "active" },
  { code: "A05", name: "Thiago", group: "A", active: true, status: "active" },
  { code: "A06", name: "Claudius", aliases: ["CLAUDIUS"], group: "A", active: true, status: "active" },
  { code: "A07", name: "Rogerio", aliases: ["ROGERIO"], group: "A", active: true, status: "active" },
  { code: "A08", name: "Bruno", aliases: ["BRUNO"], group: "A", active: true, status: "active" },
  { code: "A09", name: "Fabio", group: "A", active: true, status: "active" },
  { code: "B01", name: "Gilberto", group: "B", active: true, status: "active" },
  { code: "B02", name: "Megrivi", group: "B", active: true, status: "active" },
  { code: "B03", name: "Paulo", group: "B", active: true, status: "active" },
  { code: "B04", name: "Antonio", group: "B", active: true, status: "active" },
  { code: "B05", name: "Ivan", group: "B", active: true, status: "active" },
  { code: "B06", name: "Gilson", group: "B", active: true, status: "active" },
  { code: "B07", name: "Luis", aliases: ["LUIS", "VINICIUS"], group: "B", active: true, status: "active" },
  { code: "B08", name: "Guilherme", group: "B", active: true, status: "active" },
  { code: "B09", name: "Luiz", group: "B", active: true, status: "active" },
  { code: "C01", name: "Carlos", aliases: ["CARLOS"], group: "C", active: true, status: "active" },
  { code: "C02", name: "Leandro", aliases: ["LEANDRO"], group: "C", active: true, status: "active" },
];

function normalizeOperatorCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeOperatorName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeLookupName(value: string): string {
  return stripDiacritics(value)
    .replace(/^[0-9./-]+\s*-\s*/, "")
    .replace(/^[0-9./-]+\s+/, "")
    .replace(/\s*-\s*JG\d+\s*$/i, "")
    .replace(/[^A-Z0-9 ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cloneRegistryEntry(entry: VerticalOperatorRegistryEntry): VerticalOperatorRegistryEntry {
  return { ...entry, aliases: entry.aliases ? [...entry.aliases] : undefined };
}

function entryLookupNames(entry: VerticalOperatorRegistryEntry): string[] {
  return [entry.name, ...(entry.aliases ?? [])].map(normalizeLookupName);
}

export function createVerticalOperatorRegistry(
  entries: VerticalOperatorRegistryEntry[] = VERTICAL_OPERATOR_REGISTRY,
): VerticalOperatorRegistryEntry[] {
  return entries.map(cloneRegistryEntry);
}

export function listActiveOperators(
  registry: VerticalOperatorRegistryEntry[] = VERTICAL_OPERATOR_REGISTRY,
): VerticalOperatorRegistryEntry[] {
  return registry.filter((entry) => entry.active);
}

export function findOperatorByCode(
  code: string,
  registry: VerticalOperatorRegistryEntry[] = VERTICAL_OPERATOR_REGISTRY,
): VerticalOperatorRegistryEntry | undefined {
  const normalizedCode = normalizeOperatorCode(code);
  return registry.find((entry) => normalizeOperatorCode(entry.code) === normalizedCode);
}

export function findOperatorsByName(
  name: string,
  registry: VerticalOperatorRegistryEntry[] = VERTICAL_OPERATOR_REGISTRY,
): VerticalOperatorRegistryEntry[] {
  const normalizedName = normalizeLookupName(name);
  return registry.filter((entry) => entryLookupNames(entry).includes(normalizedName));
}

export function findOperatorByName(
  name: string,
  registry: VerticalOperatorRegistryEntry[] = VERTICAL_OPERATOR_REGISTRY,
): VerticalOperatorRegistryEntry | undefined {
  const normalizedName = normalizeLookupName(name);
  return registry.find((entry) => entryLookupNames(entry).includes(normalizedName));
}

export interface VerticalOperatorUpsertInput {
  code: string;
  name: string;
  group: VerticalOperatorGroup;
  active?: boolean;
}

export function upsertOperator(
  registry: VerticalOperatorRegistryEntry[] = VERTICAL_OPERATOR_REGISTRY,
  operator: VerticalOperatorUpsertInput,
): VerticalOperatorRegistryEntry[] {
  const normalizedCode = normalizeOperatorCode(operator.code);
  const entry: VerticalOperatorRegistryEntry = {
    code: normalizedCode,
    name: operator.name.trim().replace(/\s+/g, " "),
    group: operator.group,
    active: operator.active ?? true,
    status: (operator.active ?? true) ? "active" : "inactive",
  };

  const index = registry.findIndex((current) => normalizeOperatorCode(current.code) === normalizedCode);
  if (index < 0) {
    return [...registry, entry];
  }

  return registry.map((current, currentIndex) => (currentIndex === index ? entry : cloneRegistryEntry(current)));
}

export function deactivateOperator(
  registry: VerticalOperatorRegistryEntry[] = VERTICAL_OPERATOR_REGISTRY,
  code: string,
): VerticalOperatorRegistryEntry[] {
  const normalizedCode = normalizeOperatorCode(code);

  return registry.map((entry) =>
    normalizeOperatorCode(entry.code) === normalizedCode
      ? { ...entry, active: false, status: "inactive" }
      : cloneRegistryEntry(entry),
  );
}
