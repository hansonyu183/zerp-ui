import type { ComputedRef, InjectionKey } from "vue";
/** Private rendering context: only controls for the admitted original may remain. */
export const modelRecoveryOnlyKey: InjectionKey<ComputedRef<boolean>> = Symbol(
  "zerp.model.recovery-only",
);
