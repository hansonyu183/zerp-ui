/** Library-only qualification seam for model-driven local preparation. */
export const modelVoucherBinding: unique symbol = Symbol("zerp.model.voucher");
export type ModelVoucherBinding = {
  create(): string | undefined;
  clone(): string | undefined;
};
