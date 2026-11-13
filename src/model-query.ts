import type {
  ObjectShape,
  ModelValue,
  ModelRead,
  NodeAncestors,
  ModelNode,
} from "./reactive-model";
import type {
  ReportPage,
  ReportSummary,
  ReportValidity,
  ReportCancellation,
} from "./report";
export type ModelQuery<
  N extends ObjectShape,
  Q extends ObjectShape,
  R = string,
> = ModelRead<
  ModelValue<Q>,
  ReportPage<N, string> & {
    id: R;
    summary: ReportSummary<ModelValue<N>>;
    context: string;
  },
  null,
  NodeAncestors<N>
> & {
  input?: Q;
  page(context: {
    resultId: R;
    page: number;
    pageSize: number;
    signal: AbortSignal;
  }): Promise<
    ReportPage<N, string> & { summary?: ReportSummary<ModelValue<N>> }
  >;
  revalidate(context: {
    resultId: R;
    signal: AbortSignal;
  }): Promise<ReportValidity>;
  cancel?(context: { requestId: string }): Promise<ReportCancellation>;
  /** Navigation facts point to an existing model node; they never execute a write. */
  drill?(
    row: N,
    field: Extract<keyof ModelValue<N>, string>,
  ): { node: ModelNode; identity?: unknown } | undefined;
};
