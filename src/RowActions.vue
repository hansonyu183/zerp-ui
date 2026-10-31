<script setup lang="ts">
import { ref, watch } from "vue";
import { VBtn, VList, VListItem, VMenu, VTooltip } from "vuetify/components";
import type { ListAction } from "./contracts";
const props = defineProps<{
  actions: readonly ListAction[];
  disabled?: boolean;
  viewHref?: string;
}>();
const emit = defineEmits<{ action: [action: ListAction] }>();
const menu = ref(false);
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
  () => [props.actions, props.disabled, props.viewHref],
  () => {
    menu.value = false;
  },
);
function choose(event: MouseEvent | KeyboardEvent, action: ListAction) {
  if (props.disabled || !props.actions.includes(action)) return;
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
</script>
<template>
  <div v-if="actions.length" class="zerp-row-actions">
    <VTooltip
      v-for="action in actions.slice(0, 3)"
      :key="action"
      :text="captions[action]"
    >
      <template #activator="{ props: tooltip }">
        <VBtn
          v-bind="tooltip"
          :aria-label="captions[action]"
          :icon="icons[action]"
          :href="action === 'view' && !disabled ? viewHref : undefined"
          :disabled="disabled"
          variant="text"
          size="small"
          @click="choose($event, action)"
        />
      </template>
    </VTooltip>
    <VMenu
      v-if="actions.length > 3"
      v-model="menu"
      :disabled="disabled"
      content-class="zerp-row-menu"
    >
      <template #activator="{ props: activator }">
        <VBtn
          v-bind="activator"
          aria-label="更多操作"
          title="更多操作"
          icon="mdi-dots-horizontal"
          :disabled="disabled"
          variant="text"
          size="small"
        />
      </template>
      <VList role="menu" aria-label="更多操作">
        <VListItem
          v-for="action in actions.slice(3)"
          :key="action"
          role="menuitem"
          :title="captions[action]"
          :prepend-icon="icons[action]"
          :href="action === 'view' && !disabled ? viewHref : undefined"
          :disabled="disabled"
          @click="choose($event, action)"
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
</style>
