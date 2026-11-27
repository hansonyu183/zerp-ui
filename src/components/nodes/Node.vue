<script setup lang="ts">
import { computed } from "vue";
import { isPending, runOperation } from "../../app/operations";
import { sessionScope } from "../../app/session";
import {
  available as nodeAvailable,
  operations as nodeOperations,
  readable as nodeReadable,
  writable as nodeWritable,
} from "../../app/nodes";
import type {
  Node,
  ObjectNode,
  CollectionTarget,
  RecordsNode,
  FieldNode,
} from "../../model/business-model";
import Field from "../forms/Field.vue";
import ActionGroup from "./ActionGroup.vue";
import Records from "./Records.vue";
import Groups from "./Groups.vue";
import NodeContent from "./NodeContent.vue";
const props = defineProps<{
  node: Node;
  targetHref?: (target: CollectionTarget) => string | undefined;
  readOnly?: boolean;
  filter?: boolean;
  editing?: boolean;
  profile?: boolean;
  save?: (node: ObjectNode) => Promise<void>;
}>();
const emit = defineEmits<{ visit: [target: CollectionTarget] }>();
const records = computed(() => props.node as RecordsNode);
const field = computed(() => props.node as FieldNode);
const visible = computed(() =>
  props.node.kind === "object" ? props.node.members.filter(nodeReadable) : [],
);
const runs = computed(() => {
  const result: {
    key: string;
    grouped: boolean;
    entries: Node[];
  }[] = [];
  for (const entry of visible.value) {
    const grouped = entry.kind === "object" || entry.kind === "records";
    const previous = result.at(-1);
    if (previous?.grouped === grouped) previous.entries.push(entry);
    else
      result.push({
        key: `${grouped ? "groups" : "fields"}-${entry.key}`,
        grouped,
        entries: [entry],
      });
  }
  return result;
});
const actions = computed(() =>
  Object.keys(nodeOperations(props.node)).filter(
    (key) =>
      key !== "query" &&
      !(key === "print" && props.node.kind === "output") &&
      !(
        key === "load" &&
        ["reference", "treeReference"].includes(props.node.kind)
      ) &&
      (!props.readOnly ||
        props.node.kind === "output" ||
        [
          "get",
          "reconcile",
          "load",
          "preview",
          "print",
          "export",
          "audit",
          "openVoucher",
        ].includes(key)) &&
      nodeAvailable(props.node, key),
  ),
);
const saveUnavailable = computed(() => {
  const node = props.node;
  return (
    node.kind === "object" &&
    (props.editing || (props.profile && nodeWritable(node))) &&
    !actions.value.includes("update")
  );
});
const pending = computed(() => isPending(props.node));
async function action(name: string) {
  const node = props.node;
  if (name === "update" && props.save && node.kind === "object") {
    await props.save(node);
    return;
  }
  await runOperation(node, name);
}
</script>
<template>
  <section v-if="nodeReadable(node)" :aria-label="node.label ?? undefined">
    <template v-if="node.kind === 'object'">
      <template v-for="run in runs" :key="run.key">
        <Groups
          v-if="run.grouped"
          :entries="run.entries"
          :name="node.label ?? ''"
          :target-href="targetHref"
          @visit="emit('visit', $event)"
          :read-only="readOnly"
          :filter="filter"
          :save="save"
        />
        <div
          v-else
          class="zerp-direct-form"
          :class="{
            'zerp-direct-form--short': run.entries.length <= 3,
            'zerp-direct-form--filter': filter,
          }"
        >
          <Node
            v-for="child in run.entries"
            :key="child.key"
            :node="child"
            :target-href="targetHref"
            @visit="emit('visit', $event)"
            :read-only="readOnly"
            :class="{
              'zerp-direct-form-wide':
                child.kind === 'longText' || child.kind === 'records',
            }"
          />
        </div>
      </template>
    </template>
    <Records
      v-else-if="node.kind === 'records'"
      :node="records"
      :target-href="targetHref"
      @visit="emit('visit', $event)"
      :read-only="readOnly"
    />
    <NodeContent
      v-else-if="node.kind === 'output' || node.kind === 'interactions'"
      :node="node"
      :target-href="targetHref"
      @visit="emit('visit', $event)"
      :read-only="readOnly"
    />
    <Field
      v-else
      :node="field"
      :read-only="readOnly || !nodeWritable(node)"
      :scope="sessionScope"
    />
    <ActionGroup
      v-if="actions.length || saveUnavailable"
      class="zerp-business-actions"
      :actions="actions"
      :pending="pending"
      :aria-label="`${node.label ?? ''}操作`"
      @action="action"
    >
      <p v-if="saveUnavailable" role="status">当前无法保存。</p>
    </ActionGroup>
  </section>
</template>
<style scoped>
section {
  min-width: 0;
  container-type: inline-size;
}
.zerp-direct-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.zerp-direct-form > * {
  min-width: 0;
}
.zerp-direct-form-wide {
  grid-column: 1/-1;
}
@container (min-width:520px) {
  .zerp-direct-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (min-width:800px) {
  .zerp-direct-form {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@container (min-width:1060px) {
  .zerp-direct-form--filter {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.zerp-direct-form--short {
  grid-template-columns: 1fr;
}
</style>
