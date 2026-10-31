<script setup lang="ts">
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
const continueButton = ref<HTMLButtonElement[]>([]);
let mounted = true;
function settle(prompt: Confirmation, value: boolean, restoreFocus = true) {
  if (confirmation.value !== prompt) return;
  confirmation.value = null;
  prompt.resolve(value);
  if (restoreFocus)
    nextTick(() => {
      if (
        mounted &&
        props.active &&
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
    if (confirmation.value === prompt) continueButton.value[0]?.focus();
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
function keydown(event: KeyboardEvent, prompt: Confirmation) {
  if (event.key === "Escape") {
    event.preventDefault();
    decide(prompt, false);
  }
  if (event.key !== "Tab") return;
  const buttons = (
    event.currentTarget as HTMLElement
  ).querySelectorAll<HTMLButtonElement>("button");
  if (event.shiftKey && document.activeElement === buttons[0]) {
    event.preventDefault();
    buttons[1].focus();
  } else if (!event.shiftKey && document.activeElement === buttons[1]) {
    event.preventDefault();
    buttons[0].focus();
  }
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
    <p v-if="writeState !== 'idle'" role="status">
      {{
        writeState === "pending"
          ? "写入进行中，暂不能离开。"
          : writeState === "refresh"
            ? "写入结果已确认，等待读取最新数据。"
            : writeState === "seal"
              ? "已确认未应用，须封存原请求后再离开。"
              : writeState === "blocked"
                ? "原请求恢复尚未确认，暂不能离开。"
                : "写入结果未知，须核实原请求后再离开。"
      }}
    </p>
    <div
      v-for="prompt in confirmation ? [confirmation] : []"
      :key="scope + ':' + instance"
      class="zerp-edit-guard__overlay"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="未保存修改"
        @keydown="keydown($event, prompt)"
      >
        <p>存在未保存修改。放弃只销毁本地输入。</p>
        <button
          ref="continueButton"
          type="button"
          @click="decide(prompt, false)"
        >
          继续编辑
        </button>
        <button type="button" @click="decide(prompt, true)">
          放弃本地修改
        </button>
      </section>
    </div>
  </section>
</template>
