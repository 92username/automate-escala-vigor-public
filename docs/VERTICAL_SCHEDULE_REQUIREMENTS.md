# ICA 63-33 Vertical Schedule Requirements

This document captures the results of milestone 1 for the ICA 63-33 vertical exporter:

- field inventory
- source classification
- logical layout map of the official template

Reference source:

- [ICA_63-33_Escala_Vertical_Template_CLEAN.docx](../assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx)

## Scope

The official form is described in two relevant areas:

- Annex A: fill instructions and field semantics.
- Annex B: the vertical schedule form itself, including the monthly grid, legend, observations, and signature blocks.

This milestone does not implement rendering or data transformation. It only defines what the exporter must be able to place on the template.

## Field Inventory

Legend:

- Required: yes/no for the export to be considered complete.
- Editable: whether the value is expected to come from user/configuration input instead of being derived.
- Origin: where the value should come from in the system.
- Responsibility: who owns the value generation or maintenance.

| Field Key | Form Label | Page / Section | Required | Editable | Origin | Responsibility | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `header.crcea` | CRCEA-SE / CINDACTA | Annex B header | Yes | Yes | Configuration | Usuário | Regional organization responsible for the operational unit. |
| `header.localidade` | LOCALIDADE | Annex B header | Yes | Yes | Configuration | Usuário | City and state. |
| `header.orgao` | ÓRGÃO | Annex B header | Yes | Yes | Configuration | Usuário | Operational unit and location indicator. |
| `header.monthYear` | ESCALA DO MÊS/ANO | Annex B header | Yes | No | Derived | Sistema | From schedule year and month. |
| `header.totalStaff` | EFETIVO TOTAL | Annex A / Annex B header | Yes | No | Derived | Sistema | Total personnel belonging to the operational unit. |
| `header.scheduleStaff` | EFETIVO DA ESCALA | Annex A / Annex B header | Yes | No | Derived | Sistema | Personnel included in the schedule. |
| `header.monthlyWorkloadBase` | MÉDIA HORA MENSAL — carga mensal base | Annex A / Annex B header | Yes | Yes | Configuration/manual until operational rule is confirmed | Usuário | First value in examples such as `144/152`. Do not derive until the ICA rule is validated with a real example or operational authority. |
| `header.averageMonthlyHours` | MÉDIA HORA MENSAL — média mensal trabalhada | Annex A / Annex B header | Yes | Yes | Configuration/manual until operational rule is confirmed | Usuário | Second value in examples such as `144/152`. Do not derive until the ICA rule is validated with a real example or operational authority. |
| `header.monthlyAverageHours` | MÉDIA HORA MENSAL | Annex A / Annex B header | Yes | Yes | Configuration/manual until operational rule is confirmed | Usuário | Display string rendered in the current form, normally composed manually as `monthlyWorkloadBase/averageMonthlyHours`. |
| `header.trainingHours` | HORA INSTRUÇÃO | Annex A / Annex B header | No | Yes | Configuration or derived | Usuário / Sistema | Instruction hours for operators. |
| `header.escalante` | ESCALANTE | Annex A / Annex B footer | Yes | Yes | Configuration | Usuário | Name/rank and signature owner. |
| `header.headOfOrg` | CHEFE DO ÓRGÃO | Annex A / Annex B footer | No | Yes | Configuration | Usuário | Name/rank and signature owner. |
| `header.headOfDivision` | CHEFE DA DIV OPR CRCEA-SE / CINDACTA | Annex A / Annex B footer | No | Yes | Configuration | Usuário | Name/rank and signature owner. |
| `calendar.dayNumbers` | DIA DO MÊS / SEM | Annex B grid | Yes | No | Derived | Sistema | One column per day of the month. |
| `calendar.weekdays` | Day-of-week row | Annex B grid | Yes | No | Derived | Sistema | Short weekday labels. |
| `calendar.shiftA` | 1º TURNO / row cells | Annex B grid | Yes | No | Horizontal schedule result | Sistema | Cells for shift A assignments. |
| `calendar.shiftINT` | 2º TURNO / row cells | Annex B grid | Yes | No | Horizontal schedule result | Sistema | Cells for shift INT assignments. |
| `calendar.shiftB` | 3º TURNO / row cells | Annex B grid | Yes | No | Horizontal schedule result | Sistema | Cells for shift B assignments. |
| `calendar.off` | FOLGA | Annex B grid | Yes | No | Horizontal schedule result | Sistema | Operators not assigned to a shift on that day. |
| `calendar.observation` | OBSERVAÇÃO | Annex B grid | No | Yes | Schedule result plus annotations | Sistema / Usuário | Day-level notes if needed. |
| `legend.code` | CÓD | Annex B legend | Yes | No | Derived | Sistema | Short code assigned to each operator or team. |
| `legend.operator` | OPERADOR/EQUIPE | Annex B legend | Yes | No | Employee roster | Sistema | Rank, name, or team member label. |
| `observations.freeText` | ESPAÇO RESERVADO PARA OBSERVAÇÕES QUE SE FAÇAM NECESSÁRIAS | Annex B observations block | No | Yes | Manual or derived | Usuário / Sistema | Used for vacations, leave, course, maintenance, and other notes. |
| `changes.freeText` | ALTERAÇÕES NA ESCALA | Annex B changes block | No | Yes | Manual or derived | Usuário / Sistema | Only for the “escala cumprida” workflow. |
| `signatures.escalante` | ASS. | Annex A / Annex B footer | Yes | Yes | Configuration | Usuário | Signature representation placeholder. |

## Derived Values

These values should be computed from the current schedule output when possible:

- `header.monthYear`
- `header.totalStaff`
- `header.scheduleStaff`
- `calendar.dayNumbers`
- `calendar.weekdays`
- `calendar.shiftA`
- `calendar.shiftINT`
- `calendar.shiftB`
- `calendar.off`
- `legend.code`
- `legend.operator`

These values may require configuration before they can be exported faithfully:

- `header.crcea`
- `header.localidade`
- `header.orgao`
- `header.monthlyWorkloadBase`
- `header.averageMonthlyHours`
- `header.monthlyAverageHours`
- `header.trainingHours`
- `header.escalante`
- `header.headOfOrg`
- `header.headOfDivision`

## Mandatory vs Optional Fields

### Mandatory

- `header.crcea`
- `header.localidade`
- `header.orgao`
- `header.monthYear`
- `header.totalStaff`
- `header.scheduleStaff`
- `header.escalante`
- `calendar.dayNumbers`
- `calendar.weekdays`
- `calendar.shiftA`
- `calendar.shiftINT`
- `calendar.shiftB`
- `calendar.off`
- `legend.code`
- `legend.operator`
- `signatures.escalante`

### Optional

- `header.monthlyWorkloadBase`
- `header.averageMonthlyHours`
- `header.monthlyAverageHours`
- `header.trainingHours`
- `header.headOfOrg`
- `header.headOfDivision`
- `calendar.observation`
- `observations.freeText`
- `changes.freeText`

## Source Mapping

The exporter should treat the following source relationships as stable assumptions:

| Field Group | Source |
| --- | --- |
| Operators | Horizontal schedule |
| Turn assignments | Horizontal schedule |
| Folgas | Horizontal schedule |
| Legend | Converter / code assignment logic |
| Observations | Configuration + operational events |
| Hours | Configuration/manual until operational rule is confirmed; later Calculator |
| Header organization fields | Configuration |
| Month/year | Schedule context |

## Dependencies

The following dependency chains should be respected by the implementation:

- Legend depends on the operator roster, but not on the daily turn assignments.
- Daily turn rows depend on the schedule result, but not on the legend layout.
- Observation text depends on operational events and annotations, not on the PDF template.
- Hour fields depend on the schedule and business rules, not on the template coordinates.
- Header fields depend on configuration plus schedule context, not on the scheduler internals.

## Acceptance Criteria

Milestone 1 is considered complete only when all of the following are true:

- All visible fields from the ICA 63-33 template are cataloged.
- Every field has origin, responsibility, and required/optional classification.
- All relevant sections of the PDF have a logical layout key.
- The source mapping and dependency chains are documented.
- No runtime code for export, mapping, or rendering has been implemented.
- The document is stable enough to guide later milestones without reinterpretation.

## Logical Layout Map

The current milestone maps the document by logical region rather than exact x/y coordinates. Exact placement can be refined in the rendering milestone after the data contract is frozen.

### Page 1: Instructions / Annex A

- `annexA.header`: ICA title and section heading.
- `annexA.fieldDescriptions`: explanatory text for CRCEA, locality, organization, month/year, effective counts, workload, training hours, and signature roles.
- `annexA.signatureBlocks`: escalante and chief signature references.
- `annexA.changeLogIntro`: introduction to the “ALTERAÇÕES NA ESCALA” section.

### Page 2: Monthly Vertical Form / Annex B

- `annexB.topHeader`: CRCEA, locality, organization, month/year, total staff, average hours, training hours.
- `annexB.calendarHeader`: day-of-month row and weekday row.
- `annexB.shiftRows`: rows for 1º turno, 2º turno, and 3º turno.
- `annexB.offRow`: folga row.
- `annexB.observationRow`: observation row.
- `annexB.footerHeader`: escalante and chief names/signatures.
- `annexB.legend`: operator code legend.
- `annexB.observationsBox`: free-form observations area.
- `annexB.changesBox`: changes area for the fulfilled schedule.

### Page 3: Continuation / Annex B

- `annexBContinuation.observationsBox`: continuation of the observations area.
- `annexBContinuation.changesBox`: continuation of the changes area.

## Machine-Readable Layout Keys

The following key set can be used later as stable identifiers for the renderer:

```text
header.crcea
header.localidade
header.orgao
header.monthYear
header.totalStaff
header.scheduleStaff
header.monthlyAverageHours
header.trainingHours
header.escalante
header.headOfOrg
header.headOfDivision
calendar.dayNumbers
calendar.weekdays
calendar.shiftA
calendar.shiftINT
calendar.shiftB
calendar.off
calendar.observation
legend.code
legend.operator
observations.freeText
changes.freeText
signatures.escalante
```

## Open Questions Captured in Milestone 1

- The ICA text defines `MÉDIA HORA MENSAL` as: "Carga de trabalho mensal base prevista para o órgão e a média mensal de horas trabalhadas no órgão operacional, levando-se em conta as cargas de trabalho de todo o efetivo operacional do mês, inclusive em realização de manutenção operacional ou que não tenha estado disponível ao longo de todo o mês. Ex.: 144/152."
- The exact calculation rule for `monthlyWorkloadBase` and `averageMonthlyHours` is pending validation. Until then, both values are configuration/manual fields and must not be derived from the generated schedule.
- `HORA INSTRUÇÃO` may be a manual configuration or a derived operational total depending on the workflow.
- The template includes an “escala cumprida” change area, but the current export scope may initially target only the planned schedule.
- The exact coordinates for each region still need a rendering pass or visual trace against the PDF template.
- Before Milestone 7 starts, `monthlyWorkloadBase` and `averageMonthlyHours` must be validated against a real ICA example or by an operational authority.

## Architecture Guide

See [VERTICAL_EXPORT_ARCHITECTURE.md](VERTICAL_EXPORT_ARCHITECTURE.md) for the proposed module organization that will guide the remaining milestones.

## Milestone 1 Output

This document is the deliverable for milestone 1. It gives the exporter team a stable list of fields and layout regions to implement in later milestones.
