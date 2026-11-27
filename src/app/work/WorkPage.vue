<script setup lang="ts">
// 协调当前页面、侧栏导航、账户入口和记录窗口。集合内部交互由各视图处理。
import {
  clearReportPositions,
  saveReportPosition,
} from "./views/report-position";
import {
  executeOperation,
  invalidateOperations,
  loadFirst,
} from "../operations";
import {
  applicationModel,
  applicationReady,
  currentModel,
  sessionScope,
  sessionState,
} from "../session";
import {
  collectionEntries,
  workGroups,
  isCollection,
  readable as nodeReadable,
  workbenchReadable,
} from "../nodes";
import { computed, ref, toRaw, watch } from "vue";
import type {
  BusinessModel,
  ListCollection,
  DomainGroup,
  CollectionTarget,
  ObjectNode,
} from "../../model/business-model";
import {
  collectionHref,
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
import ModelFeedback from "../../components/feedback/ModelFeedback.vue";
import { modelBrand, type ThemeChoice } from "../../styles/theme";
import type { AccountIntent, NavigationGroup } from "./navigation";

const props = defineProps<{
  model: BusinessModel["work"];
  brand: BusinessModel["brand"];
  theme: ThemeChoice;
}>();
const emit = defineEmits<{ "update:theme": [ThemeChoice] }>();
const brand = computed(() => modelBrand(props.brand));
// 记录窗口属于工作页，切换集合路由时仍由同一工作页管理。
const windows = useRecordWindows();
const pageScope = [
  currentModel,
  () => props.model,
  sessionScope,
  sessionState,
] as const;
const navigationIds = new WeakMap<object, number>();
let nextNavigationId = 0;
function domainEntry(domain: DomainGroup, path: string[], section?: string) {
  if (domain.hiddenFromNavigation) return [];
  const collections = domain.members.filter(nodeReadable);
  const target = collections[0];
  if (!target) return [];
  const raw = toRaw(target);
  if (!navigationIds.has(raw)) navigationIds.set(raw, ++nextNavigationId);
  return [
    {
      domain,
      target,
      collections,
      key: JSON.stringify([sessionScope.value, path, navigationIds.get(raw)]),
      section:
        section === undefined
          ? undefined
          : { key: JSON.stringify(path.slice(0, -1)), caption: section },
    },
  ];
}
const groups = computed(() =>
  workGroups.value.flatMap(({ member, domains }) => {
    if (!("kind" in member)) return [];
    const entries = domains.flatMap(({ domain, path, section }) =>
      domainEntry(domain, path, section?.label),
    );
    return entries.length ? [{ member, entries }] : [];
  }),
);
const navigationEntries = computed(() =>
  groups.value.flatMap((group) => group.entries),
);
const homeKey = computed(() =>
  JSON.stringify([sessionScope.value, "workbench"]),
);
const accountView = ref<ObjectNode | null>(null);
const current = computed<ListCollection | null>(() =>
  routedCollection.value && nodeReadable(routedCollection.value)
    ? routedCollection.value
    : null,
);
const workbench = computed(() => {
  const home = props.model.workbench;
  if (routePath.value === "/" && home && workbenchReadable(home)) return home;
});
const notFound = computed(
  () => routePath.value !== "/" && !routedCollection.value,
);
watch(
  [routePath, groups, workbench, applicationReady, sessionState, routeReady],
  () => {
    if (
      !routeReady.value ||
      routePath.value !== "/" ||
      !applicationReady.value ||
      sessionState.value !== "ready" ||
      workbench.value
    )
      return;
    const first = navigationEntries.value[0]?.target;
    if (first) goToCollection(first);
  },
  { immediate: true },
);
const navigation = computed<NavigationGroup[]>(() => {
  if (sessionState.value !== "ready" || !applicationReady.value) return [];
  const items: NavigationGroup[] = groups.value.map(({ member, entries }) => ({
    key: member.key,
    caption: member.label,
    ungrouped: member.kind === "domain",
    items: entries.map(({ domain, target, key, section }) => ({
      key,
      section,
      caption: domain.label,
      icon: domain.icon,
      to: collectionHref(target)!,
    })),
  }));
  if (props.model.workbench && workbenchReadable(props.model.workbench))
    items.unshift({
      key: homeKey.value,
      caption: "工作台",
      ungrouped: true,
      items: [
        {
          key: homeKey.value,
          caption: "工作台",
          icon: "home",
          to: "/",
        },
      ],
    });
  return items;
});
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
watch([pageTarget, pageWorkbench, ...pageScope], () => pageGeneration.value++, {
  flush: "sync",
});
async function accountAction(action: AccountIntent) {
  if (action === "sign-out") {
    const application = applicationModel.value;
    const account = props.model.account;
    const operation = account.operations.signOut;
    await executeOperation(
      account,
      operation,
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
// 集合目标改变路由，记录目标直接打开窗口并保留当前页面。
function visitTarget(target: CollectionTarget) {
  if (!availableTarget(target)) return;
  if (target.record) {
    const trigger = document.activeElement;
    windows.open({
      collection: target.collection,
      record: target.record,
      mode: "read",
      focus: () => (trigger instanceof HTMLElement ? trigger : null),
    });
  } else goToCollection(target.collection);
}
function visitHome() {
  accountView.value = null;
  goToCollection();
}
watch(
  pageScope,
  () => {
    accountView.value = null;
  },
  { flush: "sync" },
);
watch(
  routePath,
  () => {
    accountView.value = null;
  },
  { flush: "sync" },
);
watch(
  target,
  () => {
    invalidateOperations();
    clearReportPositions(false);
  },
  { flush: "sync" },
);
watch(
  [target, pageWorkbench, routeReady, ...pageScope],
  () => {
    if (!routeReady.value || sessionState.value !== "ready") return;
    const node = target.value ?? pageWorkbench.value;
    if (node) void loadFirst(node);
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
