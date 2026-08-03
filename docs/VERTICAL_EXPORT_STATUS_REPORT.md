# ICA 63-33 Vertical Export Status Report

## 1. Roadmap Status

| Milestone | Status | What is actually implemented |
| --- | --- | --- |
| 1 | Completed | Field inventory, layout keys, and the base `VerticalSchedule` contract are defined in docs and types. |
| 2 | Completed | Horizontal `ScheduleResult` is converted into `VerticalSchedule`, including legend, shifts, offs, observations, and summary data. |
| 3 | Completed | Header/config inputs exist in the model and mapper plumbing, including month/year label, staff counts, signatures, and manual hours fields. |
| 4 | Completed | The contract is effectively frozen through stable model keys, layout keys, and the documented data boundaries. |
| 5 | Completed | `layout.ts` defines frozen template coordinates, grid resolution, legend band placement, and a layout plan builder. |
| 6 | Partially completed | PDF rendering works: template loading, text placement, legend/observation rendering, PDF buffer output, file writing, and debug overlay generation. The day-number cells are still left to the template, and there is no separate exporter layer. |
| 7 | Partially completed | The hour fields are documented and carried through the model as manual/configuration inputs, but no hour calculation engine exists. |
| 8 | Partially completed | Observations can be rendered as text, but automatic generation from operational events is not implemented. |
| 9 | Not started | No `Escala Cumprida` workflow, history model, or alteration registry exists yet. |
| 10 | Not started | No UI/export integration layer is present. |
| 11 | Not started | No PDF-to-PDF validation/comparison pipeline exists. |
| 12 | Not started | No batch export, ZIP packaging, digital signature, QR code, or post-generation automation exists. |

## 2. Current Architecture

Current implementation lives in `artifacts/escala-generator/src/lib/vertical-export/`.

- `models.ts`: defines the internal contract: header, day schedule, legend, observations, monthly summary, and source schedule reference.
- `mapper.ts`: converts the existing horizontal schedule result into a `VerticalSchedule`.
- `layout.ts`: owns layout keys, frozen coordinates, grid resolution, and the placement plan builder.
- `renderer.ts`: loads the ICA PDF template, draws text into the template, writes PDF output, and exposes the debug renderer.
- `fixtures.ts`: builds synthetic `ScheduleResult` test data.
- `sample.ts`: builds synthetic sample `VerticalSchedule` data for tests and manual inspection.
- `index.ts`: barrel export for the module.

Not present yet, despite being described in the architecture doc:

- `calculator.ts`
- `exporter.ts`
- `config.ts`

## 3. Current Data Flow

Current working pipeline is:

`Horizontal Schedule / ScheduleResult`
-> `mapper.ts`
-> `VerticalSchedule`
-> `layout.ts` builds a `VerticalLayoutPlan`
-> `renderer.ts`
-> `PDF buffer`
-> `writeVerticalSchedulePdfFile(...)` for local output

What is functional now:

- schedule-to-vertical mapping
- frozen layout planning
- PDF rendering
- PDF file output
- debug PDF generation

What is not functional yet:

- real CSV ingestion
- calculator stage
- exporter orchestration layer
- config persistence
- UI integration

## 4. Current Limitations

- No real CSV parser exists yet for the operational schedule source kept outside version control.
- No user-editable operator registry exists.
- No official/current operator code table is implemented.
- No legend dictionary exists for real operational abbreviations.
- `mapper.ts` still generates legend codes sequentially as `A01`, `A02`, etc.
- Hours remain manual/configuration fields; no automatic calculation of `CTOp`, `CTP`, `CTR`, or `CTM`.
- `Escala Cumprida` is not modeled as a real historical workflow.
- Observation automation is not implemented; current observations are manual/sample-driven.
- `layout.ts` contains hardcoded coordinates and legend band math; it is frozen but not abstracted.
- Renderer text fitting is heuristic-based, not layout-aware typography.
- Renderer page selection has template-specific fallback logic.
- There is no separate public exporter API layer yet.
- There is no validation/comparison pipeline against manual ICA output.
- Sample and fixture data are synthetic only, not operational data.
- The current implementation does not render day numbers explicitly; it relies on the clean template for that part.

## 5. Documentation Review

- `docs/VERTICAL_SCHEDULE.MD`: broadly aligned. Milestones 1-6 match the code direction, and milestone 7 is still open. The doc still describes day/table rendering as part of milestone 6, while the current renderer leaves day numbers to the template.
- `docs/VERTICAL_SCHEDULE_REQUIREMENTS.md`: mostly aligned. The model and layout cover the listed fields, but the implementation does not yet express the real operator registry or real legend dictionary. The `MÉDIA HORA MENSAL` pair is correctly treated as manual/configuration data.
- `docs/VERTICAL_EXPORT_ARCHITECTURE.md`: only partially aligned. The core modules exist, but `calculator.ts`, `exporter.ts`, and `config.ts` are still missing, so the documented dependency chain is not fully realized.
- `docs/VERTICAL_EXPORT_REAL_DATA_MAPPING.md`: aligned as a future contract document. It describes the intended real-data rules correctly, but none of the CSV parsing or registry behavior is implemented yet.

Main inconsistencies:

- The architecture doc is ahead of the codebase.
- The requirements doc assumes a more complete legend/operator model than the current mapper provides.
- The roadmap's rendering milestone is functionally present, but the day-number treatment has been intentionally frozen to template-native behavior.

## 6. Next Recommended Milestone

Milestone 7, Horas.

Reason: it is the main unresolved operational rule, it affects exported header data directly, and the project docs already mark it as the point where business-rule validation is required before any automatic derivation. Until that is settled, the hour-related fields remain a manual contract and the exporter cannot become authoritative for real operational output.

## 7. Technical Debt

- Split the currently combined responsibilities in `layout.ts` if the module grows further.
- Add `calculator.ts`, `config.ts`, and `exporter.ts` when the contract stabilizes.
- Replace sequential legend-code generation with registry-driven operator identity.
- Replace heuristic text wrapping with more precise box fitting if longer real data starts overflowing.
- Add explicit template/version validation instead of relying on page-count fallback logic.
- Decide and document whether day numbers remain template-native permanently or become explicit placements later.
