<script setup lang="ts">
import { reloadWorkbench, isPending } from "./business-operations";

import { readable as nodeReadable } from "./business-nodes";
import { computed } from "vue";
import {
  VCard,
  VCardTitle,
  VCardText,
  VBtn,
  VList,
  VListItem,
  VListItemTitle,
} from "vuetify/components";
import type { Workbench, RecordsNode, ObjectNode } from "./business-model";
import { formatField } from "./model-format";
import BusinessFeedback from "./BusinessFeedback.vue";
import {
  readableTarget,
  availableTarget,
  targetHref,
  visitTarget,
  plainClick,
  renderedHref,
  targetStamp,
  renderedTarget,
} from "./model-target";
const props = defineProps<{
  node: Workbench;
}>();
const sections = computed(() =>
  (["information", "vouchers", "reports", "masters"] as const)
    .map((role) => ({ role, node: props.node[role] }))
    .filter((section) => nodeReadable(section.node)),
);
function caption(row: ObjectNode) {
  return row.members
    .flatMap((field) => {
      if (
        !nodeReadable(field) ||
        !("value" in field) ||
        field.kind === "interactions" ||
        field.kind === "output" ||
        field.kind === "secret" ||
        field.kind === "password" ||
        field.kind === "attachments"
      )
        return [];
      try {
        return [formatField(field)];
      } catch (error) {
        return [error instanceof Error ? error.message : "格式错误"];
      }
    })
    .filter(Boolean)
    .join(" · ");
}
function rows(section: RecordsNode) {
  return section.items.filter(
    (row) =>
      nodeReadable(row) &&
      (!props.node.targets?.get(row) ||
        readableTarget(props.node.targets.get(row)!)),
  );
}
function canOpen(row: ObjectNode) {
  const target = props.node.targets?.get(row);
  return !!target && availableTarget(target);
}
function pending(row: ObjectNode) {
  return isPending(row);
}
function open(event: MouseEvent | KeyboardEvent, row: ObjectNode) {
  const target = props.node.targets?.get(row);
  if (
    !sections.value.some((section) => section.node.items.includes(row)) ||
    !canOpen(row) ||
    pending(row)
  ) {
    event.preventDefault();
    return;
  }
  if (
    !target ||
    renderedTarget(event) !== targetStamp(target) ||
    renderedHref(event) !== (targetHref(target) ?? null)
  ) {
    event.preventDefault();
    return;
  }
  if (!plainClick(event)) return;
  event.preventDefault();
  visitTarget(target);
}
function manage(event: MouseEvent) {
  const target = props.node.manageReports;
  if (
    !target ||
    !nodeReadable(props.node.reports) ||
    !availableTarget(target)
  ) {
    event.preventDefault();
    return;
  }
  if (renderedHref(event) !== targetHref(target)) {
    event.preventDefault();
    return;
  }
  if (!plainClick(event)) return;
  event.preventDefault();
  visitTarget(target);
}
function refresh() {
  void reloadWorkbench(props.node);
}
</script>
<template>
  <section class="zerp-workbench" aria-label="工作台">
    <VBtn
      v-if="node.load && sections.length"
      class="mb-3"
      :loading="isPending(node)"
      :disabled="isPending(node)"
      @click="refresh"
      >刷新</VBtn
    >
    <div class="zerp-workbench-grid">
      <VCard
        v-for="section in sections"
        :key="section.role"
        tag="section"
        variant="flat"
        border
        :aria-label="section.node.label ?? undefined"
        :class="{
          'zerp-workbench-information': section.role === 'information',
        }"
      >
        <VCardTitle tag="h2">{{ section.node.label }}</VCardTitle>
        <VCardText
          ><VList v-if="rows(section.node).length" class="zerp-workbench-links">
            <VListItem
              v-for="row in rows(section.node)"
              :key="row.identity ?? row.key"
              :link="canOpen(row)"
              :data-target="targetStamp(node.targets?.get(row))"
              :role="
                canOpen(row) && node.targets?.get(row)?.record
                  ? 'button'
                  : undefined
              "
              :type="
                canOpen(row) && node.targets?.get(row)?.record
                  ? 'button'
                  : undefined
              "
              :tag="
                canOpen(row) && node.targets?.get(row)?.record
                  ? 'button'
                  : 'div'
              "
              :disabled="canOpen(row) && pending(row)"
              :href="
                canOpen(row) && node.targets?.get(row)
                  ? targetHref(node.targets.get(row)!)
                  : undefined
              "
              @click="open($event, row)"
              ><VListItemTitle>{{ caption(row) }}</VListItemTitle></VListItem
            >
          </VList>
          <p v-else>暂无内容</p>
          <VBtn
            v-if="
              section.role === 'reports' &&
              node.manageReports &&
              availableTarget(node.manageReports)
            "
            :href="targetHref(node.manageReports)"
            variant="text"
            @click="manage"
            >管理常用报表</VBtn
          >
          <BusinessFeedback :target="section.node" fixed />
        </VCardText>
      </VCard>
    </div>
  </section>
</template>
