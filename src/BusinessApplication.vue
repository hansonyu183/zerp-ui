<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  shallowRef,
  ref,
  watch,
  h,
  toRaw,
  provide,
} from "vue";
import { VBtn, VCard, VCardText } from "vuetify/components";
import AppPage from "./AppPage.vue";
import DynamicForm from "./DynamicForm.vue";
import Feedback from "./Feedback.vue";
import { modelNoticesKey, type ModelNotice } from "./model-notices";
import FeedbackRegion from "./FeedbackRegion.vue";
import { nodeMetadata } from "./model-node";
import {
  createModelRuntime,
  members,
  ownerKey,
  type RuntimeObject,
} from "./model-runtime";
import type {
  ApplicationNode,
  ModelNode,
  SessionOperations,
  MessageNode,
} from "./reactive-model";
import { snapshotPage, type AppPageHandle, type PageDefinition } from "./pages";
import { clone, message } from "./clone";
import {
  defaultThemeChoice,
  type AccountIntent,
  type NavigationGroup,
} from "./shell";
import type { Fields } from "./contracts";
import { validateFields } from "./validation";

defineOptions({ inheritAttrs: false });
defineSlots<{}>();
const props = defineProps<{ model: ApplicationNode }>();
const app = shallowRef<AppPageHandle | null>(null);
const error = ref("");
const notice = ref("");
const busy = ref(false);
const draft = shallowRef<Record<string, unknown>>({});
const pending = ref(false);
const runtime = createModelRuntime(() => props.model);
const options = computed(() => props.model[nodeMetadata].options);
const scope = computed(() => ownerKey(options.value.owner));
const generation = ref(0);
let controller = new AbortController();
function walk(
  node: ModelNode,
  path: string[] = [],
): { node: ModelNode; path: string[] }[] {
  return members(node).flatMap(([key, child]) => [
    { node: child, path: [...path, key] },
    ...(child[nodeMetadata].kind === "object" &&
    !(child as RuntimeObject)[nodeMetadata].independent
      ? walk(child, [...path, key])
      : []),
  ]);
}
const entries = computed(() => walk(props.model));
function sessionOperation(
  node: ModelNode,
  action: keyof SessionOperations<object>,
) {
  return node[nodeMetadata].kind === "object"
    ? (
        node as unknown as {
          [nodeMetadata]: { operations: SessionOperations<object> };
        }
      )[nodeMetadata].operations[action]
    : undefined;
}
const signIn = computed(() =>
  entries.value.find(({ node }) => sessionOperation(node, "signIn")),
);
const password = computed(() =>
  entries.value.find(({ node }) => sessionOperation(node, "changePassword")),
);
const navigationEntries = computed(() =>
  entries.value.filter(({ node }) => {
    if (node[nodeMetadata].kind === "collection") return true;
    return (
      node[nodeMetadata].kind === "object" &&
      (node as RuntimeObject)[nodeMetadata].independent
    );
  }),
);
const selected = computed(() =>
  options.value.forcePasswordChange
    ? password.value
    : (entries.value.find(
        ({ node }) => node === options.value.navigation.current?.node,
      ) ?? navigationEntries.value[0]),
);
const authentication = computed(() =>
  !options.value.owner
    ? signIn.value
    : options.value.forcePasswordChange
      ? password.value
      : selected.value &&
          sessionOperation(selected.value.node, "changePassword")
        ? selected.value
        : undefined,
);
const authAction = computed(() =>
  options.value.owner ? ("changePassword" as const) : ("signIn" as const),
);
const authFields = computed(() =>
  authentication.value
    ? (runtime
        .fields(authentication.value.node)
        .map((field) =>
          field.type === "secret"
            ? { ...field, type: "password" as const }
            : field,
        ) as unknown as Fields<Record<string, unknown>>)
    : [],
);
const invalidAuth = computed(
  () => !validateFields(authFields.value, draft.value).valid,
);
async function runSession(
  action: keyof SessionOperations<object>,
  node: ModelNode,
  input: object = {},
) {
  const operation = sessionOperation(node, action);
  if (!operation || operation.disabledReason || busy.value || pending.value)
    return;
  const redact = (text: string) =>
    runtime
      .fields(node)
      .filter((field) => field.type === "secret")
      .reduce((message, field) => {
        const value = draft.value[field.key];
        return typeof value === "string" && value
          ? message.replaceAll(value, "[已隐藏]")
          : message;
      }, text);
  const version = generation.value;
  const currentOwner = scope.value;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    const result = await operation.run({
      input: clone(input),
      owner: clone(options.value.owner),
      signal: controller.signal,
    });
    if (version !== generation.value || currentOwner !== scope.value) return;
    if (result.status === "failure")
      error.value = redact(result.message ?? "操作失败。");
    else {
      notice.value =
        action === "restoreSession"
          ? ""
          : redact(result.message ?? "操作成功。");
      draft.value = {};
      if (
        action === "changePassword" &&
        !options.value.forcePasswordChange &&
        navigationEntries.value[0]
      ) {
        busy.value = false;
        options.value.navigation.visit(navigationEntries.value[0].node);
      }
    }
  } catch (cause) {
    if (version === generation.value) error.value = redact(message(cause));
  } finally {
    if (version === generation.value) busy.value = false;
  }
}
function submit() {
  if (authentication.value && !invalidAuth.value)
    void runSession(
      authAction.value,
      authentication.value.node,
      runtime.unflat(authentication.value.node, draft.value, true),
    );
}
const navigation = computed<NavigationGroup[]>(() => [
  {
    key: "model",
    caption: props.model[nodeMetadata].name,
    ungrouped: true,
    items: navigationEntries.value.map(({ node, path }) => ({
      key: JSON.stringify(path),
      caption: node[nodeMetadata].name,
      to: options.value.navigation.href(node),
    })),
  },
]);
const emptyPage: PageDefinition = {
  kind: "details",
  title: "工作台",
  [snapshotPage]: () => ({
    title: "工作台",
    render: () => h("p", "暂无可用内容。"),
  }),
};
const page = computed(() => {
  if (!selected.value || authentication.value) return emptyPage;
  const path = selected.value.path;
  return runtime.resolve(
    () =>
      entries.value.find(
        (entry) => JSON.stringify(entry.path) === JSON.stringify(path),
      )?.node,
    path,
  ).page;
});
async function accountAction(intent: AccountIntent) {
  if (!(await app.value?.requestLeave())) return;
  if (intent === "change-password" && password.value)
    options.value.navigation.visit(password.value.node);
  else if (intent === "sign-out") {
    const node = entries.value.find(({ node }) =>
      sessionOperation(node, "signOut"),
    )?.node;
    if (node) void runSession("signOut", node);
  } else if (intent === "profile" && options.value.account?.profile)
    options.value.navigation.visit(options.value.account.profile);
}
function descendants(node: ModelNode): ModelNode[] {
  const result = [node];
  for (const [, child] of members(node)) result.push(...descendants(child));
  if (
    node[nodeMetadata].kind === "collection" ||
    node[nodeMetadata].kind === "array"
  )
    for (const child of (node as unknown as { items: ModelNode[] }).items)
      result.push(...descendants(child));
  return result;
}
const allNodes = computed(() => descendants(props.model));
const messageItems = computed(() =>
  allNodes.value
    .filter((node) => node[nodeMetadata].kind === "messages")
    .flatMap((node) => (node as MessageNode).items),
);
const notificationOwners = new WeakMap<object, string>();
watch(
  scope,
  (next, previous) => {
    for (const item of messageItems.value)
      if (!notificationOwners.has(toRaw(item)))
        notificationOwners.set(toRaw(item), previous ?? next);
  },
  { immediate: true, flush: "sync" },
);
const notifications = computed(() =>
  messageItems.value.filter((item) => {
    const raw = toRaw(item);
    if (!notificationOwners.has(raw)) notificationOwners.set(raw, scope.value);
    return (
      notificationOwners.get(raw) === scope.value &&
      (!item.target ||
        allNodes.value.some((node) => toRaw(node) === toRaw(item.target!)))
    );
  }),
);
let removeGuard: (() => void) | undefined;
watch(
  () => props.model,
  (_next, _previous, cleanup) => {
    const currentRuntime = runtime;
    removeGuard = options.value.navigation.guard(
      () => app.value?.requestLeave() ?? Promise.resolve(!busy.value),
    );
    cleanup(() => {
      removeGuard?.();
      currentRuntime.stop();
    });
  },
  { immediate: true },
);
watch(
  [() => props.model, scope],
  () => {
    generation.value++;
    controller.abort();
    controller = new AbortController();
    busy.value = false;
    pending.value = false;
    error.value = "";
    notice.value = "";
    draft.value = {};
  },
  { flush: "sync" },
);
watch(
  () => authentication.value?.node,
  (node) => {
    draft.value = node ? runtime.flat(node) : {};
  },
  { immediate: true },
);
function recoveryTarget(path: readonly string[]) {
  return entries.value.find(
    (entry) =>
      JSON.stringify(entry.path) ===
      JSON.stringify(path.slice(0, entry.path.length)),
  )?.node;
}
provide(modelNoticesKey, {
  items: computed<readonly ModelNotice[]>(() => [
    ...(error.value
      ? [
          {
            id: `${scope.value}:error`,
            text: error.value,
            kind: "error" as const,
          },
        ]
      : []),
    ...(notice.value
      ? [
          {
            id: `${scope.value}:notice`,
            text: notice.value,
            kind: "status" as const,
          },
        ]
      : []),
    ...notifications.value.map((item) => ({
      id: `${scope.value}:${item.id}`,
      text: item.text,
      kind:
        item.level === "error" || item.level === "warning"
          ? item.level
          : ("status" as const),
      target: item.target,
    })),
    ...runtime.pendingRequests().map((item) => ({
      id: `${scope.value}:pending:${JSON.stringify(item)}`,
      text: `存在待恢复的原请求：${item.node.join(" / ")}`,
      kind: "warning" as const,
      persistent: true,
      target: recoveryTarget(item.node),
      identity: item.ancestors[0],
      action: "恢复所属原请求",
    })),
    ...runtime.recoveries().map((entry) => ({
      id: `${scope.value}:recovery:${entry.definition.resource}`,
      text: `存在未完成的原请求：${entry.definition.title}。普通查询、关闭通知或撤销权限不能解除锁。`,
      kind: "warning" as const,
      persistent: true,
      target: recoveryTarget(entry.path),
      identity: (
        JSON.parse(entry.definition.resource) as [string[], unknown[]]
      )[1][0],
      action: "恢复原请求",
    })),
  ]),
  visit: (node, identity) => options.value.navigation.visit(node, identity),
});
watch(
  scope,
  () => {
    void runtime.restoreManifest().catch((cause) => {
      error.value = message(cause);
    });
  },
  { immediate: true },
);

const restoring = ref(false);
watch(
  () => props.model,
  async () => {
    const node = entries.value.find(({ node }) =>
      sessionOperation(node, "restoreSession"),
    )?.node;
    if (node && !options.value.owner) {
      restoring.value = true;
      await runSession("restoreSession", node);
      restoring.value = false;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  controller.abort();
  runtime.stop();
  removeGuard?.();
});
</script>
<template>
  <VCard v-if="authentication || !options.owner" class="zerp-model-auth">
    <VCardText>
      <h1>{{ model[nodeMetadata].name }}</h1>
      <form
        v-if="authentication && !restoring"
        :aria-label="authentication.node[nodeMetadata].name"
        @submit.prevent="submit"
      >
        <DynamicForm
          :key="generation"
          :fields="authFields"
          :model-value="draft"
          :scope="scope"
          :disabled="busy || restoring"
          @update:model-value="draft = $event"
          @pending="pending = $event"
        />
        <VBtn
          type="submit"
          :disabled="
            busy ||
            restoring ||
            pending ||
            invalidAuth ||
            !!sessionOperation(authentication.node, authAction)?.disabledReason
          "
          >{{ authAction === "signIn" ? "登录" : "更改密码" }}</VBtn
        >
      </form>
      <p v-else>会话不可用。</p>
      <FeedbackRegion
        ><Feedback :message="error" kind="error" /><Feedback :message="notice"
      /></FeedbackRegion>
    </VCardText>
  </VCard>
  <AppPage
    v-else
    ref="app"
    :key="generation"
    :brand="options.brand"
    :brand-state="{ kind: 'ready' }"
    :navigation="navigation"
    :navigation-state="{ kind: 'ready' }"
    :page="page"
    :scope="scope"
    :footer="model[nodeMetadata].name"
    :theme="options.theme?.value ?? defaultThemeChoice"
    :account="options.account"
    @account-action="accountAction"
    @update:theme="options.theme?.change($event)"
  />
</template>
<style>
.zerp-model-auth {
  max-width: 36rem;
  margin: 2rem auto;
}
</style>
