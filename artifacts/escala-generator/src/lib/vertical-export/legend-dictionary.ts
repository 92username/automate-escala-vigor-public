export type VerticalLegendMatchKind = "exact" | "pattern";

export interface VerticalLegendDictionaryBaseEntry {
  meaning: string;
  kind: VerticalLegendMatchKind;
  description: string;
}

export interface VerticalLegendDictionaryExactEntry extends VerticalLegendDictionaryBaseEntry {
  kind: "exact";
  code: string;
}

export interface VerticalLegendDictionaryPatternEntry extends VerticalLegendDictionaryBaseEntry {
  kind: "pattern";
  pattern: RegExp;
  examples: string[];
}

export type VerticalLegendDictionaryEntry =
  | VerticalLegendDictionaryExactEntry
  | VerticalLegendDictionaryPatternEntry;

export interface VerticalLegendDictionaryMatch {
  input: string;
  normalizedCode: string;
  entry: VerticalLegendDictionaryEntry;
}

export const VERTICAL_LEGEND_DICTIONARY: VerticalLegendDictionaryEntry[] = [
  {
    kind: "exact",
    code: "F",
    meaning: "Férias",
    description: "Folga normal registrada como F.",
  },
  {
    kind: "exact",
    code: "FT",
    meaning: "Folga Técnica",
    description: "Folga técnica simples registrada como FT.",
  },
  {
    kind: "pattern",
    pattern: /^FT\/[A-Z0-9]+$/,
    meaning: "Folga Técnica",
    description: "Folga técnica com sufixo classificador.",
    examples: ["FT/X"],
  },
  {
    kind: "exact",
    code: "/AD",
    meaning: "Expediente Administrativo",
    description: "Expediente administrativo registrado como /AD.",
  },
  {
    kind: "pattern",
    pattern: /^\/[A-Z]{3}\d{3}$/,
    meaning: "Curso",
    description: "Curso registrado no formato /XXXnnn.",
    examples: ["/ABC123"],
  },
  {
    kind: "exact",
    code: "CMA",
    meaning: "INSPSAU",
    description: "INSPSAU registrado como CMA.",
  },
  {
    kind: "pattern",
    pattern: /^CMA\/[A-Z0-9]+$/,
    meaning: "INSPSAU",
    description: "INSPSAU com sufixo classificador.",
    examples: ["CMA/X"],
  },
  {
    kind: "exact",
    code: "DM",
    meaning: "Dispensa Médica",
    description: "Dispensa médica registrada como DM.",
  },
  {
    kind: "pattern",
    pattern: /^DM\/[A-Z0-9]+$/,
    meaning: "Dispensa Médica",
    description: "Dispensa médica com sufixo classificador.",
    examples: ["DM/X"],
  },
  {
    kind: "exact",
    code: "HE",
    meaning: "Hora Extra",
    description: "Hora extra registrada como HE.",
  },
  {
    kind: "pattern",
    pattern: /^[A-Z0-9]+\/HE$/,
    meaning: "Hora Extra",
    description: "Hora extra registrada com prefixo classificador.",
    examples: ["ABC/HE"],
  },
  {
    kind: "pattern",
    pattern: /^\?\/(?:A|B|INT)(?:\/CMA)?$/,
    meaning: "Designação pendente de turno",
    description: "Designação pendente ou incerta relacionada a turno operacional.",
    examples: ["?/A", "?/B", "?/INT", "?/A/CMA"],
  },
  {
    kind: "pattern",
    pattern: /^\/(?:A|INT)(?:\/TATIC)?$/,
    meaning: "Anotação de turno",
    description: "Anotação vinculada a turno operacional sem alterar o código bruto.",
    examples: ["/A", "/INT", "/INT/TATIC"],
  },
  {
    kind: "pattern",
    pattern: /^(?:A|INT)\+HE$/,
    meaning: "Hora Extra",
    description: "Hora extra vinculada diretamente a um turno operacional.",
    examples: ["A+HE", "INT+HE"],
  },
  {
    kind: "pattern",
    pattern: /^TATIC(?:\/(?:AD|HE[A-Z0-9/]*))?$/,
    meaning: "TATIC",
    description: "Serviço ou anotação do sistema TATIC com detalhamento preservado no código bruto.",
    examples: ["TATIC", "TATIC/AD", "TATIC/HEFT/A"],
  },
  {
    kind: "pattern",
    pattern: /^A\/DM\/?$/,
    meaning: "Turno A com Dispensa Médica",
    description: "Turno A associado a anotação de dispensa médica.",
    examples: ["A/DM/"],
  },
  {
    kind: "pattern",
    pattern: /^\/(?:ATM11|SEC002E)$/,
    meaning: "Curso",
    description: "Código real de curso ou treinamento observado na escala em vigor.",
    examples: ["/ATM11", "/SEC002E"],
  },
  {
    kind: "exact",
    code: "VOO",
    meaning: "Voo operacional",
    description: "Anotação de voo ou deslocamento operacional.",
  },
];

function normalizeLegendCode(code: string): string {
  return code.trim().toUpperCase();
}

function matchesLegendEntry(code: string, entry: VerticalLegendDictionaryEntry): boolean {
  if (entry.kind === "exact") {
    return normalizeLegendCode(entry.code) === code;
  }

  return entry.pattern.test(code);
}

export function matchLegendDictionaryEntry(
  code: string,
  dictionary: VerticalLegendDictionaryEntry[] = VERTICAL_LEGEND_DICTIONARY,
): VerticalLegendDictionaryMatch | undefined {
  const normalizedCode = normalizeLegendCode(code);
  const exactMatch = dictionary.find((entry) => entry.kind === "exact" && matchesLegendEntry(normalizedCode, entry));
  if (exactMatch) {
    return {
      input: code,
      normalizedCode,
      entry: exactMatch,
    };
  }

  const patternMatch = dictionary.find((entry) => entry.kind === "pattern" && matchesLegendEntry(normalizedCode, entry));
  if (!patternMatch) {
    return undefined;
  }

  return {
    input: code,
    normalizedCode,
    entry: patternMatch,
  };
}

export function lookupLegendMeaning(
  code: string,
  dictionary: VerticalLegendDictionaryEntry[] = VERTICAL_LEGEND_DICTIONARY,
): string | undefined {
  return matchLegendDictionaryEntry(code, dictionary)?.entry.meaning;
}
