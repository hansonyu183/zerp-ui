<script
  setup
  lang="ts"
  generic="
    D extends object,
    I,
    R,
    U,
    S,
    O,
    H,
    A extends object,
    E = never,
    SD extends object = object,
    SF extends object = object,
    SR extends object = object,
    SI = never,
    SE = never,
    M extends VoucherOperationModel = VoucherOperationModel,
    OI = unknown,
    B = unknown
  "
>
import type { DomainBlock } from "./domain-blocks";
import { computed, ref } from "vue";
import VoucherSubmission from "./VoucherSubmission.vue";
import VoucherOperationRuntime from "./VoucherOperationRuntime.vue";
import type { VoucherDefinition } from "./voucher";
import type { ConfigurationDefinition } from "./configuration";
import type {
  VoucherOperationHandle,
  VoucherOperationDefinition,
  VoucherOperationIntent,
  VoucherOperationModel,
  VoucherOperationSettlement,
} from "./voucher-operation";
import type { EditProtection } from "./edit-guard";
type SubmissionProps = {
  definition: VoucherDefinition<D, I, R, U, S, O, H, A, E>;
  intent?: never;
  eligible?: never;
  recoveryAllowed?: never;
  scope: string;
  permissions: { read: boolean; write: boolean; reconcile?: boolean };
  blocks?: readonly DomainBlock<D>[];
  script?: {
    definition: ConfigurationDefinition<SD, SF, SR, SI, SE>;
    permissions: { read: boolean; write: boolean; reconcile?: boolean };
  };
};
type OperationProps = {
  definition: VoucherOperationDefinition<M, OI, B>;
  scope?: never;
  permissions?: never;
  blocks?: never;
  script?: never;
  intent: VoucherOperationIntent<M, OI>;
  eligible: boolean;
  recoveryAllowed: boolean;
};
type Props = SubmissionProps | OperationProps;
const props = defineProps<Props>();
const emit = defineEmits<{
  protection: [state: EditProtection];
  settled: [settlement: VoucherOperationSettlement<M, OI, B>];
}>();
function isOperation(value: Props): value is OperationProps {
  return value.definition.protocol === "operation";
}
// Vue normalizes Boolean props even on the other protocol; discriminate the original public union.
const operation = computed(() => {
  const value = props as Props;
  return isOperation(value) ? value : null;
});
function isSubmission(value: Props): value is SubmissionProps {
  return value.definition.protocol === "submission";
}
const submission = computed(() => {
  const value = props as Props;
  return isSubmission(value) ? value : null;
});
const operationView = ref<VoucherOperationHandle>();
defineExpose<VoucherOperationHandle>({
  async prepare() {
    await operationView.value?.prepare();
  },
});
</script>
<template>
  <VoucherOperationRuntime
    ref="operationView"
    v-if="operation"
    :definition="operation.definition"
    :intent="operation.intent"
    :eligible="operation.eligible"
    :recovery-allowed="operation.recoveryAllowed"
    @settled="emit('settled', $event)"
    @protection="emit('protection', $event)"
  />
  <VoucherSubmission
    v-if="submission"
    :definition="submission.definition"
    :scope="submission.scope"
    :permissions="submission.permissions"
    :blocks="submission.blocks"
    :script="submission.script"
  />
</template>
