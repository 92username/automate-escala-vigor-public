# Vertical Export Architecture

This document describes the ICA 63-33 vertical export architecture after the
DOCX template decision.

## Decision

Microsoft Word DOCX is the primary and only system-generated output for the
vertical export.

The system no longer renders a final PDF directly. The operational flow is:

```text
Real CSV
-> Parser
-> VerticalSchedule
-> DOCX Template Filler
-> Editable DOCX
-> Supervisor edits/reviews in Microsoft Word
-> Supervisor saves/prints as PDF manually
```

The user or supervisor is responsible for producing the final PDF from
Microsoft Word.

## Template Asset

The DOCX filler must use this template:

```text
assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx
```

The template preserves the ICA 63-33 layout as real Microsoft Word tables, so
the filler should update table cells and document fields instead of drawing into
PDF coordinates.

## Module Layout

Current and planned module boundaries:

```text
vertical-export/
  models.ts
  mapper.ts
  real-schedule-parser.ts
  real-schedule-to-vertical.ts
  operator-registry.ts
  legend-dictionary.ts
  docx-template-filler.ts       # planned
  exporter.ts                  # planned public orchestration layer
  config.ts                    # planned export configuration
```

## File Responsibilities

### `models.ts`

Defines the output-independent `VerticalSchedule` data contract: header fields,
daily shifts, off/unavailable entries, legend rows, observations, summaries, and
diagnostics.

### `mapper.ts`

Converts the existing generated schedule result into `VerticalSchedule`.

### `real-schedule-parser.ts`

Parses the real CSV schedule into month blocks, day columns, operator rows,
known shift markers, legend matches, and diagnostics.

### `real-schedule-to-vertical.ts`

Maps a parsed real CSV schedule into `VerticalSchedule` without depending on any
final document format.

### `operator-registry.ts`

Owns the active vertical export operator code table.

### `legend-dictionary.ts`

Owns explicit schedule shorthand meanings used by parser diagnostics and export
legend generation.

### `docx-template-filler.ts` Planned

Will load `assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx`, locate the
ICA table cells or content controls, fill them from `VerticalSchedule`, and
return/write an editable DOCX file.

## Removed PDF Architecture

The previous direct PDF rendering path is removed:

- `layout.ts` was PDF-coordinate specific and is no longer part of the active
  architecture.
- `renderer.ts` was a direct PDF renderer and is no longer part of the active
  architecture.
- `pdf-lib` is no longer required by the vertical export.
- PDF renderer/layout tests are removed with those modules.

## Dependency Direction

The active export dependency flow is:

```text
Real CSV -> real-schedule-parser.ts -> real-schedule-to-vertical.ts -> models.ts
models.ts -> docx-template-filler.ts -> editable DOCX
```

Scheduler-driven export remains:

```text
ScheduleResult -> mapper.ts -> models.ts -> docx-template-filler.ts -> editable DOCX
```

## Design Rules

- The scheduler must not know about DOCX internals.
- Parsers and mappers must not know about Word table locations.
- The DOCX filler must not recalculate business rules.
- `VerticalSchedule` remains the contract between data preparation and document
  generation.
- The system must not generate the final PDF; Microsoft Word is the PDF export
  boundary.

## Architecture Criteria

This architecture is healthy when:

- CSV parsing and schedule mapping are independently testable;
- the DOCX template filler is the only document-generation component;
- users can review and edit the generated DOCX in Microsoft Word;
- final PDF generation remains a manual Word save/print action.
