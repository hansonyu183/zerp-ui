<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { VBtn, VFileInput } from "vuetify/components";
import DraftCollaborationView from "./DraftCollaboration.vue";
import OperationRuntime from "./OperationRuntime.vue";
import DynamicForm from "./DynamicForm.vue";
import PrintPreview from "./PrintPreview.vue";
import { nodeMetadata } from "./model-node";
import { modelOperation } from "./model-operation";
import { modelOperationPersistence } from "./model-operation-persistence";
import {
  operationLabels,
  type OperationAction,
  type OperationModel,
  type OperationDefinition,
  type OperationIntent,
} from "./operation";
import type { EditProtection } from "./edit-guard";
import type { ModelRuntime, RuntimeObject } from "./model-runtime";
import type { ApplicationNode, ObjectShape } from "./reactive-model";
import type { ModelOperation } from "./model-operation";
import {
  clearSecrets,
  containsSecrets,
  equalValues,
  redactSecrets,
} from "./editor-values";
import { clone, message } from "./clone";
import { validateFields } from "./validation";
import type { Fields } from "./contracts";
const props = defineProps<{
  node: () => RuntimeObject | undefined;
  application: () => ApplicationNode;
  runtime: ModelRuntime;
  path: readonly string[];
  ancestors: readonly unknown[];
  discardVersion: number;
  requestLeave(): Promise<boolean>;
}>();
const emit = defineEmits<{ protection: [value: EditProtection] }>();
type Action = {
  input: ObjectShape;
  importResource?: ModelOperation<
    OperationAction,
    ObjectShape,
    unknown,
    unknown,
    object
  >["importResource"];
  disabledReason?: string;
  printing?: ModelOperation<
    OperationAction,
    ObjectShape,
    unknown,
    unknown,
    object
  >["printing"];
  persistence: OperationDefinition<
    OperationModel,
    unknown,
    unknown
  >["persistence"] & { secrets?: "encrypted" };
} & Omit<
  OperationDefinition<OperationModel, unknown, unknown>["adapter"],
  "execute"
> & {
    run: OperationDefinition<
      OperationModel,
      unknown,
      unknown
    >["adapter"]["execute"];
  };
const operations = computed(
  () => props.node()?.[nodeMetadata].operations ?? {},
);
const actions = computed(
  () =>
    Object.entries(operations.value).filter(
      (entry) => !!entry[1] && modelOperation in entry[1],
    ) as unknown as [OperationAction, Action][],
);
const selected = ref(actions.value[0]?.[0]);
const selectedOperation = computed(
  () => actions.value.find(([key]) => key === selected.value)?.[1],
);
// Preserve the admitted protocol while a node or operation is temporarily withdrawn.
const admitted = shallowRef(selectedOperation.value);
const draft = shallowRef<Record<string, unknown>>({});
const baseline = shallowRef<Record<string, unknown>>({});
const pending = ref(false);
const calculating = ref(false);
const protection = shallowRef<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "blocked",
});
const locked = computed(
  () =>
    protection.value.writeState !== "idle" ||
    protection.value.dirty ||
    protection.value.localPending ||
    pending.value,
);
watch(
  selectedOperation,
  (operation) => {
    if (operation && !locked.value) admitted.value = operation;
  },
  { flush: "sync" },
);
watch(
  admitted,
  (op) => {
    draft.value = op ? props.runtime.flat(op.input) : {};
    baseline.value = clone(draft.value);
  },
  { immediate: true },
);
watch(
  () => props.discardVersion,
  () => {
    if (protection.value.writeState === "idle" && admitted.value)
      draft.value = props.runtime.flat(admitted.value.input);
  },
);
const fields = computed(() =>
  props.node() && admitted.value
    ? (props.runtime
        .fields(admitted.value.input)
        .map((field) =>
          selected.value === "changePassword" && field.type === "secret"
            ? { ...field, type: "password" as const }
            : field,
        ) as unknown as Fields<Record<string, unknown>>)
    : [],
);
const eligible = computed(
  () =>
    !!props.application()[nodeMetadata].options.owner &&
    !!props.node() &&
    selectedOperation.value === admitted.value &&
    !admitted.value?.disabledReason &&
    !pending.value &&
    !calculating.value &&
    validateFields(fields.value, draft.value).valid,
);
const originalIdentity = clone(
  Object.fromEntries(
    (props.node()?.[nodeMetadata].identity ?? []).map((key) => [
      key,
      (props.node() as unknown as Record<string, { value: unknown }>)[key]
        ?.value,
    ]),
  ),
);
const owner = computed(() => {
  const owner = props.application()[nodeMetadata].options.owner ?? {
    ledger: "",
    operator: "",
    generation: "",
  };
  return {
    scope: JSON.stringify(owner),
    operator: owner.operator,
    resource: JSON.stringify([props.path, props.ancestors, originalIdentity]),
  };
});
const identity = computed(() =>
  Object.fromEntries(
    (props.node()?.[nodeMetadata].identity ?? []).map((key) => [
      key,
      (props.node() as unknown as Record<string, { value: unknown }>)[key]
        ?.value,
    ]),
  ),
);
const collaboration = computed(() =>
  admitted.value
    ? props.runtime.resolve(
        () => admitted.value!.input,
        [...props.path, "$input", selected.value!],
        [...props.ancestors, identity.value],
      ).definition.collaboration
    : undefined,
);
async function importFile(value: File | File[] | null) {
  const file = Array.isArray(value) ? value[0] : value,
    op = admitted.value;
  if (!file || !op?.importResource || locked.value) return;
  const controller = new AbortController(),
    scope = owner.value.scope;
  pending.value = true;
  try {
    const result = await op.importResource.read({
      file,
      owner: props.application()[nodeMetadata].options.owner!,
      signal: controller.signal,
    });
    if (scope === owner.value.scope && op === admitted.value && props.node())
      draft.value = props.runtime.flatten(op.input, result);
  } finally {
    pending.value = false;
    controller.abort();
  }
}
const protocols = new Map(actions.value);
const sourcePersistence = admitted.value!.persistence;
const persistence = modelOperationPersistence(sourcePersistence);
const preparedRuns = new Map<string, Action["run"]>();
function protocol(action: OperationAction): Action {
  const current = actions.value.find(([key]) => key === action)?.[1];
  if (current) protocols.set(action, current);
  const result = protocols.get(action);
  if (!result) throw Error("原请求操作不可用。");
  if (result.persistence !== sourcePersistence)
    throw Error("同一办理边界必须共用原请求存储。");
  return result;
}
async function invoke<T>(
  op: Action,
  input: unknown,
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    throw Error(
      redactSecrets(
        props.runtime.fields(op.input),
        props.runtime.flatten(op.input, input),
        message(cause),
      ),
    );
  }
}
const definition: OperationDefinition<OperationModel, unknown, unknown> = {
  protocol: "operation",
  persistence,
  adapter: {
    prepare: async (intent) => {
      const op = protocol(intent.action),
        run = op.run;
      if (
        containsSecrets(
          props.runtime.fields(op.input),
          props.runtime.flatten(op.input, intent.input),
        ) &&
        !("secrets" in op.persistence && op.persistence.secrets === "encrypted")
      )
        throw Error("秘密输入需要消费者加密的原请求存储。");
      const request = await invoke(op, intent.input, () => op.prepare(intent));
      const exposesSecret = (value: unknown): boolean =>
        typeof value === "string"
          ? redactSecrets(
              props.runtime.fields(op.input),
              props.runtime.flatten(op.input, intent.input),
              value,
            ) !== value
          : !!value &&
            typeof value === "object" &&
            Object.values(value).some(exposesSecret);
      if (exposesSecret(request.preview))
        throw Error("秘密值不能包含在办理预览中。");
      if (
        !("ancestors" in request) ||
        !equalValues(
          request.ancestors,
          (intent as unknown as { ancestors: unknown }).ancestors,
        )
      )
        throw Error("准备结果改变了祖先身份。");
      preparedRuns.set(request.requestId, run);
      return request;
    },
    acceptsPreparation: (intent, prepared) => {
      const op = protocol(intent.action);
      try {
        return (
          "ancestors" in prepared &&
          equalValues(
            prepared.ancestors,
            (intent as unknown as { ancestors: unknown }).ancestors,
          ) &&
          op.acceptsPreparation(intent, prepared)
        );
      } catch (cause) {
        throw Error(
          redactSecrets(
            props.runtime.fields(op.input),
            props.runtime.flatten(op.input, intent.input),
            message(cause),
          ),
        );
      }
    },
    execute: (request) => {
      const op = protocol(request.action);
      if (
        !props.node() ||
        !actions.value.some(
          ([key, current]) => key === request.action && current === op,
        ) ||
        op.disabledReason ||
        op.run !== preparedRuns.get(request.requestId) ||
        request.owner.scope !== owner.value.scope ||
        !equalValues(request.identity, identity.value) ||
        !("ancestors" in request) ||
        !equalValues(request.ancestors, props.ancestors)
      )
        throw Error("操作已撤销。");
      return invoke(op, request.input, () => op.run(request));
    },
    reconcile: (request) => {
      const op = protocol(request.action);
      return invoke(op, request.input, () => op.reconcile(request));
    },
    seal: (request, receipt) => {
      const op = protocol(request.action);
      return invoke(op, request.input, () => op.seal(request, receipt));
    },
    refresh: (settlement) => {
      const op = protocol(settlement.request.action);
      return invoke(op, settlement.request.input, () => op.refresh(settlement));
    },
    accepts: (request, receipt) => {
      const op = protocol(request.action);
      try {
        return op.accepts(request, receipt);
      } catch (cause) {
        throw Error(
          redactSecrets(
            props.runtime.fields(op.input),
            props.runtime.flatten(op.input, request.input),
            message(cause),
          ),
        );
      }
    },
  },
};
const intent = computed<
  OperationIntent<OperationModel, unknown> & {
    readonly ancestors: readonly unknown[];
  }
>(() => ({
  action: selected.value!,
  owner: owner.value,
  identity: clone(identity.value),
  ancestors: clone(props.ancestors),
  input: props.runtime.unflat(admitted.value!.input, draft.value, true),
}));
async function choose(action: OperationAction) {
  if (
    locked.value ||
    action === selected.value ||
    !(await props.requestLeave())
  )
    return;
  selected.value = action;
  admitted.value = selectedOperation.value;
}
function settled(
  value: import("./operation").OperationSettlement<
    OperationModel,
    unknown,
    unknown
  >,
) {
  if (
    (value.receipt.status === "applied" ||
      value.request.action === "changePassword") &&
    value.request.action === selected.value &&
    equalValues(value.request.identity, identity.value) &&
    equalValues(value.request.input, intent.value.input)
  ) {
    if (value.request.action === "changePassword") {
      const next = clone(draft.value);
      clearSecrets(props.runtime.fields(admitted.value!.input), next, "");
      props.runtime.adopt(
        admitted.value!.input,
        props.runtime.unflat(admitted.value!.input, next, false),
      );
      draft.value = next;
    }
    baseline.value = clone(draft.value);
  }
}
watch(
  () => ({
    ...protection.value,
    dirty: protection.value.dirty || !equalValues(draft.value, baseline.value),
    localPending:
      protection.value.localPending || pending.value || calculating.value,
  }),
  (value) => emit("protection", value),
  { deep: true },
);
</script>
<template>
  <section aria-label="模型业务办理">
    <div role="group" aria-label="业务操作">
      <VBtn
        v-for="[action, operation] in actions"
        :key="action"
        :disabled="locked || !!operation.disabledReason"
        :title="operation.disabledReason"
        @click="choose(action)"
        >{{ operationLabels[action] }}</VBtn
      >
    </div>
    <template v-if="admitted">
      <DynamicForm
        :fields="fields"
        :model-value="draft"
        :disabled="locked || !selectedOperation || !!admitted.disabledReason"
        :scope="owner.scope"
        mode="edit"
        @update:model-value="draft = $event"
        @pending="pending = $event"
      />
      <DraftCollaborationView
        v-if="collaboration"
        :adapter="collaboration"
        :model-value="draft"
        :scope="owner.scope"
        :instance="selected!"
        :disabled="locked"
        @update:model-value="draft = $event"
        @pending="calculating = $event"
      />
      <VFileInput
        v-if="admitted.importResource"
        prepend-icon=""
        :label="admitted.importResource.label"
        :aria-label="admitted.importResource.label"
        :accept="admitted.importResource.accept"
        :disabled="locked"
        @update:model-value="importFile"
      />
      <OperationRuntime
        :definition="definition"
        :intent="intent"
        :eligible="eligible"
        :recovery-allowed="!!application()[nodeMetadata].options.owner"
        @protection="protection = $event"
        @settled="settled"
      />
      <PrintPreview
        v-if="admitted.printing"
        :document="admitted.printing.document"
        :allowed="admitted.printing.state === 'opened'"
        :disabled="locked"
      />
    </template>
  </section>
</template>
