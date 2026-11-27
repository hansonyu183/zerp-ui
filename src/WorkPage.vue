<script setup lang="ts">
import { saveReportPosition } from "./report-position";
import {
  executeOperation,
  invalidateOperations,
  loadFirst,
} from "./business-operations";
import {
  applicationModel,
  applicationReady,
  currentModel,
  modelVersion,
  sessionScope,
  sessionState,
} from "./business-session";
import { readable as nodeReadable, workbenchReadable } from "./business-nodes";
import { computed, ref, toRaw, watch } from "vue";
import { categoryDomains } from "./model-collections";
import type {
  BusinessModel,
  ListCollection,
  DomainGroup,
  ObjectNode,
} from "./business-model";
import {
  collectionHref,
  goToCollection,
  routePath,
  routeReady,
  routedCollection,
} from "./work-router";
import RecordWindows from "./RecordWindows.vue";
import BusinessNode from "./BusinessNode.vue";
import BusinessDomain from "./BusinessDomain.vue";
import BusinessWorkbench from "./BusinessWorkbench.vue";
import ApplicationShell from "./ApplicationShell.vue";
import BusinessFeedback from "./BusinessFeedback.vue";
import {
  modelBrand,
  type AccountIntent,
  type Brand,
  type NavigationGroup,
  type ThemeChoice,
} from "./shell";

const props = defineProps<{
  model: BusinessModel["work"];
  brand: BusinessModel["brand"];
  theme: ThemeChoice;
}>();
const emit = defineEmits<{ "update:theme": [ThemeChoice] }>();
const brand = computed<Brand>(() => ({
  ...modelBrand(props.brand),
  home: "/",
}));
const pageScope = [
  modelVersion,
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
  props.model.members.flatMap((member) => {
    if (!("kind" in member)) return [];
    const entries =
      member.kind === "domain"
        ? domainEntry(member, [member.key])
        : member.members.flatMap((child) =>
            child.kind === "domain"
              ? domainEntry(child, [member.key, child.key])
              : child.members.flatMap((domain) =>
                  domainEntry(
                    domain,
                    [member.key, child.key, domain.key],
                    child.label,
                  ),
                ),
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
          to: brand.value.home,
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
const accountPresentation = computed(() => ({
  label: props.model.account.label,
}));
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
  return props.model.members
    .flatMap((member) =>
      !("kind" in member)
        ? []
        : member.kind === "domain"
          ? [member]
          : categoryDomains(member),
    )
    .find(
      (group) => group.members.length > 1 && group.members.includes(collection),
    );
});
const pageTarget = computed(() => pageDomain.value ?? target.value);
const pageWorkbench = computed(() =>
  pageTarget.value || sessionState.value !== "ready"
    ? undefined
    : workbench.value,
);
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
watch(target, () => invalidateOperations(), { flush: "sync" });
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
  <ApplicationShell
    :brand="brand"
    :navigation="navigation"
    :selected-navigation-key="selectedKey"
    :visit="visitKey"
    :visit-home="visitHome"
    :scope="sessionScope"
    :account="accountPresentation"
    :account-actions="accountActions"
    :theme="theme"
    @update:theme="emit('update:theme', $event)"
    @account-action="accountAction"
  >
    <h1>{{ pageTarget?.label ?? (pageWorkbench ? "工作台" : "") }}</h1>
    <BusinessDomain
      v-if="pageDomain"
      :key="pageGeneration"
      :node="pageDomain"
    />
    <BusinessNode
      v-else-if="target"
      :key="pageGeneration"
      :node="target"
      :profile="target === model.account.profile"
    />
    <BusinessWorkbench
      v-else-if="pageWorkbench"
      :key="pageGeneration"
      :node="pageWorkbench"
    />
    <p v-else-if="notFound">404 页面不存在</p>
    <p v-else>暂无可用内容。</p>
    <RecordWindows />
    <BusinessFeedback />
  </ApplicationShell>
</template>
