/** Library-only seam between model projection and the existing CRUD lifecycle. */
export const modelBinding: unique symbol = Symbol("zerp.model.binding");
export type ModelCrudBinding<D, R, I> = {
  ready(): boolean;
  key(row: R): string;
  draft(value: D, identity?: I): void;
  row(row: R): R | undefined;
  detail(identity: I): D | undefined;
  disabled(
    action: "query" | "create" | "save",
    identity?: I,
  ): string | undefined;
};
