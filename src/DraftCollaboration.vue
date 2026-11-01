<script setup lang="ts" generic="D extends object, T = never">
import { VBtn, VProgressLinear } from "vuetify/components";
import { ref, shallowRef, watch, onBeforeUnmount } from "vue";
import { clone, message } from "./clone";
import { equalValues } from "./editor-values";
import type {
  DraftCollaboration,
  Interaction,
  InteractionAnswers,
} from "./collaboration";
import BusinessInteractions from "./BusinessInteractions.vue";
import Feedback from "./Feedback.vue";
const props = defineProps<{
  adapter: DraftCollaboration<D, T>;
  modelValue: D;
  scope: string;
  instance: string | number;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: D];
  pending: [value: boolean];
}>();
const items = shallowRef<readonly Interaction<T>[]>([]),
  answers = shallowRef<InteractionAnswers>({}),
  error = ref("");
const calculating = ref(false);
let generation = 0,
  controller: AbortController | undefined,
  adopted: D | undefined,
  alive = true;
async function run(
  event: "initialize" | "change" | "answer" | "action",
  target?: T,
) {
  controller?.abort();
  const epoch = ++generation;
  controller = new AbortController();
  const signal = controller.signal,
    baseline = clone(props.modelValue),
    value = clone(baseline),
    scope = props.scope,
    instance = props.instance;
  calculating.value = true;
  emit("pending", true);
  error.value = "";
  try {
    const result = await props.adapter.change({
      value,
      scope,
      event,
      answers: clone(answers.value),
      target: clone(target),
      signal,
    });
    if (
      !alive ||
      signal.aborted ||
      epoch !== generation ||
      props.disabled ||
      scope !== props.scope ||
      instance !== props.instance ||
      !equalValues(baseline, props.modelValue)
    )
      return;
    calculating.value = false;
    const previous = items.value;
    items.value = clone(result.interactions ?? []);
    // Only retain answers for identical prompts, never reinterpret an old answer under a new question.
    const retained: Record<string, string | boolean> = {};
    for (const item of items.value)
      if (
        (item.kind === "confirm" || item.kind === "input") &&
        answers.value[item.id] !== undefined &&
        equalValues(
          item,
          previous.find((old) => old.id === item.id),
        )
      )
        retained[item.id] = answers.value[item.id]!;
    answers.value = retained;
    adopted = clone(result.value);
    emit("update:modelValue", clone(result.value));
    emit(
      "pending",
      items.value.some(
        (item) =>
          (item.kind === "confirm" &&
            item.required &&
            answers.value[item.id] !== true) ||
          (item.kind === "input" &&
            item.required &&
            !String(answers.value[item.id] ?? "").trim()),
      ),
    );
  } catch (cause) {
    if (alive && epoch === generation && !signal.aborted) {
      calculating.value = false;
      error.value = message(cause);
      emit("pending", true);
    }
  }
}
watch(
  () => [props.scope, props.instance, props.adapter] as const,
  () => {
    items.value = [];
    answers.value = {};
    adopted = undefined;
    if (!props.disabled) void run("initialize");
  },
  { immediate: true, flush: "sync" },
);
watch(
  () => clone(props.modelValue),
  (value) => {
    if (adopted && equalValues(value, adopted)) {
      adopted = undefined;
      return;
    }
    answers.value = {};
    items.value = [];
    if (!props.disabled) void run("change");
  },
  { deep: true, flush: "sync" },
);
watch(
  () => props.disabled,
  (disabled) => {
    controller?.abort();
    generation++;
    calculating.value = false;
    items.value = [];
    answers.value = {};
    if (!disabled) void run("change");
  },
);
function answer(id: string, value: string | boolean) {
  if (
    props.disabled ||
    calculating.value ||
    !items.value.some(
      (item) =>
        item.id === id && (item.kind === "confirm" || item.kind === "input"),
    )
  )
    return;
  answers.value = { ...answers.value, [id]: value };
  void run("answer");
}
onBeforeUnmount(() => {
  alive = false;
  generation++;
  controller?.abort();
});
</script>
<template>
  <div
    class="zerp-collaboration-progress"
    role="status"
    :aria-label="calculating ? '业务计算中' : undefined"
    :aria-busy="calculating"
  >
    <VProgressLinear
      :active="calculating"
      :indeterminate="calculating"
      height="4"
    />
  </div>
  <Feedback :message="error" kind="error" persistent
    ><VBtn
      type="button"
      variant="text"
      color=""
      :disabled="disabled || calculating"
      @click="run('change')"
    >
      重试业务计算
    </VBtn></Feedback
  >
  <BusinessInteractions
    :items="items"
    :answers="answers"
    :disabled="disabled || calculating || !!error"
    @answer="answer"
    @intent="
      (target) => !disabled && !calculating && !error && run('action', target)
    "
  />
</template>
