import type {
  OperationModel,
  OperationDefinition,
  OperationIntent,
  OperationOwner,
  OperationSettlement,
} from "./operation";
import type { EditProtection } from "./edit-guard";
export type BatchEntry<M extends OperationModel, I> = {
  key: string;
  label: string;
  intent: OperationIntent<M, I>;
};
export type BatchJournal<M extends OperationModel, I, B> = {
  id: string;
  owner: OperationOwner;
  entries: readonly (BatchEntry<M, I> & {
    settlement?: OperationSettlement<M, I, B>;
    skipped?: true;
  })[];
  index: number;
  completed?: true;
};
export type BatchPersistence<M extends OperationModel, I, B> = {
  load(owner: OperationOwner): Promise<BatchJournal<M, I, B> | null>;
  save(
    journal: BatchJournal<M, I, B>,
    expectedId: string | null,
  ): Promise<void>;
};
export type BatchPage<M extends OperationModel, I, B> = {
  title: string;
  owner: OperationOwner;
  definition: OperationDefinition<M, I, B>;
  entries: readonly BatchEntry<M, I>[];
  persistence: BatchPersistence<M, I, B>;
  eligible: boolean;
  recoveryAllowed: boolean;
  onProtection?: (state: EditProtection) => void;
  component?: never;
  render?: never;
  template?: never;
  slots?: never;
  layout?: never;
  style?: never;
  class?: never;
  css?: never;
};
