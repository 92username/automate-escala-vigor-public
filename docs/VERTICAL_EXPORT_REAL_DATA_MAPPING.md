# Vertical Export Real Data Mapping

## Purpose

This document defines how real schedule CSV data maps into the ICA 63-33
vertical export model.

The mapping contract is output-independent. It prepares `VerticalSchedule` data
for the DOCX template filler, which is now the only system-generated final
output path.

## Final Operational Flow

```text
Real CSV
-> Parser
-> VerticalSchedule
-> DOCX Template Filler
-> Editable DOCX
-> Supervisor edits/reviews in Microsoft Word
-> Supervisor saves/prints as PDF manually
```

The system does not render a final PDF directly.

## Real Input Files

- Schedule source: operational CSV kept outside version control.
- DOCX template: [assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx](../assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx)

The DOCX template is the authoritative system-generated document target because
it preserves the ICA 63-33 layout as real Microsoft Word tables.

## Month/Year Source and Override Rule

The displayed month/year comes from row 2 of the schedule file.

Example:

- The file may display `julho/2023`.
- In the current workflow, that value must be interpreted as `julho/2026` when
  the user configures the active export month/year.

Rule:

- Keep the displayed text as a source label.
- Use the user-configured month/year as the effective export month/year.
- Do not hardcode the year from the CSV display row if it conflicts with the
  configured operational period.

This means row 2 is a human-facing source field, while the configured period is
the export authority.

## Operator Code Table

Operator codes must follow the official and current code table used by the
vertical export.

Example groups:

- Equipe A: `A01`, `A02`, `A03`, ...
- Equipe B: `B01`, `B02`, `B03`, ...
- Equipe C: `C01`, `C02`, ...

Mapping principles:

- Codes must be stable for the current export period.
- Existing operator names and codes must be preserved by default.
- If a code exists in the active table, it should continue to map to the same
  operator unless the user explicitly changes it.
- The table must support the current operational code set, not an inferred or
  auto-generated fallback.

Implementation note:

- the canonical registry lives in
  `artifacts/escala-generator/src/lib/vertical-export/operator-registry.ts`;
- it is stored as an editable in-memory registry with code, name, group, and
  active status;
- future UI editing can update this registry without changing the code table
  contract.

## User-Editable Operator Registry

The system must later support a user-managed operator registry tied to the
vertical export.

Required registry capabilities:

- edit operator name;
- edit operator code;
- add new operators;
- remove or deactivate operators;
- maintain the active code table used by the vertical export.

Default behavior:

- Preserve existing operator names and codes unless the user changes them.
- Prefer active registry entries over any derived or guessed operator identity.
- Treat inactive operators as excluded from new export selections while keeping
  their historical data available for reference if needed.

## Schedule Legend Dictionary

The project needs a schedule legend dictionary that maps codes and
abbreviations to their meanings.

Expected contents include:

- duty labels;
- leave labels;
- absence labels;
- training labels;
- maintenance or operational unavailability labels;
- any operational shorthand used in the real CSV.

Example entries:

- `DM` -> `Dispensa médica`
- `curso` -> `Curso`

Implementation note:

- the canonical dictionary lives in
  `artifacts/escala-generator/src/lib/vertical-export/legend-dictionary.ts`;
- it supports both exact codes and pattern-based matches.

## Observations Source for Escala Cumprida

Observations for `Escala Cumprida` refer to the previous month.

Example for June:

- William: `DM - Dispensa médica` from 13 to 16 June.
- Thiago: course in extra hours on 03/06.

Rule:

- When generating `Escala Cumprida` for a target month, observations must be
  collected from the prior month.
- The observations should reflect what actually happened, not only what was
  planned.
- The observation source must be linked to real execution data or reviewed
  operational records, not only to the planned schedule row.

## Difference Between Escala Prevista and Escala Cumprida

`Escala Prevista` is the planned schedule.

`Escala Cumprida` is the realized schedule, including previous-month
observations and actual operational changes.

Key differences:

- `Escala Prevista` reflects what was scheduled.
- `Escala Cumprida` reflects what was actually executed or observed.
- `Escala Cumprida` may include notes about medical leave, training, extra
  hours, substitutions, or other changes.
- `Escala Prevista` should not be rewritten with execution outcomes unless the
  export explicitly requires a completed view.

## Parser Behavior

The CSV parser step is an intermediate import layer, not a renderer or DOCX
writer.

Implemented parser rules:

- row 2 is scanned for month headers such as `julho/2023`, `nov/23`, or
  `jan/24`;
- row 3 is treated as the weekday row;
- row 4 is treated as the day-number row;
- each month header defines a block of daily columns until the next month
  header;
- operator rows preserve both raw and normalized labels;
- operator matching uses the registry and tolerates numeric/matricula prefixes
  in the CSV;
- daily cell values preserve both raw and normalized values;
- known legend patterns are matched with the dictionary;
- known shift markers `A`, `B`, and `INT` are preserved as shift codes;
- unknown operators and unknown daily codes are reported explicitly.

Year override behavior:

- the primary month block can use a user-provided `yearOverride`;
- the displayed year remains visible in the parsed data;
- additional month blocks keep the year displayed in the file.

## Parser to VerticalSchedule Mapping

The mapper from parsed real CSV data to `VerticalSchedule` is intentionally
independent from DOCX output. It does not change Word template filling,
scheduler behavior, hours calculation, or automatic observations.

Implemented flow:

1. `parseRealScheduleCsv(csvText, { yearOverride })` reads the real schedule
   CSV.
2. The parser returns month blocks, operator rows, day columns, shift cells,
   legend cells, unknown operators, unknown codes, and raw source indexes.
3. `convertRealScheduleParseResultToVerticalSchedule(parseResult, options)`
   selects `parseResult.selectedMonthBlock` by default.
4. The selected block becomes a `VerticalSchedule`.

Official operator code handling:

- matched operators use `operatorCode` provided by the parser, which comes from
  `operator-registry.ts`;
- the mapper does not generate sequential official-looking codes such as `A01`
  or `A02` for real CSV rows;
- fallback `UNKxx` codes are diagnostic preservation codes for unmatched
  operators and must not be treated as official registry codes.

Unknown propagation:

- unmatched operator rows produce `UNKNOWN_OPERATOR` diagnostics;
- unknown cell codes inside the selected month produce warning diagnostics;
- unknown cell codes outside the selected block produce informational
  diagnostics;
- unknown or legend cells are represented as off/unavailable in
  `daySchedule.offs` until richer observation semantics are defined.

Source reference preservation:

- `VerticalSchedule.sourceReference` stores the source block index, raw month
  header, displayed year, effective year, year override, selected column range,
  and parser row indexes.

## Data Still Missing for Later Integration

The following information still needs confirmation before the real-data vertical
export is connected to user-facing export flows:

- the exact CSV column structure and header meanings;
- the complete official operator code table for the active period;
- the full legend dictionary for all abbreviations and codes used in the real
  file;
- the exact rules for matching CSV rows to export days and duty blocks;
- the definitive source for previous-month observations used by
  `Escala Cumprida`;
- the persistence format for the user-editable operator registry;
- the precedence rules between CSV values, user overrides, and the active code
  table;
- the handling of inactive operators in historical and current exports.

## Next Implementation Step

Implement the DOCX template filler that writes `VerticalSchedule` into:

```text
assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx
```

The filler should produce an editable DOCX. The supervisor then reviews, edits,
and saves or prints the PDF manually from Microsoft Word.
