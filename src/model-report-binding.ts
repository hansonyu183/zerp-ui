import type { DraftCollaboration } from "./collaboration";
/** Library-only live-row projection; report validity and authority stay in ReportView. */
export const modelReportBinding: unique symbol = Symbol("zerp.model.report");
export type ModelReportBinding<R, P extends object> = {
  collaboration?: DraftCollaboration<P, unknown>;
  row(row: R): R | undefined;
};

/** Commit model rows only after ReportView has validated the complete result. */
export const modelReportAdoption: unique symbol = Symbol(
  "zerp.model.report.adopt",
);

/** Library-only result interactions, scoped to the adopted fixed result. */
export const modelReportFeedback: unique symbol = Symbol(
  "zerp.model.report.feedback",
);
export type ModelReportFeedback = {
  collaboration: DraftCollaboration<Record<string, unknown>, string>;
};
