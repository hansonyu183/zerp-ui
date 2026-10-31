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
    SE = never
  "
>
import type { EditProtection } from "./edit-guard";
import type { DomainBlock } from "./domain-blocks";
import { computed, shallowRef, watch } from "vue";
import ConfigurationView from "./ConfigurationView.vue";
import { writeLock } from "./write-lock";
import SubmissionRuntime from "./SubmissionRuntime.vue";
import type {
  VoucherDefinition,
  VoucherSnapshot,
  VoucherIdentity,
} from "./voucher";
import type { DocumentSnapshot } from "./document";
import type { SubmissionDefinition } from "./submission";
import type { ConfigurationDefinition } from "./configuration";
const props = defineProps<{
  definition: VoucherDefinition<D, I, R, U, S, O, H, A, E>;
  scope: string;
  beforeClose?: () => Promise<boolean>;
  discardVersion?: number;
  permissions: { read: boolean; write: boolean; reconcile?: boolean };
  blocks?: readonly DomainBlock<D>[];
  script?: {
    definition: ConfigurationDefinition<SD, SF, SR, SI, SE>;
    permissions: { read: boolean; write: boolean; reconcile?: boolean };
  };
}>();
type Identity = VoucherIdentity<I, R, U>;
type Snapshot = VoucherSnapshot<D, I, R, U, S, O, H>;
function toDocument(s: Snapshot): DocumentSnapshot<D, Identity, S, O, H> {
  return { ...s, label: `${s.number} · ${s.handler}` };
}
function fromDocument(s: DocumentSnapshot<D, Identity, S, O, H>): Snapshot {
  // Metadata stays separate from the editable domain value and is never parsed from a caption.
  return {
    ...s,
    number: (s as Snapshot & typeof s).number,
    handler: (s as Snapshot & typeof s).handler,
  };
}
const vouchers = computed(() => {
  const a = props.definition.adapter;
  return {
    list: a.list,
    get: async (input: { scope: string; identity: Identity }) => {
      const result = await a.get(input);
      return {
        official: result.current && toDocument(result.current),
        candidate: null,
        history: result.history.map(toDocument),
        audit: result.audit,
      };
    },
    empty: a.empty
      ? (input: { scope: string }) => toDocument(a.empty!(input))
      : undefined,
    canClone: (source: DocumentSnapshot<D, Identity, S, O, H>) =>
      !!fromDocument(source).eligible.clone,
    clone: a.clone
      ? (input: {
          scope: string;
          source: DocumentSnapshot<D, Identity, S, O, H>;
        }) =>
          toDocument(a.clone!({ ...input, source: fromDocument(input.source) }))
      : undefined,
  };
});
const bridge = computed<SubmissionDefinition<D, Identity, S, O, H, A, E>>(
  () => ({
    resource: props.definition.resource,
    title: props.definition.title,
    fields: props.definition.fields,
    auditColumns: props.definition.auditColumns,
    adapter: props.definition.adapter,
    vouchers: vouchers.value,
    reconcile: props.definition.reconcile
      ? (attempt) => {
          if (attempt.operation === "enable" || attempt.operation === "disable")
            return Promise.resolve({ status: "unknown" });
          return props.definition.reconcile!(attempt);
        }
      : undefined,
  }),
);
const scriptBlocked = computed(
  () =>
    !!props.script &&
    writeLock(
      props.script.definition.adapter,
      `configuration:${props.script.definition.resource}`,
      props.scope,
    ).phase !== "idle",
);
const voucherBlocked = computed(
  () =>
    writeLock(
      props.definition.adapter,
      `voucher:${props.definition.resource}`,
      props.scope,
    ).phase !== "idle",
);
const scriptPermissions = computed(
  () =>
    props.script && {
      ...props.script.permissions,
      write: props.script.permissions.write && !voucherBlocked.value,
    },
);
const emit = defineEmits<{ protection: [state: EditProtection] }>();
const clean: EditProtection = {
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "idle",
};
const voucherProtection = shallowRef<EditProtection>(clean),
  scriptProtection = shallowRef<EditProtection>(clean);
watch(
  () => ({
    dirty: voucherProtection.value.dirty || scriptProtection.value.dirty,
    localPending:
      voucherProtection.value.localPending ||
      scriptProtection.value.localPending,
    invalid: voucherProtection.value.invalid || scriptProtection.value.invalid,
    writeState:
      voucherProtection.value.writeState !== "idle"
        ? voucherProtection.value.writeState
        : scriptProtection.value.writeState,
  }),
  (value) => emit("protection", value),
  { immediate: true, flush: "sync" },
);
watch(
  () => props.script,
  (value) => {
    if (!value) scriptProtection.value = clean;
  },
);
</script>
<template>
  <SubmissionRuntime
    kind="voucher"
    :definition="bridge"
    :lock-adapter="definition.adapter"
    :scope="scope"
    :permissions="permissions"
    :blocks="blocks"
    :before-close="beforeClose"
    :discard-version="discardVersion"
    @protection="voucherProtection = $event"
    :external-disabled="scriptBlocked"
  /><ConfigurationView
    v-if="script && scriptPermissions"
    :definition="script.definition"
    :scope="scope"
    :permissions="scriptPermissions"
    :before-close="beforeClose"
    :discard-version="discardVersion"
    @protection="scriptProtection = $event"
  />
</template>
