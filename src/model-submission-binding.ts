/** Library-only projection applied before freezing a submission original. */
export const modelSubmissionBinding: unique symbol = Symbol(
  "zerp.model.submission-input",
);
export type ModelSubmissionBinding<D> = { input(value: D): D };
