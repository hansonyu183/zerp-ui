<script setup lang="ts">
import { computed, inject, toRaw, watch } from "vue";
import {
  VCard,
  VCardTitle,
  VCardText,
  VCardActions,
  VBtn,
  VList,
  VListItem,
  VListItemTitle,
} from "vuetify/components";
import BusinessNode from "./BusinessNode.vue";
import { nodeMetadata as meta } from "./model-node";
import {
  directRuntimeKey,
  type ObjectNode,
  type CollectionNode,
  type Target,
} from "./direct-model-runtime";
const props = defineProps<{ node: ObjectNode }>();
const runtime = inject(directRuntimeKey)!;
const roles = computed(() =>
  props.node[meta].family === "workbench" ? props.node[meta].workbench : null,
);
const sections = computed(() =>
  roles.value
    ? (["information", "vouchers", "reports", "documents"] as const)
        .map((role) => ({ role, node: roles.value![role] }))
        .filter((section) => runtime.readable(section.node))
    : [],
);
function rows(node: ObjectNode | CollectionNode) {
  return (node as CollectionNode).items.filter((row) => runtime.readable(row));
}
function caption(collection: ObjectNode | CollectionNode, row: ObjectNode) {
  return (collection as CollectionNode)[meta].list
    .flatMap((key) => {
      const field = row[key];
      return field &&
        runtime.readable(field) &&
        "value" in field &&
        ["text", "integer", "decimal", "date", "datetime", "longText"].includes(
          field[meta].kind,
        )
        ? [String(field.value ?? "")]
        : [];
    })
    .filter(Boolean)
    .join(" · ");
}
function link(collection: ObjectNode | CollectionNode, row: ObjectNode) {
  return (collection as CollectionNode)[meta].report?.cells?.find(
    (cell) =>
      toRaw(cell.row) === toRaw(row) &&
      runtime.readable(row[cell.field]!) &&
      runtime.readable(cell.target),
  );
}
function visitTarget(event: MouseEvent | KeyboardEvent, target: Target) {
  if (
    !runtime.readable(target) ||
    event.defaultPrevented ||
    ("button" in event && event.button !== 0) ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  )
    return;
  event.preventDefault();
  runtime.model()[meta].navigation.visit(target);
}
function visit(
  event: MouseEvent | KeyboardEvent,
  collection: ObjectNode | CollectionNode,
  row: ObjectNode,
) {
  const target = link(collection, row);
  if (
    !target ||
    target.disabledReason ||
    event.defaultPrevented ||
    ("button" in event && event.button !== 0) ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  )
    return;
  visitTarget(event, target.target);
}
const activated = new WeakSet<object>();
watch(
  [() => props.node, sections],
  () => {
    // A root reader owns orchestration. Otherwise each displayed independent role activates once.
    const nodes = runtime.operations(props.node).get
      ? [props.node]
      : sections.value.map((section) => section.node);
    for (const node of nodes) {
      if (activated.has(toRaw(node))) continue;
      activated.add(toRaw(node));
      void runtime.run(
        node,
        node[meta].kind === "collection" ? "query" : "get",
      );
    }
  },
  { immediate: true },
);
</script>
<template>
  <section class="zerp-workbench" :aria-label="node[meta].name">
    <div class="zerp-workbench-grid">
      <VCard
        v-for="section in sections"
        :key="section.role"
        tag="section"
        :aria-label="section.node[meta].name"
        :class="{
          'zerp-workbench-information': section.role === 'information',
        }"
      >
        <VCardTitle tag="h2">{{ section.node[meta].name }}</VCardTitle>
        <VCardText>
          <BusinessNode
            v-if="section.node[meta].kind === 'object'"
            :node="section.node"
            :auto-read="false"
          />
          <VList
            v-else-if="rows(section.node).length"
            class="zerp-workbench-links"
          >
            <VListItem
              v-for="(row, index) in rows(section.node)"
              :key="row[meta].identity ?? index"
              :href="
                link(section.node, row) &&
                !link(section.node, row)?.disabledReason
                  ? runtime
                      .model()
                      [meta].navigation.href(link(section.node, row)!.target)
                  : undefined
              "
              :disabled="!!link(section.node, row)?.disabledReason"
              :title="link(section.node, row)?.disabledReason"
              @click="visit($event, section.node, row)"
            >
              <VListItemTitle>{{ caption(section.node, row) }}</VListItemTitle>
            </VListItem>
          </VList>
          <p v-else>暂无内容</p>
        </VCardText>
        <VCardActions
          v-if="
            section.role === 'reports' &&
            roles?.manageReports &&
            runtime.readable(roles.manageReports)
          "
        >
          <VBtn
            :href="runtime.model()[meta].navigation.href(roles.manageReports)"
            @click="visitTarget($event, roles.manageReports)"
            >管理常用报表</VBtn
          >
        </VCardActions>
      </VCard>
    </div>
  </section>
</template>
