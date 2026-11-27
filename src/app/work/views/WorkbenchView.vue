<script setup lang="ts">
// 呈现工作台的固定区块和快捷目标，记录目标交给 WorkPage 打开。
import { isPending } from "../../usePending";
import { readWorkbench } from "../reads";

import { readable as nodeReadable } from "../../nodes";
import { workbenchSections } from "../structure";
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
import type {
  Workbench,
  CollectionTarget,
  ObjectNode,
} from "../../../model/business-model";
import { formatField } from "../../../components/forms/model-format";
import ModelFeedback from "../../ModelFeedback.vue";
import {
  plainClick,
  renderedHref,
  renderedTarget,
} from "../../../components/links";
import { targetStamp } from "../../target";
import { resolveTarget, targetHref } from "../work-router";
const props = defineProps<{
  node: Workbench;
}>();
const emit = defineEmits<{ visit: [target: CollectionTarget] }>();
const sections = computed(() =>
  workbenchSections(props.node)
    .filter((section) => nodeReadable(section.node))
    .map((section) => ({
      ...section,
      rows: section.node.items.flatMap(presentRow),
    })),
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
function presentRow(row: ObjectNode) {
  if (!nodeReadable(row)) return [];
  const target = props.node.targets?.get(row);
  const destination = target && resolveTarget(target);
  if (target && !destination) return [];
  const linked = !!destination?.available;
  return [
    {
      row,
      target,
      linked,
      button: linked && !!target?.record,
      stamp: linked ? targetStamp(target) : undefined,
      href: destination?.href,
      busy: linked && isPending(row),
      label: caption(row),
    },
  ];
}
function open(event: MouseEvent | KeyboardEvent, row: ObjectNode) {
  let entry: (typeof sections.value)[number]["rows"][number] | undefined;
  for (const section of sections.value) {
    entry = section.rows.find((item) => item.row === row);
    if (entry) break;
  }
  if (
    !entry?.target ||
    !entry.linked ||
    entry.busy ||
    renderedTarget(event) !== entry.stamp ||
    renderedHref(event) !== (entry.href ?? null)
  ) {
    event.preventDefault();
    return;
  }
  if (!plainClick(event)) return;
  event.preventDefault();
  emit("visit", entry.target);
}
const manageHref = computed(() => {
  const target = props.node.manageReports;
  return target && nodeReadable(props.node.reports)
    ? targetHref(target)
    : undefined;
});
function manage(event: MouseEvent) {
  const target = props.node.manageReports;
  if (
    !target ||
    !manageHref.value ||
    renderedHref(event) !== manageHref.value
  ) {
    event.preventDefault();
    return;
  }
  if (!plainClick(event)) return;
  event.preventDefault();
  emit("visit", target);
}
function refresh() {
  void readWorkbench(props.node, false);
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
          ><VList v-if="section.rows.length" class="zerp-workbench-links">
            <VListItem
              v-for="{
                row,
                linked,
                button,
                stamp,
                href,
                busy,
                label,
              } in section.rows"
              :key="row.identity ?? row.key"
              :link="linked"
              :data-target="stamp"
              :role="button ? 'button' : undefined"
              :type="button ? 'button' : undefined"
              :tag="button ? 'button' : 'div'"
              :disabled="busy"
              :href="href"
              @click="open($event, row)"
              ><VListItemTitle>{{ label }}</VListItemTitle></VListItem
            >
          </VList>
          <p v-else>暂无内容</p>
          <VBtn
            v-if="section.role === 'reports' && manageHref"
            :href="manageHref"
            variant="text"
            @click="manage"
            >管理常用报表</VBtn
          >
          <ModelFeedback :target="section.node" fixed />
        </VCardText>
      </VCard>
    </div>
  </section>
</template>
