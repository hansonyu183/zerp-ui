import type { Fields } from "./contracts";
import type { DomainBlock } from "./domain-blocks";
import type { DraftCollaboration, Interaction } from "./collaboration";
import type {
  OperationAction,
  OperationActionOf,
  OperationModel,
  OperationDefinition,
  OperationIntent,
  OperationOwner,
  OperationSettlement,
} from "./operation";
import type { EditProtection } from "./edit-guard";
import type { PrintDocument } from "./printing";
export type TaskAction = Extract<
  OperationAction,
  | "process"
  | "publish"
  | "restore"
  | "validate"
  | "run"
  | "stop"
  | "import"
  | "preview"
  | "print"
  | "printed"
  | "not-printed"
>;
export type TaskPage<D extends object, M extends OperationModel, I, B> = {
  title: string;
  instance: string | number;
  definition: OperationDefinition<M, I, B>;
  owner: OperationOwner;
  identity: I;
  values: D;
  fields: Fields<D>;
  blocks?: readonly DomainBlock<D>[];
  actions: readonly Extract<OperationActionOf<M>, TaskAction>[];
  toIntent(
    value: D,
    action: Extract<OperationActionOf<M>, TaskAction>,
    original: { owner: OperationOwner; identity: I },
  ): OperationIntent<M, I>;
  eligible: boolean;
  recoveryAllowed: boolean;
  collaboration?: DraftCollaboration<D, unknown>;
  diagnostics?: readonly Interaction<never>[];
  printing?: {
    document: PrintDocument;
    state: "preview" | "opened" | "printed" | "not-printed";
  };
  importResource?: {
    label: string;
    accept: string;
    read(input: { file: File; scope: string; signal: AbortSignal }): Promise<D>;
  };
  downloads?: readonly {
    key: string;
    label: string;
    read(input: {
      scope: string;
      value: D;
      signal: AbortSignal;
    }): Promise<{ content: Blob; filename: string }>;
  }[];
  adopt?: (value: OperationSettlement<M, I, B>) => D | null;
  onSettled?: (value: OperationSettlement<M, I, B>) => void;
  onProtection?: (value: EditProtection) => void;
  component?: never;
  render?: never;
  template?: never;
  slots?: never;
  layout?: never;
  style?: never;
  class?: never;
  css?: never;
};
