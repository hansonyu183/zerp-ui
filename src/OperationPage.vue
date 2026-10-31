<script
  setup
  lang="ts"
  generic="
    M extends VoucherOperationModel,
    I,
    B,
    H extends object,
    R extends object,
    C extends object = object
  "
>
import { computed, ref, shallowRef, watch } from "vue";
import VoucherEditor from "./VoucherEditor.vue";
import VoucherOperationRuntime from "./VoucherOperationRuntime.vue";
import { clone } from "./clone";
import { equalValues } from "./editor-values";
import { validateVoucherContent } from "./voucher-editor";
import type { VoucherOperationPage } from "./pages";
import type { VoucherEditorValue } from "./voucher-editor";
import type {
  VoucherOperationModel,
  VoucherOperationSettlement,
  VoucherOperationIntent,
} from "./voucher-operation";
import type { EditProtection } from "./edit-guard";
const props = defineProps<{
  options: VoucherOperationPage<M, I, B, H, R, C>;
  scope: string;
  discardVersion: number;
}>();
const emit = defineEmits<{ protection: [state: EditProtection] }>();
const draft = shallowRef<VoucherEditorValue<H, R> | null>(null),
  baseline = shallowRef<VoucherEditorValue<H, R> | null>(null);
const editorPending = ref(false),
  instance = ref(0);
const runtimeProtection = shallowRef<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "blocked",
});
const settled = shallowRef<VoucherOperationSettlement<M, I, B> | null>(null);
const restoredIntent = shallowRef<VoucherOperationIntent<M, I> | null>(null);
const baseIntent = computed(() => restoredIntent.value ?? props.options.intent);
const proposedIntent = computed(() =>
  props.options.editor && draft.value
    ? props.options.editor.toIntent(clone(draft.value), clone(baseIntent.value))
    : baseIntent.value,
);
const mappingValid = computed(
  () =>
    proposedIntent.value.action === baseIntent.value.action &&
    equalValues(proposedIntent.value.identity, baseIntent.value.identity) &&
    equalValues(proposedIntent.value.owner, baseIntent.value.owner),
);
const intent = computed(() =>
  mappingValid.value ? proposedIntent.value : baseIntent.value,
);
const validation = computed(() => {
  const editor = props.options.editor,
    content = draft.value;
  if (!editor || !content) return undefined;
  return !mappingValid.value
    ? "内容映射必须保留当前动作、身份及所属范围。"
    : validateVoucherContent(editor.definition, content);
});
const protection = computed<EditProtection>(() => ({
  dirty:
    runtimeProtection.value.dirty ||
    (!!draft.value && !equalValues(draft.value, baseline.value)),
  localPending: runtimeProtection.value.localPending || editorPending.value,
  invalid: !!validation.value,
  writeState: runtimeProtection.value.writeState,
}));
watch(protection, (value) => emit("protection", value), {
  immediate: true,
  flush: "sync",
});
const disabled = computed(
  () =>
    !props.options.eligible ||
    runtimeProtection.value.writeState !== "idle" ||
    runtimeProtection.value.dirty,
);
function reset() {
  const value = props.options.editor?.value;
  draft.value = value ? clone(value) : null;
  baseline.value = value ? clone(value) : null;
  editorPending.value = false;
  settled.value = null;
  restoredIntent.value = null;
  instance.value++;
}
watch(
  () => [
    props.scope,
    props.options.intent.owner.scope,
    props.options.intent.owner.operator,
    props.options.intent.owner.resource,
    props.options.definition.persistence,
  ],
  reset,
  { immediate: true, flush: "sync" },
);
watch(
  () => props.options.editor?.value,
  (value) => {
    if (
      equalValues(value, draft.value) ||
      runtimeProtection.value.writeState !== "idle"
    )
      return;
    draft.value = value ? clone(value) : null;
    baseline.value = value ? clone(value) : null;
    editorPending.value = false;
    instance.value++;
  },
  { deep: true },
);
watch(
  () => props.discardVersion,
  () => {
    if (runtimeProtection.value.writeState === "idle") {
      draft.value = baseline.value ? clone(baseline.value) : null;
      editorPending.value = false;
      instance.value++;
    }
  },
);
function bindings() {
  const epoch = instance.value;
  return {
    change: (value: VoucherEditorValue<H, R>) => {
      if (epoch === instance.value && !disabled.value)
        draft.value = clone(value);
    },
    pending: (value: boolean) => {
      if (epoch === instance.value) editorPending.value = value;
    },
  };
}
const editorBindings = computed(bindings);
function settledResult(value: VoucherOperationSettlement<M, I, B>) {
  settled.value = clone(value);
  props.options.onSettled?.(clone(value));
}
const restored = computed(() =>
  settled.value?.receipt.status === "not-applied" && props.options.editor
    ? props.options.editor.restore(clone(settled.value.request))
    : null,
);
const adopted = computed(() =>
  settled.value?.receipt.status === "applied" && props.options.editor
    ? props.options.editor.adopt(clone(settled.value))
    : null,
);
function restore() {
  if (disabled.value || !restored.value || !settled.value) return;
  restoredIntent.value = clone(settled.value.request);
  draft.value = clone(restored.value);
  editorPending.value = false;
  instance.value++;
  settled.value = null;
}
function adopt() {
  if (disabled.value || !adopted.value) return;
  draft.value = clone(adopted.value.value);
  baseline.value = clone(adopted.value.value);
  restoredIntent.value = clone(adopted.value.intent);
  editorPending.value = false;
  instance.value++;
  settled.value = null;
}
</script>
<template>
  <section aria-label="完整单据办理">
    <VoucherEditor
      v-if="options.editor && draft"
      :key="instance"
      v-bind="options.editor.definition"
      :model-value="draft"
      :scope="scope"
      :instance="instance"
      mode="edit"
      :disabled="disabled"
      :onUpdate:modelValue="editorBindings.change"
      :onPending="editorBindings.pending"
    />
    <VoucherOperationRuntime
      :definition="options.definition"
      :intent="intent"
      :eligible="options.eligible && !editorPending && !validation"
      :recovery-allowed="options.recoveryAllowed"
      @protection="runtimeProtection = $event"
      @settled="settledResult"
    />
    <button v-if="restored" type="button" :disabled="disabled" @click="restore">
      恢复原内容
    </button>
    <button v-if="adopted" type="button" :disabled="disabled" @click="adopt">
      编辑此结果
    </button>
  </section>
</template>
