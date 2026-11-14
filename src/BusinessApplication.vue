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
import { VBtn } from "vuetify/components";
import AppPage from "./AppPage.vue";
import { modelRecoveryOnlyKey } from "./model-recovery-view";
import AuthFrame from "./AuthFrame.vue";
import { clearReferenceScope } from "./reference-directory";
import DynamicForm from "./DynamicForm.vue";
import Feedback from "./Feedback.vue";
import { modelNoticesKey, type ModelNotice } from "./model-notices";
import FeedbackRegion from "./FeedbackRegion.vue";
import { nodeMetadata } from "./model-node";
import {
  createModelRuntime,
  members,
  modelEntries,
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
const recoveryEntry = shallowRef<ReturnType<typeof runtime.resolve>>();
const recoveryOnly = computed(() => {
  const node =
    recoveryEntry.value?.node() ?? options.value.navigation.current?.node;
  return (
    !!options.value.owner &&
    (!!recoveryEntry.value || runtime.pending()) &&
    !!node &&
    !runtime.authorization.readable(node)
  );
});
provide(modelRecoveryOnlyKey, recoveryOnly);
watch(
  recoveryOnly,
  (value) => {
    runtime.authorization.recovering.value = value;
  },
  { flush: "sync", immediate: true },
);
function openRecovery(
  entry: ReturnType<typeof runtime.resolve> | undefined,
  knownPending = false,
) {
  if (entry && (entry.pending() || knownPending) && options.value.owner)
    recoveryEntry.value = entry;
}
watch(
  () => [
    options.value.navigation.current?.node,
    options.value.navigation.current?.identity,
  ],
  () => {
    recoveryEntry.value = undefined;
  },
  { flush: "sync" },
);
const scope = computed(() => ownerKey(options.value.owner));
const generation = ref(0);
let controller = new AbortController();
const entries = computed(() => modelEntries(props.model));
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
  entries.value.find(
    ({ node }) =>
      node[nodeMetadata].kind === "object" &&
      !!Reflect.get(
        (node as RuntimeObject)[nodeMetadata].operations,
        "changePassword",
      ),
  ),
);
const navigationEntries = computed(() =>
  (options.value.navigationProjection ?? [])
    .flatMap((group) =>
      group.items.flatMap((item) =>
        "node" in item ? [item.node] : item.items.map((entry) => entry.node),
      ),
    )
    .filter((node) => runtime.authorization.readable(node)),
);
const selected = computed(() => {
  if (!runtime.authorization.ready()) return undefined;
  const target = options.value.forcePasswordChange
    ? password.value?.node
    : (options.value.navigation.current?.node ?? navigationEntries.value[0]);
  if (!target || !runtime.authorization.readable(target)) return undefined;
  return (
    runtime.locate({
      node: target,
      identity: options.value.navigation.current?.identity,
    })[0] ??
    entries.value.find(
      (entry) => toRaw(entry.node) === toRaw(navigationEntries.value[0]),
    )
  );
});
const authentication = computed(() =>
  !options.value.owner ? signIn.value : undefined,
);
const authAction = "signIn" as const;
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
      authAction,
      authentication.value.node,
      runtime.unflat(authentication.value.node, draft.value, true),
    );
}
const navigation = computed<NavigationGroup[]>(() =>
  (options.value.navigationProjection ?? []).flatMap((group) => {
    const project = (
      node: ModelNode,
      section?: { key: string; caption: string },
    ) => {
      const entry = entries.value.find(
        (entry) => toRaw(entry.node) === toRaw(node),
      );
      return entry && runtime.authorization.readable(node)
        ? [
            {
              key: JSON.stringify(entry.path),
              caption: node[nodeMetadata].name,
              to: options.value.navigation.href(node),
              section,
            },
          ]
        : [];
    };
    const items = group.items.flatMap((item) =>
      "node" in item
        ? project(item.node)
        : item.items.flatMap((entry) =>
            project(entry.node, { key: item.key, caption: item.name }),
          ),
    );
    return items.length ? [{ key: group.key, caption: group.name, items }] : [];
  }),
);
const selectedNavigationKey = computed(() => {
  const target = options.value.navigation.current?.node ?? selected.value?.node;
  const entry = entries.value.find(
    (entry) => toRaw(entry.node) === toRaw(target),
  );
  return entry ? JSON.stringify(entry.path) : null;
});
const emptyPage: PageDefinition = {
  kind: "details",
  title: "工作台",
  [snapshotPage]: () => ({
    title: "工作台",
    render: () => h("p", "暂无可用内容。"),
  }),
};
const page = computed(() => {
  if (recoveryEntry.value) return recoveryEntry.value.page;
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
    if (previous && previous !== next) clearReferenceScope(previous);
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
        (runtime.authorization.readable(item.target) &&
          allNodes.value.some((node) => toRaw(node) === toRaw(item.target!))))
    );
  }),
);
let removeGuard: (() => void) | undefined;
watch(
  () => props.model,
  (_next, _previous, cleanup) => {
    const currentRuntime = runtime;
    removeGuard = options.value.navigation.guard((next) =>
      runtime.requestNavigation(
        next,
        () => app.value?.requestLeave() ?? Promise.resolve(!busy.value),
      ),
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
    recoveryEntry.value = undefined;
    runtime.authorization.recovering.value = false;
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
      recover: () =>
        openRecovery(runtime.recovery(item.node, item.ancestors), true),
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
      recover: () => openRecovery(entry),
    })),
  ]),
  visit: (node, identity) => options.value.navigation.visit(node, identity),
});
watch(
  [() => props.model, scope],
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
  runtime.authorization.recovering.value = false;
  removeGuard?.();
});
</script>
<template>
  <AuthFrame
    v-if="authentication || !options.owner"
    :brand="options.brand"
    :theme="options.theme?.value ?? defaultThemeChoice"
  >
    <h2>{{ model[nodeMetadata].name }}</h2>
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
        defer-errors
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
        >登录</VBtn
      >
    </form>
    <p v-else>会话不可用。</p>
    <FeedbackRegion
      ><Feedback :message="error" kind="error" /><Feedback :message="notice"
    /></FeedbackRegion>
  </AuthFrame>
  <AppPage
    v-else
    ref="app"
    :key="generation"
    :brand="options.brand"
    :brand-state="{ kind: 'ready' }"
    :navigation="navigation"
    :selected-navigation-key="selectedNavigationKey"
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
