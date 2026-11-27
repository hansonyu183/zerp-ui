// 保存当前 App 的模型读取入口，并从模型派生会话范围与页面可用状态。
import { computed, shallowRef } from "vue";
import type { BusinessModel } from "../model/business-model";

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
