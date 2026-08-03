# Vertical Export Plan

## Goal

Implement an ICA 63-33 vertical schedule exporter that converts the existing horizontal schedule result into a document matching the official vertical template.

This plan is intentionally split into small, independent milestones so each step can be validated before moving forward.

## Current Starting Point

- The scheduler already produces a rich `ScheduleResult` with per-employee rows, per-day assignments, warnings, violations, metrics, and alternatives.
- The UI already exports the current schedule to XLSX through `artifacts/escala-generator/src/lib/excel.ts`.
- The repository already includes ICA guidance in `docs/VERTICAL_SCHEDULE.MD` and the official editable DOCX template in `assets/`.

## Milestone 1: Extract the vertical document requirements

Deliverables:

- A field inventory for the ICA form.
- A coordinate or layout map for all template regions.
- A list of data sources for every field, classified as configuration, derived, or manual input.

Exit criteria:

- Every visible section of the PDF has a named owner in the plan.
- We know which fields can be derived from `ScheduleResult` and which need new configuration.

## Milestone 2: Define the vertical schedule domain model

Deliverables:

- A dedicated internal model for the vertical export, separate from the horizontal scheduler output.
- Explicit structures for header data, day blocks, legend entries, observations, and change log sections.
- Validation rules for required fields and fallback behavior when source data is incomplete.

Exit criteria:

- The vertical model can be built without rendering a PDF.
- The model can be serialized or inspected for debugging.

## Milestone 3: Build the horizontal-to-vertical transformation

Deliverables:

- A transformer from `ScheduleResult` to the vertical export model.
- Rules for mapping operators to codes, shifts to vertical cells, and absences to observations.
- Computation of legend rows and daily annotations.

Exit criteria:

- A sample `ScheduleResult` can be converted into a complete vertical model.
- The transformation can be tested independently from PDF generation.

## Milestone 4: Capture ICA header and metadata inputs

Deliverables:

- A configuration source for ICA metadata such as CRCEA, locality, organization, escalator, chief, total staff, and workload-related fields.
- A clear distinction between static settings, monthly values, and derived fields.
- A minimal UI or config layer decision for collecting these values later.

Exit criteria:

- The export flow knows where every header field comes from.
- Missing optional fields degrade gracefully instead of blocking export.

## Milestone 5: Implement PDF rendering against the ICA template

Deliverables:

- A rendering layer that places the vertical model onto the template.
- Positioning for header, daily grid, legend, observations, and signatures.
- Basic support for page layout, clipping, and text wrapping where needed.

Exit criteria:

- A generated PDF visually resembles the ICA template.
- The same input produces deterministic output.

## Milestone 6: Add validation and visual comparison checks

Deliverables:

- A reference checklist for manual verification against the official PDF.
- Automated tests for transformation logic.
- A regression check for layout assumptions when the template changes.

Exit criteria:

- We can detect when the vertical mapping breaks before it reaches users.
- Core logic is covered by deterministic tests.

## Milestone 7: Integrate export into the application

Deliverables:

- An export entry point in the UI alongside the existing XLSX export.
- File naming and download behavior aligned with current schedule history patterns.
- Error handling and user feedback for failed exports.

Exit criteria:

- A generated schedule can be exported to vertical ICA format from the app.
- The export is available without breaking the current XLSX flow.

## Milestone 8: Support operational refinements

Deliverables:

- Handling for observations such as vacations, leave, training, and operational maintenance.
- Support for the “escala cumprida” and change log sections if the workflow requires them.
- A path to support alternate ICA templates later without rewriting the core model.

Exit criteria:

- The exporter is useful for real operational use, not only for a static demo.
- Template-specific logic is isolated from business data transformation.

## Recommended Implementation Order

1. Finalize the ICA field and coordinate map.
2. Define the vertical model.
3. Build the transformer from scheduler output.
4. Add header/config data.
5. Render the PDF.
6. Test and compare against the ICA template.
7. Wire the export into the UI.
8. Refine operational details and alternate template support.

## Notes

- Keep the vertical exporter independent from the scheduler so future ICA changes do not force algorithm changes.
- Prefer deriving as much as possible from the existing `ScheduleResult` before introducing new manual inputs.
- Treat the official template PDF as the source of truth for layout, but keep the data model source-agnostic enough to support future versions.
