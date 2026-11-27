import { nextTick, onBeforeUnmount, watch } from "vue";
import type { BusinessModel } from "./business-model";
import { startBusinessOperations } from "./business-operations";
import { releaseNodeIndex } from "./business-nodes";
import {
  applicationModel,
  applicationReady,
  sessionScope,
  sessionState,
} from "./business-session";
import { useWorkRouter } from "./work-router";
import { clearReferenceScope } from "./reference-directory";

export function useBusinessApplication(model: () => BusinessModel) {
  if (applicationModel.value)
    throw Error("同一运行环境只能挂载一个 BusinessApplication。");
  applicationModel.value = model;
  useWorkRouter();
  const { blocking, invalidate, dispose } = startBusinessOperations(model);

  let returnFocus: HTMLElement | undefined;
  watch(blocking, (message, previous) => {
    if (message && !previous) {
      const active = document.activeElement;
      returnFocus = active instanceof HTMLElement ? active : undefined;
    }
    if (!message && previous) {
      const trigger = returnFocus;
      returnFocus = undefined;
      void nextTick(() => {
        if (!blocking.value && trigger?.isConnected)
          trigger.focus({ preventScroll: true });
      });
    }
  });

  watch(
    [
      model,
      sessionScope,
      sessionState,
      () => (applicationReady.value ? model().work : undefined),
    ],
    (_current, previous) => {
      clearReferenceScope(previous[1]);
      invalidate(true);
    },
    { flush: "sync" },
  );
  onBeforeUnmount(() => {
    clearReferenceScope(sessionScope.value);
    dispose();
    applicationModel.value = undefined;
    releaseNodeIndex();
  });

  return { ready: applicationReady, blocking };
}
