export type ReportSummary<R> = { caption: string; values: Partial<R> };
/** Finite presentation facts; all amounts and subtotals are supplied by the consumer. */
export type ReportAppearance = {
  foreground?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
};
export type ReportPresentation<
  R,
  K extends string | number = string | number,
> = {
  rows: readonly {
    rowId: K;
    appearance?: ReportAppearance;
    cells?: Partial<Record<Extract<keyof R, string>, ReportAppearance>>;
  }[];
  groups: readonly {
    id: string;
    label: string;
    level: number;
    firstKey: K;
    lastKey: K;
    continuedBefore: boolean;
    continuedAfter: boolean;
    summary: ReportSummary<R>;
  }[];
};
