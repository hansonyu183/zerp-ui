<script setup lang="ts">
// 协调当前页面、侧栏导航、账户入口和记录窗口。集合内部交互由各视图处理。
import { clearReportPositions, saveReportPosition } from "./report-position";
import { feedbackForApplication, runWithFeedback } from "../feedback";
import { readCollection, readRecord, readWorkbench } from "./reads";
import {
  applicationModel,
  applicationReady,
  currentModel,
  sessionScope,
  sessionState,
  sessionVersion,
} from "../session";
import {
  isCollection,
  readable as nodeReadable,
  workbenchReadable,
} from "../nodes";
import { computed, reactive, ref, toRaw, watch } from "vue";
import type {
  BusinessModel,
  ListCollection,
  CollectionTarget,
  ObjectNode,
} from "../../model/business-model";
import {
  homeHref,
  resolveWorkUrl,
  workHome,
  goToCollection,
  routePath,
  routeReady,
  routedCollection,
  targetHref,
} from "./work-router";
import RecordWindows from "./dialogs/RecordWindows.vue";
import { useRecordWindows, type RecordRequest } from "./dialogs/record-windows";
import { availableTarget } from "../target";
import CollectionView from "./views/CollectionView.vue";
import Node from "../../components/nodes/Node.vue";
import DomainView from "./views/DomainView.vue";
import WorkbenchView from "./views/WorkbenchView.vue";
import WorkLayout from "./WorkLayout.vue";
import WorkNavigation from "./WorkNavigation.vue";
import WorkToolbar from "./WorkToolbar.vue";
import ModelFeedback from "../ModelFeedback.vue";
import { modelBrand, type ThemeChoice } from "../../styles/theme";
import { useWorkNavigation, type AccountIntent } from "./navigation";
import { collectionEntries } from "./structure";

const props = defineProps<{
  model: BusinessModel["work"];
  brand: BusinessModel["brand"];
  theme: ThemeChoice;
}>();
const emit = defineEmits<{ "update:theme": [ThemeChoice] }>();
const brand = computed(() => modelBrand(props.brand));
// 记录窗口属于工作页，切换集合路由时仍由同一工作页管理。
const windows = useRecordWindows();
const {
  entries: navigationEntries,
  homeKey,
  navigation,
} = useWorkNavigation(() => props.model.workbench);
const accountView = ref<ObjectNode | null>(null);
const current = computed<ListCollection | null>(() =>
  routedCollection.value && nodeReadable(routedCollection.value)
    ? routedCollection.value
    : null,
);
const workbench = computed(() => {
  const home = props.model.workbench;
  if (routePath.value === workHome && home && workbenchReadable(home))
    return home;
});
const notFound = computed(
  () => routePath.value !== workHome && !routedCollection.value,
);
watch(
  [
    routePath,
    navigationEntries,
    () => props.model.workbench,
    applicationReady,
    sessionState,
    routeReady,
  ],
  () => {
    if (
      !routeReady.value ||
      routePath.value !== workHome ||
      !applicationReady.value ||
      sessionState.value !== "ready" ||
      props.model.workbench
    )
      return;
    const first = navigationEntries.value[0]?.target;
    if (first) goToCollection(first);
  },
  { immediate: true },
);
const selectedKey = computed(() => {
  if (activeAccountView.value) return null;
  if (!current.value) return workbench.value ? homeKey.value : null;
  return (
    navigationEntries.value.find((entry) =>
      entry.collections.includes(current.value!),
    )?.key ?? null
  );
});
function visitKey(key: string) {
  if (!applicationReady.value || sessionState.value !== "ready") return;
  if (key === homeKey.value && props.model.workbench) {
    visitHome();
    return;
  }
  const entry = navigationEntries.value.find((entry) => entry.key === key);
  if (entry && nodeReadable(entry.target)) {
    accountView.value = null;
    goToCollection(entry.target);
  }
}
const accountActions = computed<AccountIntent[]>(() => {
  const { account } = props.model;
  const actions: AccountIntent[] = [];
  if (nodeReadable(account.profile)) actions.push("profile");
  if (nodeReadable(account.password)) actions.push("change-password");
  if (!account.operations.signOut.disabled) actions.push("sign-out");
  return actions;
});
const activeAccountView = computed(() =>
  accountView.value && nodeReadable(accountView.value)
    ? accountView.value
    : null,
);
const target = computed(() => {
  if (sessionState.value === "password-required") {
    const password = props.model.account.password;
    return nodeReadable(password) ? password : null;
  }
  return activeAccountView.value ?? current.value;
});
const pageDomain = computed(() => {
  const collection = current.value;
  if (
    !collection ||
    activeAccountView.value ||
    sessionState.value === "password-required"
  )
    return;
  return collectionEntries.value.find(
    (entry) =>
      entry.collection === collection &&
      entry.domain &&
      entry.domain.members.length > 1,
  )?.domain;
});
const pageTarget = computed(() => pageDomain.value ?? target.value);
const pageWorkbench = computed(() =>
  pageTarget.value || sessionState.value !== "ready"
    ? undefined
    : workbench.value,
);
// 页面目标或会话范围改变时重建视图，避免复用上一页面的局部状态。
const pageGeneration = ref(0);
watch(
  [pageTarget, pageWorkbench, sessionVersion],
  () => pageGeneration.value++,
  {
    flush: "sync",
  },
);
const passwordAction = computed(() => {
  const { password, operations } = props.model.account;
  if (target.value !== password) return;
  return {
    name: "changePassword",
    disabled: operations.changePassword.disabled,
    run: changePassword,
  };
});
function changePassword() {
  const { password, operations } = props.model.account;
  const operation = operations.changePassword;
  if (operation.disabled) return;
  const identity = password.identity;
  return runWithFeedback(
    password,
    () => operation.run(),
    () =>
      currentModel.value?.work.account.password === password &&
      currentModel.value.work.account.operations.changePassword === operation &&
      password.identity === identity &&
      nodeReadable(password),
    password,
  );
}
async function accountAction(action: AccountIntent) {
  if (action === "sign-out") {
    const application = applicationModel.value;
    const account = props.model.account;
    const operation = account.operations.signOut;
    if (operation.disabled) return;
    await runWithFeedback(
      account,
      () => operation.run(),
      () =>
        applicationReady.value &&
        currentModel.value?.work.account === account &&
        account.operations.signOut === operation,
    );
    if (
      applicationModel.value === application &&
      currentModel.value?.session.state === "anonymous"
    )
      goToCollection();
    return;
  }
  const node =
    action === "profile"
      ? props.model.account.profile
      : props.model.account.password;
  if (nodeReadable(node)) accountView.value = node;
}
watch(
  current,
  (_current, previous) => {
    if (previous?.report && applicationReady.value && nodeReadable(previous))
      saveReportPosition(previous, {
        left: window.scrollX,
        top: window.scrollY,
      });
  },
  { flush: "sync" },
);
function openCurrentRecord(request: RecordRequest) {
  if (routedCollection.value && routedCollection.value !== request.collection)
    return;
  windows.open(request);
}
function openRecordTarget(
  collection: ListCollection,
  record: ObjectNode,
  resolvedId?: string,
) {
  const trigger = document.activeElement;
  return windows.open({
    collection,
    record: reactive(record),
    mode: "read",
    resolvedId,
    focus: () => (trigger instanceof HTMLElement ? trigger : null),
  });
}

// 集合目标改变路由，记录目标直接打开窗口并保留当前页面。
function visitTarget(target: CollectionTarget) {
  if (!availableTarget(target)) return;
  if (target.record) openRecordTarget(target.collection, target.record);
  else goToCollection(target.collection);
}
function openUrl(address: string): boolean {
  if (
    sessionState.value !== "ready" ||
    feedbackForApplication().blocking.value ||
    windows.confirm.value
  )
    return false;
  const target = resolveWorkUrl(address);
  if (!target) return false;
  const { collection, id } = target;
  if (!collection) {
    visitHome();
    return true;
  }
  if (!nodeReadable(collection)) return false;
  if (id === undefined) {
    accountView.value = null;
    goToCollection(collection);
    return true;
  }

  const session = sessionVersion.value;
  const selected = collection.selected;
  const record =
    (selected?.identity === id ? selected : undefined) ??
    collection.items.find((item) => item.identity === id) ??
    collection.resolveRecord?.(id);
  return (
    !!record &&
    session === sessionVersion.value &&
    openRecordTarget(collection, record, id)
  );
}
defineExpose({ openUrl });

function visitHome() {
  accountView.value = null;
  goToCollection();
}
watch(
  [sessionVersion, routePath],
  () => {
    accountView.value = null;
  },
  { flush: "sync" },
);
watch(
  target,
  () => {
    feedbackForApplication().clear();
    clearReportPositions(false);
  },
  { flush: "sync" },
);
watch(
  [target, pageWorkbench, routeReady, sessionVersion],
  () => {
    if (!routeReady.value || sessionState.value !== "ready") return;
    const node = target.value;
    if (node) {
      if (isCollection(node)) void readCollection(node);
      else void readRecord(node);
    } else if (pageWorkbench.value) void readWorkbench(pageWorkbench.value);
  },
  { immediate: true },
);
</script>

<template>
  <WorkLayout :theme="theme">
    <template #toolbar="{ controls, toggle }">
      <WorkToolbar
        v-bind="controls"
        :brand="brand"
        :home-href="homeHref"
        :scope="sessionScope"
        :account-label="model.account.label"
        :account-actions="accountActions"
        :theme="theme"
        @toggle="toggle"
        @home="visitHome"
        @update:theme="emit('update:theme', $event)"
        @account-action="accountAction"
      />
    </template>
    <template #navigation="{ id, close }">
      <WorkNavigation
        :id="id"
        :navigation="navigation"
        :selected-navigation-key="selectedKey"
        @navigate="
          close();
          visitKey($event);
        "
      />
    </template>
    <h1>{{ pageTarget?.label ?? (pageWorkbench ? "工作台" : "") }}</h1>
    <DomainView
      v-if="pageDomain"
      :key="`domain-${pageGeneration}`"
      :node="pageDomain"
      @open="openCurrentRecord"
      @visit="visitTarget"
    />
    <CollectionView
      v-else-if="target && isCollection(target)"
      :key="`collection-${pageGeneration}`"
      :collection="target"
      :target-href="targetHref"
      @open="openCurrentRecord"
      @visit="visitTarget"
    />
    <Node
      v-else-if="target"
      :key="`object-${pageGeneration}`"
      :node="target"
      :target-href="targetHref"
      @visit="visitTarget"
      :profile="target === model.account.profile"
      :form-action="passwordAction"
    />
    <WorkbenchView
      v-else-if="pageWorkbench"
      :key="`workbench-${pageGeneration}`"
      :node="pageWorkbench"
      @visit="visitTarget"
    />
    <p v-else-if="notFound">404 页面不存在</p>
    <p v-else>暂无可用内容。</p>
    <RecordWindows :windows="windows" @visit="visitTarget" />
    <ModelFeedback @visit="visitTarget" />
  </WorkLayout>
</template>
