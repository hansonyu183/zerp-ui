import { computed, shallowRef } from "vue";
import type { BusinessModel } from "./business-model";

export const applicationModel = shallowRef<() => BusinessModel>();
export const currentModel = computed(() => applicationModel.value?.());
export const sessionState = computed(() => currentModel.value?.session.state);
export const sessionScope = computed(() => {
  const owner = currentModel.value?.session.owner;
  return owner
    ? JSON.stringify([owner.ledger, owner.operator, owner.generation])
    : "";
});
export const applicationReady = computed(() => {
  const session = currentModel.value?.session;
  return (
    !!session?.owner &&
    (session.state === "ready" || session.state === "password-required")
  );
});
export const modelVersion = computed(() => {
  void currentModel.value;
  return Symbol();
});
