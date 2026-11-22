<script setup lang="ts">
import { computed } from "vue";
import { useDisplay } from "vuetify";
import { VBtn, VList, VListItem, VMenu } from "vuetify/components";
import { labels } from "./direct-model-runtime";

const props = defineProps<{ actions: readonly string[]; pending: boolean }>();
const emit = defineEmits<{ action: [action: string] }>();
const { xs, width } = useDisplay();
const destructive = ["delete", "remove", "void", "reverse"];
const primary = [
  "signIn",
  "changePassword",
  "update",
  "create",
  "submit",
  "approve",
  "complete",
  "publish",
];
const directLimit = computed(() => (width.value < 360 ? 1 : 2));
const presentationOrder = [
  "update",
  "reconcile",
  ...primary.filter((action) => action !== "update"),
];
const featured = computed(() =>
  xs.value && props.actions.length > directLimit.value
    ? [
        presentationOrder.find((action) => props.actions.includes(action)) ??
          props.actions[0]!,
      ]
    : props.actions,
);
const secondary = computed(() =>
  props.actions.filter((action) => !featured.value.includes(action)),
);
function style(action: string) {
  if (destructive.includes(action))
    return { color: "error", variant: "tonal" as const };
  if (primary.includes(action))
    return { color: "primary", variant: "flat" as const };
  return { color: "", variant: "tonal" as const };
}
function choose(action: string) {
  if (!props.pending && props.actions.includes(action)) emit("action", action);
}
</script>

<template>
  <div class="zerp-business-actions__group" role="group" :aria-busy="pending">
    <slot />
    <VBtn
      v-for="action in featured"
      :key="action"
      v-bind="style(action)"
      :disabled="pending"
      @click="choose(action)"
      >{{ labels[action] ?? action }}</VBtn
    >
    <VMenu v-if="secondary.length" :disabled="pending">
      <template #activator="{ props: activator }">
        <VBtn
          v-bind="activator"
          :disabled="pending"
          prepend-icon="mdi-dots-horizontal"
          aria-label="更多操作"
          variant="text"
          >更多</VBtn
        >
      </template>
      <VList role="menu" aria-label="更多操作">
        <VListItem
          v-for="action in secondary"
          :key="action"
          :title="labels[action] ?? action"
          :color="destructive.includes(action) ? 'error' : undefined"
          :disabled="pending"
          role="menuitem"
          @click="choose(action)"
        />
      </VList>
    </VMenu>
  </div>
</template>
