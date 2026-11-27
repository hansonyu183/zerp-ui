// 保存当前 App 的模型读取入口，并从模型派生会话范围与页面可用状态。
import { computed, shallowRef, watch } from "vue";
import type { BusinessModel } from "../model/business-model";

const version = shallowRef(0);
const modelSource = shallowRef<() => BusinessModel>();

export const sessionVersion = computed(() => version.value);
export const applicationModel = computed(() => modelSource.value);
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

// 统一使旧会话、根模型或工作区失效，并在卸载时释放唯一的模型入口。
export function bindSession(
  model: () => BusinessModel,
  reset: (scope: string) => void,
) {
  if (modelSource.value) throw Error("同一运行环境只能挂载一个 App。");
  modelSource.value = model;
  function invalidate(scope: string) {
    version.value++;
    reset(scope);
  }
  const stop = watch(
    [
      model,
      sessionScope,
      sessionState,
      () => (applicationReady.value ? model().work : undefined),
    ],
    (_current, previous) => invalidate(previous[1]),
    { flush: "sync" },
  );
  return () => {
    stop();
    invalidate(sessionScope.value);
    modelSource.value = undefined;
  };
}
