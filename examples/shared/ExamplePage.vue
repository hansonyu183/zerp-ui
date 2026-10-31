<script setup lang="ts">
import {
  inject,
  ref,
  shallowRef,
  onBeforeUnmount,
  watchEffect,
  watch,
} from "vue";
import {
  AppPage,
  type AppPageHandle,
  type PageDefinition,
  type EditProtection,
} from "@zerp/ui";
import { useRouter } from "vue-router";
import { createExampleShell, exampleShellKey } from "./shell";
const props = withDefaults(
  defineProps<{
    page: PageDefinition;
    scope?: string;
    active?: boolean;
    shellHost?: boolean;
  }>(),
  { scope: "synthetic-session", active: true },
);
const emit = defineEmits<{ protection: [value: EditProtection] }>();
const shell = inject(exampleShellKey, undefined) ?? createExampleShell();
const host = ref<AppPageHandle>();
const hosted = shell.hosted && !props.shellHost;
const owner = Symbol("synthetic-page-owner");
if (hosted) {
  watchEffect(() => {
    shell.contentOwner.value = owner;
    shell.content.value = props.page;
    shell.contentScope.value = props.scope;
    shell.contentActive.value = props.active;
  });
  onBeforeUnmount(() => {
    if (shell.contentOwner.value === owner) {
      shell.content.value = undefined;
      shell.contentOwner.value = undefined;
    }
  });
}
if (props.shellHost)
  watch(host, (value) => (shell.host.value = value), {
    immediate: true,
    flush: "sync",
  });
const protection = shallowRef<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "idle",
});
const router = useRouter();
const removeGuard = hosted
  ? () => {}
  : router.beforeEach(() => host.value?.requestLeave() ?? true);
onBeforeUnmount(removeGuard);
watchEffect((cleanup) => {
  if (
    props.active &&
    (protection.value.dirty ||
      protection.value.localPending ||
      protection.value.writeState !== "idle")
  ) {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    cleanup(() => window.removeEventListener("beforeunload", beforeUnload));
  }
});
function protectedState(value: EditProtection) {
  protection.value = value;
  emit("protection", value);
}

defineExpose<AppPageHandle>({
  requestLeave: () =>
    (hosted ? shell.host.value : host.value)?.requestLeave() ??
    Promise.resolve(false),
});
</script>
<template>
  <AppPage
    v-if="!hosted"
    ref="host"
    :page="
      shell.override.value ??
      (shellHost ? (shell.content.value ?? props.page) : props.page)
    "
    :scope="shellHost ? shell.contentScope.value : scope"
    :active="shellHost ? shell.contentActive.value : active"
    :brand="shell.brand"
    :brand-state="shell.brandState.value"
    :navigation="shell.navigation"
    :navigation-state="shell.navigationState.value"
    :selected-navigation-key="shell.selectedNavigationKey.value"
    :theme="shell.theme.value"
    :account="{ label: shell.name.value, avatar: shell.avatar.value }"
    footer="合成数据演示 · 非真实后端"
    @update:theme="shell.saveTheme($event)"
    @account-action="shell.accountAction($event)"
    @retry-brand="shell.brandState.value = { kind: 'ready' }"
    @retry-navigation="shell.navigationState.value = { kind: 'ready' }"
    @protection="protectedState"
  />
</template>
