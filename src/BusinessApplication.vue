<script setup lang="ts">
import { categoryDomains, modelCollections } from "./model-collections";
import { computed, provide, watch, ref, toRaw, onBeforeUnmount } from "vue";
import { clearReferenceScope } from "./reference-directory";
import type {
  BusinessModel,
  Collection,
  DomainGroup,
  ObjectNode,
} from "./business-model";
import { createDirectRuntime, directRuntimeKey } from "./direct-model-runtime";
import BusinessNode from "./BusinessNode.vue";
import BusinessDomain from "./BusinessDomain.vue";
import BusinessWorkbench from "./BusinessWorkbench.vue";
import ApplicationShell from "./ApplicationShell.vue";
import AuthFrame from "./AuthFrame.vue";
import BusinessFeedback from "./BusinessFeedback.vue";
import {
  defaultThemeChoice,
  type NavigationGroup,
  type AccountIntent,
  type ThemeChoice,
} from "./shell";
defineOptions({ inheritAttrs: false });
defineSlots<{}>();
const props = defineProps<{ model: BusinessModel }>();
const runtime = createDirectRuntime(() => props.model);
provide(directRuntimeKey, runtime);
const localTheme = ref(defaultThemeChoice);
const theme = computed(() => props.model.theme?.value ?? localTheme.value);
function changeTheme(value: ThemeChoice) {
  if (props.model.theme) props.model.theme.change(value);
  else localTheme.value = value;
}
const navigationIds = new WeakMap<object, number>();
let nextNavigationId = 0;
function domainEntry(domain: DomainGroup, path: string[], section?: string) {
  if (domain.hiddenFromNavigation) return [];
  const collections = domain.members.filter(runtime.readable);
  const target = collections[0];
  if (!target) return [];
  const raw = toRaw(target);
  if (!navigationIds.has(raw)) navigationIds.set(raw, ++nextNavigationId);
  return [
    {
      domain,
      target,
      collections,
      key: JSON.stringify([runtime.scope.value, path, navigationIds.get(raw)]),
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
  JSON.stringify([runtime.scope.value, "workbench"]),
);
const accountView = ref<ObjectNode | null>(null);
const current = computed<Collection | null>(() => {
  const requested = props.model.navigation.current;
  return requested &&
    modelCollections(props.model).includes(requested) &&
    runtime.readable(requested)
    ? requested
    : null;
});
watch(
  [current, groups, () => props.model.workbench, runtime.ready],
  () => {
    if (
      !runtime.ready.value ||
      props.model.session.state !== "ready" ||
      current.value ||
      props.model.workbench
    )
      return;
    const first = navigationEntries.value[0]?.target;
    if (first) props.model.navigation.visit(first);
  },
  { immediate: true },
);
const navigation = computed<NavigationGroup[]>(() => {
  if (props.model.session.state !== "ready" || !runtime.ready.value) return [];
  const items: NavigationGroup[] = groups.value.map(({ member, entries }) => ({
    key: member.key,
    caption: member.label,
    ungrouped: member.kind === "domain",
    items: entries.map(({ domain, target, key, section }) => ({
      key,
      section,
      caption: domain.label,
      icon: domain.icon,
      to: props.model.navigation.href(target),
    })),
  }));
  if (props.model.workbench)
    items.unshift({
      key: homeKey.value,
      caption: "工作台",
      ungrouped: true,
      items: [
        {
          key: homeKey.value,
          caption: "工作台",
          icon: "home",
          to: props.model.navigation.href(null),
        },
      ],
    });
  return items;
});
const selectedKey = computed(() => {
  if (activeAccountView.value) return null;
  if (!current.value) return props.model.workbench ? homeKey.value : null;
  return (
    navigationEntries.value.find((entry) =>
      entry.collections.includes(current.value!),
    )?.key ?? null
  );
});
function visitKey(key: string) {
  if (!runtime.ready.value || props.model.session.state !== "ready") return;
  if (key === homeKey.value && props.model.workbench) {
    accountView.value = null;
    props.model.navigation.visit(null);
    return;
  }
  const entry = navigationEntries.value.find((entry) => entry.key === key);
  if (entry && runtime.readable(entry.target)) {
    accountView.value = null;
    props.model.navigation.visit(entry.target);
  }
}
const brand = computed(() => ({
  productName: props.model.brand.productName,
  enterpriseName: props.model.brand.companyName,
  home: props.model.navigation.href(null),
  mark: {
    kind: "text" as const,
    text: props.model.brand.productName.slice(0, 1),
  },
}));
const accountPresentation = computed(() => ({
  label: props.model.account.label,
}));
const accountActions = computed<AccountIntent[]>(() => {
  const { account } = props.model;
  const actions: AccountIntent[] = [];
  if (runtime.readable(account.profile)) actions.push("profile");
  if (runtime.readable(account.password)) actions.push("change-password");
  if (!account.operations.signOut.disabled) actions.push("sign-out");
  return actions;
});
const activeAccountView = computed(() =>
  accountView.value && runtime.readable(accountView.value)
    ? accountView.value
    : null,
);
const target = computed(() => {
  if (props.model.session.state === "password-required") {
    const password = props.model.account.password;
    return runtime.readable(password) ? password : null;
  }
  return activeAccountView.value ?? current.value;
});
const pageDomain = computed(() => {
  const collection = current.value;
  if (
    !collection ||
    activeAccountView.value ||
    props.model.session.state === "password-required"
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
  pageTarget.value ? undefined : props.model.workbench,
);
const pageGeneration = ref(0);
watch(
  [
    pageTarget,
    pageWorkbench,
    () => props.model,
    runtime.scope,
    () => props.model.session.state,
  ],
  () => pageGeneration.value++,
  { flush: "sync" },
);
async function accountAction(action: AccountIntent) {
  if (action === "sign-out") {
    await runtime.runAccount();
    return;
  }
  const node =
    action === "profile"
      ? props.model.account.profile
      : props.model.account.password;
  if (runtime.readable(node)) accountView.value = node;
}
function goHome(event: MouseEvent) {
  const a = (event.target as Element).closest("a.zerp-shell-brand");
  if (
    !a ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  accountView.value = null;
  props.model.navigation.visit(null);
}
watch(
  [() => props.model, runtime.scope, () => props.model.session.state],
  (_current, previous) => {
    if (previous?.[1] !== undefined) clearReferenceScope(previous[1]);
    runtime.invalidate(true);
    accountView.value = null;
  },
  { flush: "sync" },
);
watch(
  () => props.model.navigation.current,
  (_current, previous) => {
    if (previous?.report && runtime.ready.value && runtime.readable(previous))
      runtime.reportViews.set(toRaw(previous), {
        left: window.scrollX,
        top: window.scrollY,
      });
  },
  { flush: "sync" },
);
onBeforeUnmount(() => clearReferenceScope(runtime.scope.value));
watch(target, () => runtime.invalidate(), { flush: "sync" });
</script>
<template>
  <AuthFrame v-if="!runtime.ready.value" :brand="brand" :theme="theme">
    <BusinessNode
      v-if="model.authentication.form.readable !== false"
      :node="model.authentication.form"
      public-auth
      :auto-read="false"
    />
    <BusinessFeedback />
  </AuthFrame>
  <div v-else @click.capture="goHome">
    <ApplicationShell
      :brand="brand"
      :navigation="navigation"
      :selected-navigation-key="selectedKey"
      :visit="visitKey"
      :scope="runtime.scope.value"
      :account="accountPresentation"
      :account-actions="accountActions"
      :theme="theme"
      @update:theme="changeTheme"
      @account-action="accountAction"
    >
      <h1>{{ pageTarget?.label ?? (pageWorkbench ? "工作台" : "") }}</h1>
      <BusinessDomain
        v-if="pageDomain"
        :key="pageGeneration"
        :node="pageDomain"
      />
      <BusinessNode v-else-if="target" :key="pageGeneration" :node="target" />
      <BusinessWorkbench
        v-else-if="pageWorkbench"
        :key="pageGeneration"
        :node="pageWorkbench"
      />
      <p v-else>暂无可用内容。</p>
      <BusinessFeedback :key="`feedback-${pageGeneration}`" />
    </ApplicationShell>
  </div>
</template>
