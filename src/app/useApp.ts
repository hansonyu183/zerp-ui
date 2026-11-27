// 绑定 App 挂载周期内的模型、工作区路由、操作反馈和会话清理。
import { onBeforeUnmount } from "vue";
import type { BusinessModel } from "../model/business-model";
import { startFeedback } from "./feedback";
import { releaseNodeIndex } from "./nodes";
import { applicationReady, bindSession } from "./session";
import { clearReportPositions } from "./work/report-position";
import { clearReads } from "./work/reads";
import { useWorkRouter } from "./work/work-router";
import { clearReferenceScope } from "../components/forms/reference-directory";

export function useApp(model: () => BusinessModel) {
  const releaseSession = bindSession(model, (scope) => {
    clearReferenceScope(scope);
    clear();
    clearReads();
    clearReportPositions(true);
  });
  useWorkRouter();
  const { blocking, clear } = startFeedback(model);
  onBeforeUnmount(() => {
    releaseSession();
    releaseNodeIndex();
  });

  // App 用 ready 选页，用 blocking 暂停页面交互。
  return { ready: applicationReady, blocking };
}
