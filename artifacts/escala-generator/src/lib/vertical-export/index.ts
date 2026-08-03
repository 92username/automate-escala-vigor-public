export type {
  VerticalScheduleConversionOptions,
  VerticalSchedule,
  VerticalScheduleDayCell,
  VerticalScheduleDaySchedule,
  VerticalScheduleDiagnostic,
  VerticalScheduleDiagnosticSeverity,
  VerticalScheduleFieldResponsibility,
  VerticalScheduleFieldSource,
  VerticalScheduleHeaderInput,
  VerticalScheduleHeader,
  VerticalScheduleLegendEntry,
  VerticalScheduleMonthlySummary,
  VerticalScheduleObservationEntry,
  VerticalScheduleOffEntry,
  VerticalScheduleSectionKey,
  VerticalScheduleSourceReference,
  VerticalScheduleShiftEntry,
} from "./models";
export { convertScheduleToVerticalSchedule } from "./mapper";
export type { RealScheduleToVerticalScheduleOptions } from "./real-schedule-to-vertical";
export {
  buildAutomaticVerticalScheduleObservations,
  convertRealScheduleParseResultToVerticalSchedule,
  formatVerticalOperatorName,
} from "./real-schedule-to-vertical";
export { createVerticalScheduleFixture } from "./fixtures";
export type {
  RealScheduleCsvCellKind,
  RealScheduleCsvCellValue,
  RealScheduleCsvDayColumn,
  RealScheduleCsvMonthBlock,
  RealScheduleCsvMonthHeader,
  RealScheduleCsvMonthRange,
  RealScheduleCsvOperatorRow,
  RealScheduleCsvOperatorRowsOptions,
  RealScheduleCsvParseResult,
  RealScheduleCsvParserOptions,
  RealScheduleCsvSelectedMonth,
  RealScheduleCsvUnknownCode,
  RealScheduleCsvUnknownOperator,
} from "./real-schedule-parser";
export { parseRealScheduleCsv } from "./real-schedule-parser";
export type {
  VerticalOperatorGroup,
  VerticalOperatorRegistryEntry,
  VerticalOperatorRegistryStatus,
  VerticalOperatorUpsertInput,
} from "./operator-registry";
export {
  VERTICAL_OPERATOR_REGISTRY,
  createVerticalOperatorRegistry,
  deactivateOperator,
  findOperatorByCode,
  findOperatorByName,
  findOperatorsByName,
  listActiveOperators,
  upsertOperator,
} from "./operator-registry";
export type {
  VerticalLegendDictionaryEntry,
  VerticalLegendDictionaryExactEntry,
  VerticalLegendDictionaryMatch,
  VerticalLegendDictionaryPatternEntry,
  VerticalLegendMatchKind,
} from "./legend-dictionary";
export {
  VERTICAL_LEGEND_DICTIONARY,
  lookupLegendMeaning,
  matchLegendDictionaryEntry,
} from "./legend-dictionary";
export type {
  FillVerticalScheduleDocxTemplateOptions,
  FillVerticalScheduleDocxTemplateResult,
  VerticalDocxTemplateStructureSummary,
  VerticalDocxTemplateTableSummary,
} from "./docx-template-filler";
export {
  DEFAULT_VERTICAL_SCHEDULE_DOCX_OUTPUT_PATH,
  ICA_VERTICAL_DOCX_TEMPLATE_ASSET_PATH,
  fillVerticalScheduleDocxTemplate,
  inspectVerticalScheduleDocxTemplate,
  loadOfficialIcaVerticalTemplateDocx,
} from "./docx-template-filler";
export type {
  RealDocxPipelineResult,
  RealDocxPipelineSummary,
} from "./docx-real-pipeline";
export {
  DEFAULT_REAL_VERTICAL_SCHEDULE_DOCX_OUTPUT_PATH,
  REAL_VERTICAL_SCHEDULE_CSV_ASSET_PATH,
  generateRealVerticalScheduleDocx,
  normalizeRealScheduleCsvForVerticalParser,
} from "./docx-real-pipeline";
