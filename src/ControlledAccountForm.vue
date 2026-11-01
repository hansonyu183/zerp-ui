<script setup lang="ts" generic="D extends object">
import { VBtn } from "vuetify/components";
import { computed, ref, shallowRef, watch } from "vue";
import type { Fields } from "./contracts";
import type { EditProtection } from "./edit-guard";
import { clone } from "./clone";
import { equalValues } from "./editor-values";
import { validateFields, type FormValidationState } from "./validation";
import DynamicForm from "./DynamicForm.vue";
import Feedback from "./Feedback.vue";

const props = withDefaults(
  defineProps<{
    scope: string;
    instance?: string | number;
    kind: "profile" | "change-password";
    values: D;
    fields: Fields<D>;
    busy?: boolean;
    error?: string;
    notice?: string;
    submitLabel?: string;
    cancelLabel?: string;
    validate?: (values: D) => string | undefined;
    discardVersion?: number;
  }>(),
  { instance: 0 },
);
const emit = defineEmits<{
  submit: [values: D];
  cancel: [];
  protection: [state: EditProtection];
  "update:values": [values: D];
}>();
const draft = shallowRef<D>(clone(props.values));
const baseline = shallowRef<D>(clone(props.values));
const lastInput = shallowRef<D>(clone(props.values));
const generation = ref(0);
const pending = ref(false);
const validation = shallowRef<FormValidationState<D>>({
  ...validateFields<D>(props.fields, draft.value),
  pending: false,
});
const validationMessage = computed(() => props.validate?.(draft.value));
const invalid = computed(
  () =>
    !validateFields<D>(props.fields, draft.value).valid ||
    !validation.value.valid ||
    !!validationMessage.value,
);
const protection = computed<EditProtection>(() => ({
  dirty: !equalValues(draft.value, baseline.value),
  localPending: pending.value || validation.value.pending,
  invalid: invalid.value,
  writeState: props.busy ? "pending" : "idle",
}));
watch(protection, (value) => emit("protection", value), {
  immediate: true,
  flush: "sync",
});

function reset(value: D, replaceBaseline: boolean) {
  generation.value++;
  pending.value = false;
  if (replaceBaseline) baseline.value = clone(value);
  draft.value = clone(value);
  lastInput.value = clone(value);
  validation.value = {
    ...validateFields<D>(props.fields, draft.value),
    pending: false,
  };
}
watch(
  [() => props.scope, () => props.kind, () => props.instance],
  () => reset(props.values, true),
  { flush: "sync" },
);
watch(
  () => props.values,
  (value) => {
    if (equalValues(value, lastInput.value)) return;
    lastInput.value = clone(value);
    // A controlled consumer may echo draft updates. That acknowledgement does
    // not replace the authoritative baseline or discard unfinished input.
    if (!equalValues(value, draft.value)) reset(value, true);
  },
  { deep: true },
);
function discard() {
  reset(baseline.value, false);
  emit("update:values", clone(draft.value));
}
watch(() => props.discardVersion, discard);

// Handlers belong to one mounted form generation; a retired reference lookup
// or child input cannot change the replacement account context.
const handlers = computed(() => {
  const current = generation.value;
  return {
    update(value: D) {
      if (current !== generation.value || props.busy) return;
      draft.value = clone(value);
      emit("update:values", clone(value));
    },
    pending(value: boolean) {
      if (current === generation.value) pending.value = value;
    },
    validation(value: FormValidationState<D>) {
      if (current === generation.value) validation.value = value;
    },
  };
});
function submit() {
  if (props.busy || protection.value.localPending || invalid.value) return;
  emit("submit", clone(draft.value));
}
function cancel() {
  if (props.busy) return;
  discard();
  emit("cancel");
}
</script>
<template>
  <form
    class="zerp-ui"
    :aria-label="kind === 'profile' ? '名称与头像' : '更改密码'"
    @submit.prevent="submit"
  >
    <div class="zerp-feedback-region">
      <Feedback :message="error" kind="error" />
      <Feedback :message="notice" />
      <Feedback :message="validationMessage" kind="error" />
    </div>
    <DynamicForm
      :key="generation"
      :fields="fields"
      :model-value="draft"
      :scope="scope"
      :disabled="busy"
      @update:model-value="handlers.update"
      @pending="handlers.pending"
      @validation="handlers.validation"
    />
    <VBtn
      type="submit"
      color="primary"
      variant="flat"
      :loading="busy"
      :disabled="busy || protection.localPending || invalid"
    >
      {{ submitLabel ?? "保存" }}
    </VBtn>
    <VBtn type="button" :disabled="busy" @click="cancel">
      {{ cancelLabel ?? "取消" }}
    </VBtn>
  </form>
</template>
