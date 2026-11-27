import type { InjectionKey, ShallowRef } from "vue";
export const feedbackTargetKey: InjectionKey<ShallowRef<HTMLElement | null>> =
  Symbol("feedback-target");
