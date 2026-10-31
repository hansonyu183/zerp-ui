<script setup lang="ts">
import { computed, ref, watch } from "vue";
const props = withDefaults(
  defineProps<{
    message?: string;
    kind?: "error" | "warning" | "status";
    persistent?: boolean;
  }>(),
  { kind: "status" },
);
const dismissed = ref(false);
watch(
  () => props.message,
  () => {
    dismissed.value = false;
  },
);
const visible = computed(() => !!props.message && !dismissed.value);
const label = computed(() =>
  props.kind === "error"
    ? "错误提示"
    : props.kind === "warning"
      ? "警告提示"
      : "状态提示",
);
</script>
<template>
  <div class="zerp-feedback" :class="`zerp-feedback--${kind}`">
    <div
      v-if="visible"
      class="zerp-feedback__content"
      :role="kind === 'error' ? 'alert' : 'status'"
      :aria-label="label"
    >
      <span>{{ message }}</span>
      <slot />
      <button
        v-if="!persistent"
        type="button"
        class="zerp-feedback__close"
        :aria-label="`关闭${label}`"
        @click="dismissed = true"
      >
        关闭
      </button>
    </div>
  </div>
</template>
