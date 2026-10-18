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
import { computed } from "vue";
import ConfigurationView from "./ConfigurationView.vue";
import { writeLock } from "./write-lock";
import SubmissionRuntime from "./SubmissionRuntime.vue";
import type {
  DocumentDefinition,
  DocumentSnapshot,
  DocumentIdentity,
} from "./document";
import type { VersionSnapshot } from "./version";
import type { SubmissionDefinition } from "./submission";
import type {
  ConfigurationBlock,
  ConfigurationDefinition,
} from "./configuration";
const props = defineProps<{
  definition: DocumentDefinition<D, I, R, U, S, O, H, A, E>;
  scope: string;
  permissions: { read: boolean; write: boolean; reconcile?: boolean };
  blocks?: readonly ConfigurationBlock<D>[];
  script?: {
    definition: ConfigurationDefinition<SD, SF, SR, SI, SE>;
    permissions: { read: boolean; write: boolean; reconcile?: boolean };
  };
}>();
type Identity = DocumentIdentity<I, R, U>;
type Snapshot = DocumentSnapshot<D, I, R, U, S, O, H>;
function toVersion(s: Snapshot): VersionSnapshot<D, Identity, S, O, H> {
  return { ...s, label: `${s.number} · ${s.handler}` };
}
function fromVersion(s: VersionSnapshot<D, Identity, S, O, H>): Snapshot {
  // Metadata stays separate from the editable domain value and is never parsed from a caption.
  return {
    ...s,
    number: (s as Snapshot & typeof s).number,
    handler: (s as Snapshot & typeof s).handler,
  };
}
const documents = computed(() => {
  const a = props.definition.adapter;
  return {
    list: a.list,
    get: async (input: { scope: string; identity: Identity }) => {
      const result = await a.get(input);
      return {
        official: result.current && toVersion(result.current),
        candidate: null,
        history: result.history.map(toVersion),
        audit: result.audit,
      };
    },
    empty: a.empty
      ? (input: { scope: string }) => toVersion(a.empty!(input))
      : undefined,
    canClone: (source: VersionSnapshot<D, Identity, S, O, H>) =>
      !!fromVersion(source).eligible.clone,
    clone: a.clone
      ? (input: {
          scope: string;
          source: VersionSnapshot<D, Identity, S, O, H>;
        }) =>
          toVersion(a.clone!({ ...input, source: fromVersion(input.source) }))
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
    documents: documents.value,
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
const documentBlocked = computed(
  () =>
    writeLock(
      props.definition.adapter,
      `document:${props.definition.resource}`,
      props.scope,
    ).phase !== "idle",
);
const scriptPermissions = computed(
  () =>
    props.script && {
      ...props.script.permissions,
      write: props.script.permissions.write && !documentBlocked.value,
    },
);
</script>
<template>
  <SubmissionRuntime
    kind="document"
    :definition="bridge"
    :lock-adapter="definition.adapter"
    :scope="scope"
    :permissions="permissions"
    :blocks="blocks"
    :external-disabled="scriptBlocked"
  /><ConfigurationView
    v-if="script && scriptPermissions"
    :definition="script.definition"
    :scope="scope"
    :permissions="scriptPermissions"
  />
</template>
