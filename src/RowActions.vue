<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import {
  VBtn,
  VIcon,
  VList,
  VListItem,
  VMenu,
  VTooltip,
} from "vuetify/components";
import type { ListAction } from "./contracts";
const props = defineProps<{
  actions: readonly ListAction[];
  disabled?: boolean;
  busy?: boolean;
  entries?: readonly {
    key: string;
    label: string;
    href?: string;
    disabled?: boolean;
  }[];
  viewHref?: string;
}>();
const emit = defineEmits<{
  action: [action: ListAction];
  cell: [event: MouseEvent | KeyboardEvent, key: string];
}>();
const menu = ref(false);
const { xs, width } = useDisplay();
const primaryCount = computed(() =>
  xs.value
    ? width.value < 360 && props.actions.length > 2
      ? 1
      : 2
    : props.entries?.length
      ? 1
      : 3,
);
const captions: Record<ListAction, string> = {
  view: "查看",
  send: "送审",
  withdraw: "反送审",
  check: "审核",
  uncheck: "反审核",
  complete: "完成",
  uncomplete: "反完成",
  void: "作废",
  unvoid: "反作废",
  edit: "编辑",
  enable: "启用",
  disable: "停用",
  delete: "删除",
};
const icons: Record<ListAction, string> = {
  view: "mdi-eye-outline",
  send: "mdi-send-outline",
  withdraw: "mdi-email-arrow-left-outline",
  check: "mdi-check-decagram-outline",
  uncheck: "mdi-undo-variant",
  complete: "mdi-check-all",
  uncomplete: "mdi-backup-restore",
  void: "mdi-file-cancel-outline",
  unvoid: "mdi-file-restore-outline",
  edit: "mdi-pencil-outline",
  enable: "mdi-check-circle-outline",
  disable: "mdi-cancel",
  delete: "mdi-delete-outline",
};
watch(
  () => [
    props.actions,
    props.entries,
    props.disabled,
    props.busy,
    props.viewHref,
    primaryCount.value,
  ],
  () => {
    menu.value = false;
  },
);
function choose(event: MouseEvent | KeyboardEvent, action: ListAction) {
  if (props.disabled || props.busy || !props.actions.includes(action)) return;
  if (
    action === "view" &&
    props.viewHref &&
    (event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      (event instanceof MouseEvent && event.button !== 0))
  )
    return;
  emit("action", action);
}
const items = computed(() => [
  ...props.actions.map((action) => ({
    key: `action:${action}`,
    label: captions[action],
    icon: icons[action],
    href: action === "view" ? props.viewHref : undefined,
    disabled: props.disabled || props.busy,
    action,
    cellKey: undefined,
  })),
  ...(props.entries ?? []).map((entry) => ({
    ...entry,
    key: `cell:${entry.key}`,
    cellKey: entry.key,
    icon: "mdi-open-in-new",
    disabled: props.disabled || entry.disabled,
    action: undefined,
  })),
]);
function activate(
  event: MouseEvent | KeyboardEvent,
  item: (typeof items.value)[number],
) {
  if (item.disabled) return;
  if (item.action) choose(event, item.action);
  else if (
    item.cellKey !== undefined &&
    props.entries?.some(
      (entry) => entry.key === item.cellKey && !entry.disabled,
    )
  )
    emit("cell", event, item.cellKey);
}
</script>
<template>
  <div
    v-if="items.length"
    class="zerp-row-actions"
    :class="{ 'zerp-row-actions--mobile': xs }"
  >
    <VTooltip
      v-for="item in items.slice(0, primaryCount)"
      :key="item.key"
      :text="item.label"
      :disabled="xs"
    >
      <template #activator="{ props: tooltip }">
        <VBtn
          v-bind="tooltip"
          :aria-label="item.label"
          :icon="!xs"
          :href="!item.disabled ? item.href : undefined"
          :disabled="item.disabled"
          variant="text"
          color="on-surface"
          size="default"
          :min-width="48"
          :min-height="48"
          @click="activate($event, item)"
          ><VIcon :icon="item.icon" aria-hidden="true" /><span v-if="xs">{{
            item.label
          }}</span></VBtn
        >
      </template>
    </VTooltip>
    <VMenu
      v-if="items.length > primaryCount"
      v-model="menu"
      :disabled="disabled"
      content-class="zerp-row-menu"
    >
      <template #activator="{ props: activator }">
        <VBtn
          v-bind="activator"
          aria-label="更多操作"
          :title="xs ? undefined : '更多操作'"
          :icon="!xs"
          :disabled="disabled"
          variant="text"
          color="on-surface"
          size="default"
          :min-width="48"
          :min-height="48"
          ><VIcon icon="mdi-dots-horizontal" aria-hidden="true" /><span
            v-if="xs"
            >更多</span
          ></VBtn
        >
      </template>
      <VList role="menu" aria-label="更多操作">
        <VListItem
          v-for="item in items.slice(primaryCount)"
          :key="item.key"
          role="menuitem"
          :title="item.label"
          :prepend-icon="item.icon"
          :href="!item.disabled ? item.href : undefined"
          :disabled="item.disabled"
          :aria-disabled="item.disabled || undefined"
          @click="activate($event, item)"
        />
      </VList>
    </VMenu>
  </div>
  <span v-else>—</span>
</template>
<style scoped>
.zerp-row-actions {
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.zerp-row-actions--mobile :deep(.v-btn) {
  padding-inline: 4px;
  font-size: 0.875rem;
}
.zerp-row-actions--mobile :deep(.v-btn__content) {
  gap: 4px;
}
.zerp-row-actions--mobile :deep(.v-icon) {
  font-size: 18px;
}
</style>
