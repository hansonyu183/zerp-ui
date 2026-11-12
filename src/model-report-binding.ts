import type { DraftCollaboration } from "./collaboration";
/** Library-only live-row projection; report validity and authority stay in ReportView. */
export const modelReportBinding: unique symbol = Symbol("zerp.model.report");
export type ModelReportBinding<R, P extends object> = {
  collaboration?: DraftCollaboration<P, unknown>;
  row(row: R): R | undefined;
};
