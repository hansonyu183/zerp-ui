<script setup lang="ts">
// 按视口宽度呈现行操作，将溢出操作放入菜单并保留键盘可达性。
import { computed, nextTick, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import {
  VBtn,
  VIcon,
  VList,
  VListItem,
  VMenu,
  VTooltip,
} from "vuetify/components";
import { rowActionIcons, type RowAction } from "./row-action";
import { labels } from "../../../../components/nodes/operation-labels";
const props = defineProps<{
  actions: readonly RowAction[];
  reasons?: Readonly<Partial<Record<RowAction, string>>>;
  busy?: boolean;
  showAll?: boolean;
}>();
const emit = defineEmits<{ action: [action: RowAction] }>();
const menu = ref(false);
const root = ref<HTMLElement>();
const { xs, width } = useDisplay();
const primaryCount = computed(() =>
  props.showAll
    ? props.actions.length
    : xs.value
      ? width.value < 360 && props.actions.length > 2
        ? 1
        : 2
      : 3,
);
watch(
  () => [props.actions, props.busy, primaryCount.value],
  () => {
    menu.value = false;
  },
);
const items = computed(() =>
  props.actions.map((action) => ({
    key: action === "view" || action === "edit" ? "detail" : action,
    label:
      action === "view" ? "查看" : action === "edit" ? "编辑" : labels[action]!,
    icon: rowActionIcons[action],
    disabled: props.busy || !!props.reasons?.[action],
    reason: props.reasons?.[action],
    action,
  })),
);
// A disabled action's hint is keyboard reachable. When it becomes available,
// retain the user's position by moving focus from that hint to its own button.
watch(
  items,
  async () => {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      root.value?.contains(active) &&
      active.hasAttribute("data-row-action-hint")
    ) {
      // Removing tabindex from the now-enabled hint can blur it in a browser.
      await nextTick();
      if (
        root.value?.contains(active) &&
        (document.activeElement === active ||
          document.activeElement === document.body)
      )
        active
          .querySelector<HTMLElement>("button:not(:disabled)")
          ?.focus({ preventScroll: true });
    }
  },
  { flush: "pre" },
);
function activate(action: RowAction) {
  if (!props.busy && !props.reasons?.[action] && props.actions.includes(action))
    emit("action", action);
}
</script>
<template>
  <div
    v-if="items.length"
    ref="root"
    class="zerp-row-actions"
    :class="{
      'zerp-row-actions--mobile': xs,
      'zerp-row-actions--all': showAll,
    }"
  >
    <VTooltip
      v-for="item in items.slice(0, primaryCount)"
      :key="item.key"
      :text="item.reason ? `${item.label}：${item.reason}` : item.label"
      :disabled="xs"
    >
      <template #activator="{ props: tooltip }">
        <span
          v-bind="tooltip"
          :data-row-action-hint="item.action"
          :tabindex="item.disabled && item.reason ? 0 : undefined"
          :aria-label="
            item.reason ? `${item.label}：${item.reason}` : undefined
          "
        >
          <VBtn
            :data-row-action="item.action"
            :aria-label="item.label"
            :aria-description="item.reason"
            :icon="!xs"
            :disabled="item.disabled"
            variant="text"
            color="on-surface"
            size="default"
            @click="activate(item.action)"
            ><VIcon :icon="item.icon" aria-hidden="true" /><span v-if="xs">{{
              item.label
            }}</span></VBtn
          >
        </span>
      </template>
    </VTooltip>
    <VMenu
      v-if="items.length > primaryCount"
      v-model="menu"
      content-class="zerp-row-menu"
    >
      <template #activator="{ props: activator }">
        <VBtn
          v-bind="activator"
          aria-label="更多操作"
          :title="xs ? undefined : '更多操作'"
          :icon="!xs"
          variant="text"
          color="on-surface"
          size="default"
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
          :subtitle="item.reason"
          :prepend-icon="item.icon"
          :disabled="item.disabled"
          :aria-disabled="item.disabled || undefined"
          @click="activate(item.action)"
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
.zerp-row-actions--all {
  flex-wrap: wrap;
  white-space: normal;
}
.zerp-row-actions--mobile :deep(.v-btn) {
  padding-inline: 4px;
  font-size: inherit;
}
.zerp-row-actions--mobile :deep(.v-btn__content) {
  gap: 4px;
}
.zerp-row-actions--mobile :deep(.v-icon) {
  font-size: 18px;
}
</style>
