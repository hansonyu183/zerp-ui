<script
  setup
  lang="ts"
  generic="D extends object, M extends OperationModel, I, B"
>
import { computed, ref, shallowRef, watch, onBeforeUnmount } from "vue";
import DynamicForm from "./DynamicForm.vue";
import DomainBlockHost from "./DomainBlockHost.vue";
import DraftCollaborationView from "./DraftCollaboration.vue";
import BusinessInteractions from "./BusinessInteractions.vue";
import OperationRuntime from "./OperationRuntime.vue";
import PrintPreview from "./PrintPreview.vue";
import Feedback from "./Feedback.vue";
import { clone, message } from "./clone";
import { equalValues } from "./editor-values";
import { validate } from "./validation";
import { validateDomainBlocks } from "./domain-blocks";
import {
  operationLabels,
  type OperationModel,
  type OperationSettlement,
} from "./operation";
import type { TaskPage } from "./tasks";
import type { EditProtection } from "./edit-guard";
const props = defineProps<{
  options: TaskPage<D, M, I, B>;
  scope: string;
  discardVersion: number;
}>();
const emit = defineEmits<{ protection: [state: EditProtection] }>();
const draft = shallowRef(clone(props.options.values)),
  baseline = shallowRef(clone(props.options.values));
const action = ref(props.options.actions[0]) as {
  value: TaskPage<D, M, I, B>["actions"][number];
};
const settlement = shallowRef<OperationSettlement<M, I, B> | null>(null);
const adopted = computed(() =>
  settlement.value && props.options.adopt
    ? props.options.adopt(clone(settlement.value))
    : null,
);
const local = ref<Record<string, boolean>>({}),
  error = ref(""),
  reading = ref(false);
const runtime = shallowRef<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "blocked",
});
let alive = true,
  controller: AbortController | undefined;
const disabled = computed(
  () =>
    !props.options.eligible ||
    runtime.value.writeState !== "idle" ||
    runtime.value.dirty ||
    reading.value,
);
const fields = computed(
  () =>
    props.options.fields.filter(
      (field) =>
        !props.options.blocks?.some((block) => block.key === field.key),
    ) as unknown as typeof props.options.fields,
);
const intent = computed(() =>
  props.options.toIntent(clone(draft.value), action.value, {
    owner: clone(props.options.owner),
    identity: clone(props.options.identity),
  }),
);
watch(
  () => [props.options.actions, runtime.value.writeState] as const,
  () => {
    if (
      runtime.value.writeState === "idle" &&
      !props.options.actions.includes(action.value)
    )
      action.value = props.options.actions[0]!;
  },
  { deep: true },
);
const mappingValid = computed(
  () =>
    props.options.actions.includes(action.value) &&
    intent.value.action === action.value &&
    equalValues(intent.value.owner, props.options.owner) &&
    equalValues(intent.value.identity, props.options.identity),
);
const invalid = computed(
  () =>
    !mappingValid.value ||
    !!validate(fields.value, draft.value, "edit") ||
    !!validateDomainBlocks(props.options.blocks, draft.value, "edit"),
);
const pending = computed(
  () => Object.values(local.value).some(Boolean) || reading.value,
);
watch(
  () => ({
    dirty: runtime.value.dirty || !equalValues(draft.value, baseline.value),
    localPending: runtime.value.localPending || pending.value,
    invalid: invalid.value,
    writeState: runtime.value.writeState,
  }),
  (value) => emit("protection", value),
  { immediate: true, flush: "sync" },
);
watch(
  () => props.discardVersion,
  () => {
    if (runtime.value.writeState === "idle") {
      draft.value = clone(baseline.value);
      local.value = {};
    }
  },
);
function update(value: D) {
  if (!disabled.value) draft.value = clone(value);
}
async function read(work: (signal: AbortSignal) => Promise<void>) {
  if (disabled.value) return;
  controller?.abort();
  const current = new AbortController();
  controller = current;
  reading.value = true;
  error.value = "";
  try {
    await work(current.signal);
  } catch (cause) {
    if (alive && !current.signal.aborted) error.value = message(cause);
  } finally {
    if (alive && controller === current) reading.value = false;
  }
}
async function importResource(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0],
    resource = props.options.importResource;
  if (!file || !resource) return;
  await read(async (signal) => {
    const value = await resource.read({ file, scope: props.scope, signal });
    if (alive && !signal.aborted) draft.value = clone(value);
  });
  (event.target as HTMLInputElement).value = "";
}
async function download(
  item: NonNullable<TaskPage<D, M, I, B>["downloads"]>[number],
) {
  await read(async (signal) => {
    const result = await item.read({
      scope: props.scope,
      value: clone(draft.value),
      signal,
    });
    if (!alive || signal.aborted) return;
    const url = URL.createObjectURL(result.content),
      anchor = document.createElement("a");
    try {
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}
function settled(value: OperationSettlement<M, I, B>) {
  settlement.value = clone(value);
  props.options.onSettled?.(clone(value));
}
function adopt() {
  if (!disabled.value && adopted.value) {
    draft.value = clone(adopted.value);
    baseline.value = clone(adopted.value);
    settlement.value = null;
  }
}
onBeforeUnmount(() => {
  alive = false;
  controller?.abort();
});
</script>
<template>
  <section aria-label="业务处理">
    <Feedback :message="error" kind="error" />
    <DynamicForm
      :fields="fields"
      :model-value="draft"
      :scope="scope"
      mode="edit"
      :disabled="disabled"
      @update:model-value="update"
      @pending="local = { ...local, form: $event }"
    />
    <DomainBlockHost
      v-for="block in options.blocks"
      :key="block.key"
      :block="block"
      :model-value="draft"
      :scope="scope"
      mode="edit"
      form-mode="edit"
      :disabled="disabled"
      @update:model-value="update"
      @pending="local = { ...local, [block.key]: $event }"
    />
    <DraftCollaborationView
      v-if="options.collaboration"
      :adapter="options.collaboration"
      :model-value="draft"
      :scope="scope"
      :instance="options.instance"
      :disabled="disabled"
      @update:model-value="update"
      @pending="local = { ...local, collaboration: $event }"
    />
    <BusinessInteractions
      :items="options.diagnostics ?? []"
      :answers="{}"
      :disabled="disabled"
    />
    <label
      >操作<select aria-label="操作" v-model="action" :disabled="disabled">
        <option
          v-for="available in options.actions"
          :key="available"
          :value="available"
        >
          {{ operationLabels[available] }}
        </option>
      </select></label
    >
    <label v-if="options.importResource"
      >{{ options.importResource.label
      }}<input
        type="file"
        :accept="options.importResource.accept"
        :disabled="disabled"
        @change="importResource"
    /></label>
    <button
      v-for="item in options.downloads"
      :key="item.key"
      type="button"
      :disabled="disabled"
      @click="download(item)"
    >
      {{ item.label }}
    </button>
    <OperationRuntime
      :definition="options.definition"
      :intent="intent"
      :eligible="
        options.eligible && !!action && mappingValid && !pending && !invalid
      "
      :recovery-allowed="options.recoveryAllowed"
      @protection="runtime = $event"
      @settled="settled"
    />
    <button v-if="adopted" type="button" :disabled="disabled" @click="adopt">
      采用处理结果
    </button>
    <PrintPreview
      v-if="options.printing"
      :document="options.printing.document"
      :allowed="options.printing.state === 'opened'"
      :disabled="runtime.writeState !== 'idle'"
    />
  </section>
</template>
