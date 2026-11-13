/** Library-only seam between model projection and the existing CRUD lifecycle. */
export const modelBinding: unique symbol = Symbol("zerp.model.binding");
export type ModelCrudBinding<D, R, I> = {
  ready(): boolean;
  guard?(requestLeave: () => Promise<boolean>): () => void;
  key(row: R): string;
  recordKey(identity: I): string;
  navigationActive(): boolean;
  draft(value: D, identity?: I): void;
  row(row: R): R | undefined;
  detail(identity: I): D | undefined;
  disabled(
    action: "query" | "create" | "save",
    identity?: I,
  ): string | undefined;
};
