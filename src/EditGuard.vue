<script setup lang="ts">
import { VBtn, VCard, VDialog } from "vuetify/components";
import Feedback from "./Feedback.vue";
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import type { EditGuardHandle, EditWriteState } from "./edit-guard";
const props = defineProps<{
  scope: string;
  instance: string | number;
  active: boolean;
  dirty: boolean;
  localPending?: boolean;
  writeState: EditWriteState;
}>();
const emit = defineEmits<{ discard: [] }>();
type Confirmation = {
  promise: Promise<boolean>;
  resolve: (value: boolean) => void;
  trigger: HTMLElement | null;
};
const confirmation = shallowRef<Confirmation | null>(null);
const continueButton = ref<InstanceType<typeof VBtn>[]>([]);
let mounted = true;
function settle(prompt: Confirmation, value: boolean, restoreFocus = true) {
  if (confirmation.value !== prompt) return;
  const scope = props.scope,
    instance = props.instance;
  confirmation.value = null;
  prompt.resolve(value);
  if (restoreFocus)
    nextTick(() => {
      if (
        mounted &&
        props.active &&
        props.scope === scope &&
        props.instance === instance &&
        !confirmation.value &&
        prompt.trigger?.isConnected
      )
        prompt.trigger.focus();
    });
}
function invalidate() {
  if (confirmation.value) settle(confirmation.value, false, false);
}
function requestLeave(): Promise<boolean> {
  if (!mounted || !props.active || props.writeState !== "idle")
    return Promise.resolve(false);
  if (confirmation.value) return confirmation.value.promise;
  if (!props.dirty && !props.localPending) return Promise.resolve(true);
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  const prompt = {
    promise,
    resolve,
    trigger:
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
  };
  confirmation.value = prompt;
  nextTick(() => {
    if (confirmation.value === prompt) continueButton.value[0]?.$el?.focus();
  });
  return promise;
}
function decide(prompt: Confirmation, discard: boolean) {
  if (
    confirmation.value !== prompt ||
    !props.active ||
    props.writeState !== "idle"
  )
    return;
  if (discard) emit("discard");
  settle(prompt, discard);
}
watch(
  () => [props.scope, props.instance, props.active, props.writeState],
  invalidate,
  { flush: "sync" },
);
watch(
  () => [props.dirty, props.localPending],
  () => {
    if (!props.dirty && !props.localPending) invalidate();
  },
  { flush: "sync" },
);
onBeforeUnmount(() => {
  mounted = false;
  invalidate();
});
defineExpose<EditGuardHandle>({ requestLeave });
</script>
<template>
  <section v-if="active" aria-label="编辑保护">
    <slot />
    <Feedback
      kind="warning"
      persistent
      :message="
        writeState === 'idle'
          ? undefined
          : writeState === 'pending'
            ? '写入进行中，暂不能离开。'
            : writeState === 'refresh'
              ? '写入结果已确认，等待读取最新数据。'
              : writeState === 'seal'
                ? '已确认未应用，须封存原请求后再离开。'
                : writeState === 'blocked'
                  ? '原请求恢复尚未确认，暂不能离开。'
                  : '写入结果未知，须核实原请求后再离开。'
      "
    />
    <VDialog
      class="zerp-leave-dialog"
      v-for="prompt in confirmation ? [confirmation] : []"
      :key="scope + ':' + instance"
      :model-value="true"
      max-width="560"
      scrollable
      aria-label="未保存修改"
      @update:model-value="!$event && decide(prompt, false)"
      @after-enter="confirmation === prompt && continueButton[0]?.$el?.focus()"
    >
      <VCard class="pa-4" max-height="100%" style="overflow-y: auto">
        <h2 class="text-h6">未保存修改</h2>
        <p>存在未保存修改。放弃只销毁本地输入。</p>
        <VBtn
          ref="continueButton"
          color=""
          variant="tonal"
          type="button"
          @click="decide(prompt, false)"
          >继续编辑</VBtn
        >
        <VBtn
          color="error"
          variant="flat"
          type="button"
          @click="decide(prompt, true)"
          >放弃本地修改</VBtn
        >
      </VCard>
    </VDialog>
  </section>
</template>
