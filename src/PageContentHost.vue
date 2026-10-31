<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import EditGuard from "./EditGuard.vue";
import {
  snapshotPage,
  type AppPageHandle,
  type PageDefinition,
  type PageSnapshot,
} from "./pages";
import type { EditGuardHandle, EditProtection } from "./edit-guard";
import { equalValues } from "./editor-values";
const props = withDefaults(
  defineProps<{ page: PageDefinition; scope: string; active?: boolean }>(),
  { active: true },
);
const emit = defineEmits<{ protection: [value: EditProtection] }>();
const clear: EditProtection = {
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "idle",
};
const protection = shallowRef<EditProtection>(clear);
const guard = shallowRef<EditGuardHandle | null>(null);
const admittedPage = shallowRef(props.page),
  admitted = shallowRef<PageSnapshot>(props.page[snapshotPage]());
const generation = ref(0),
  discardVersion = ref(0);
let switchRequest = 0;
function reset() {
  switchRequest++;
  generation.value++;
  protection.value = clear;
  admittedPage.value = props.page;
  admitted.value = props.page[snapshotPage]();
}
watch(() => [props.scope, props.active], reset, { flush: "sync" });
watch(
  () => ({ page: props.page, snapshot: props.page[snapshotPage]() }),
  async (next) => {
    const request = ++switchRequest,
      epoch = generation.value;
    if (
      !props.active ||
      (next.page === admittedPage.value &&
        !equalValues(next.snapshot.security, admitted.value.security))
    ) {
      reset();
      return;
    }
    if (
      next.page === admittedPage.value &&
      next.snapshot.definition === admitted.value.definition &&
      next.snapshot.scriptDefinition === admitted.value.scriptDefinition &&
      equalValues(next.snapshot.record, admitted.value.record)
    ) {
      admitted.value = next.snapshot;
      return;
    }
    if (
      !(await requestLeave()) ||
      request !== switchRequest ||
      epoch !== generation.value ||
      !props.active
    )
      return;
    admittedPage.value = next.page;
    admitted.value = next.snapshot;
    generation.value++;
    protection.value = clear;
  },
  { flush: "sync" },
);
watch(protection, (value) => emit("protection", value), {
  immediate: true,
  flush: "sync",
});
const content = computed(() => {
  const epoch = generation.value;
  return () =>
    props.active
      ? admitted.value.render({
          scope: props.scope,
          active: props.active,
          discardVersion: discardVersion.value,
          protection: (value) => {
            if (epoch !== generation.value || !props.active) return false;
            protection.value = value;
            return true;
          },
          requestLeave,
        })
      : null;
});
async function requestLeave(): Promise<boolean> {
  const epoch = generation.value;
  const allowed = await guard.value?.requestLeave();
  return allowed === true && epoch === generation.value && props.active;
}
defineExpose<AppPageHandle>({ requestLeave });
</script>
<template>
  <h1>{{ admitted.title }}</h1>
  <EditGuard
    ref="guard"
    :scope="scope"
    :instance="generation"
    :active="active"
    :dirty="protection.dirty"
    :local-pending="protection.localPending"
    :write-state="protection.writeState"
    @discard="discardVersion++"
  />
  <component :is="content" :key="generation" />
</template>
