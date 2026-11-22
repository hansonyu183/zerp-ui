<script setup lang="ts">
import { computed, inject, toRaw, watch } from "vue";
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
import { directRuntimeKey } from "./direct-model-runtime";
import { formatField } from "./model-format";
import BusinessFeedback from "./BusinessFeedback.vue";
import {
  readableTarget,
  availableTarget,
  canOpenRecord,
  targetHref,
  visitTarget,
  plainClick,
  renderedHref,
} from "./model-target";
const props = defineProps<{ node: Workbench }>();
const runtime = inject(directRuntimeKey)!;
const sections = computed(() =>
  (["information", "vouchers", "reports", "masters"] as const)
    .map((role) => ({ role, node: props.node[role] }))
    .filter((section) => runtime.readable(section.node)),
);
function caption(row: ObjectNode) {
  return row.members
    .flatMap((field) => {
      if (
        field.label === null ||
        !runtime.readable(field) ||
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
      runtime.readable(row) &&
      (!props.node.targets?.get(row) ||
        readableTarget(runtime, props.node.targets.get(row)!)),
  );
}
function canOpen(row: ObjectNode) {
  const target = props.node.targets?.get(row);
  return target
    ? canOpenRecord(runtime, row) && availableTarget(runtime, target)
    : runtime.available(row, "get");
}
function pending(row: ObjectNode) {
  return runtime.busy.value.has(toRaw(row));
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
  if (!target) {
    if (renderedHref(event) !== null) {
      event.preventDefault();
      return;
    }
    void runtime.run(row, "get");
    return;
  }
  if (renderedHref(event) !== targetHref(runtime, target)) {
    event.preventDefault();
    return;
  }
  if (!plainClick(event)) return;
  event.preventDefault();
  visitTarget(runtime, target);
}
function manage(event: MouseEvent) {
  const target = props.node.manageReports;
  if (
    !target ||
    !runtime.readable(props.node.reports) ||
    !availableTarget(runtime, target)
  ) {
    event.preventDefault();
    return;
  }
  if (renderedHref(event) !== targetHref(runtime, target)) {
    event.preventDefault();
    return;
  }
  if (!plainClick(event)) return;
  event.preventDefault();
  visitTarget(runtime, target);
}
const activated = new Set<string>();
watch(
  [runtime.scope, () => sections.value.length, () => props.node.load?.disabled],
  () => {
    const owner = runtime.scope.value;
    if (
      !sections.value.length ||
      !runtime.ready.value ||
      activated.has(owner) ||
      !props.node.load ||
      props.node.load.disabled
    )
      return;
    activated.add(owner);
    void runtime.runWorkbench(true);
  },
  { immediate: true },
);
</script>
<template>
  <section class="zerp-workbench" aria-label="工作台">
    <VBtn
      v-if="node.load && !node.load.disabled && sections.length"
      :disabled="runtime.busy.value.has(toRaw(node))"
      @click="runtime.runWorkbench()"
      >刷新</VBtn
    >
    <div class="zerp-workbench-grid">
      <VCard
        v-for="section in sections"
        :key="section.role"
        tag="section"
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
              :disabled="canOpen(row) && pending(row)"
              :href="
                canOpen(row) && node.targets?.get(row)
                  ? targetHref(runtime, node.targets.get(row)!)
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
              availableTarget(runtime, node.manageReports)
            "
            :href="targetHref(runtime, node.manageReports)"
            variant="text"
            @click="manage"
            >管理常用报表</VBtn
          >
          <BusinessFeedback
            :target="section.node"
            fixed
            :blocked="node.load?.disabled"
          />
        </VCardText>
      </VCard>
    </div>
  </section>
</template>
