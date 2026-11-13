import type { Interaction } from "./collaboration";
import type {
  ObjectShape,
  ModelValue,
  ModelRead,
  NodeAncestors,
  ModelNode,
  ModelLocalIntent,
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
    interactions?: readonly Interaction<ModelLocalIntent<ModelValue<Q>>>[];
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
    ReportPage<N, string> & {
      summary?: ReportSummary<ModelValue<N>>;
      interactions?: readonly Interaction<ModelLocalIntent<ModelValue<Q>>>[];
    }
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
