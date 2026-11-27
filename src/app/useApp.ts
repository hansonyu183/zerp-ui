// 绑定 App 挂载周期内的模型、工作区路由、操作反馈和会话清理。
import { nextTick, onBeforeUnmount, watch } from "vue";
import type { BusinessModel } from "../model/business-model";
import { startBusinessOperations } from "./operations";
import { releaseNodeIndex } from "./nodes";
import {
  applicationModel,
  applicationReady,
  sessionScope,
  sessionState,
} from "./session";
import { clearReportPositions } from "./work/views/report-position";
import { useWorkRouter } from "./work/work-router";
import { clearReferenceScope } from "../components/forms/reference-directory";

export function useApp(model: () => BusinessModel) {
  // 工作区模块共享当前模型的读取入口，同一运行环境只挂载一个 App。
  if (applicationModel.value) throw Error("同一运行环境只能挂载一个 App。");
  applicationModel.value = model;
  useWorkRouter();
  const { blocking, invalidate, dispose } = startBusinessOperations(model);

  // 阻断消息关闭后，将焦点交回阻断前的控件。
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

  // 同步使旧会话和旧工作区的读取、忙碌及反馈状态失效，再呈现新范围。
  const stopScopeWatch = watch(
    [
      model,
      sessionScope,
      sessionState,
      () => (applicationReady.value ? model().work : undefined),
    ],
    (_current, previous) => {
      clearReferenceScope(previous[1]);
      invalidate(true);
      clearReportPositions(true);
    },
    { flush: "sync" },
  );
  // 释放旧作用域的引用目录、操作状态及节点索引，允许重新挂载。
  onBeforeUnmount(() => {
    stopScopeWatch();
    clearReferenceScope(sessionScope.value);
    dispose();
    clearReportPositions(true);
    applicationModel.value = undefined;
    releaseNodeIndex();
  });

  // App 用 ready 选页，用 blocking 暂停页面交互。
  return { ready: applicationReady, blocking };
}
