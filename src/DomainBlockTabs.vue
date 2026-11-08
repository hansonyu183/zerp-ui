<script setup lang="ts" generic="D extends object">
import { computed, ref, useId, watch } from "vue";
import { VTab, VTabs } from "vuetify/components";
import DomainBlockHost from "./DomainBlockHost.vue";
import type { DomainBlock } from "./domain-blocks";
const props = defineProps<{
  blocks: readonly {
    key: string;
    block: DomainBlock<D>;
    props: {
      modelValue: D;
      scope: string;
      mode: "read" | "edit";
      formMode: "create" | "edit";
      disabled: boolean;
      "onUpdate:modelValue": (value: D) => void;
      onPending: (value: boolean) => void;
    };
  }[];
  resetKey: unknown;
  pending: boolean;
}>();
const id = useId(),
  selected = ref<string>();
const multiple = computed(() => props.blocks.length > 1);
watch(
  () => props.resetKey,
  () => {
    selected.value = props.blocks[0]?.key;
  },
  { immediate: true },
);
watch(
  () => props.blocks.map((b) => b.key).join("\0"),
  () => {
    if (!props.blocks.some((b) => b.key === selected.value))
      selected.value = props.blocks[0]?.key;
  },
  { immediate: true },
);
const invalid = (item: (typeof props.blocks)[number]) =>
  item.props.mode === "edit" &&
  Boolean(item.block.validate(item.props.modelValue, item.props.formMode));
</script>
<template>
  <div v-if="blocks.length" aria-label="内容分组">
    <VTabs
      v-if="multiple"
      v-model="selected"
      show-arrows
      :disabled="pending"
      aria-label="内容分组"
    >
      <VTab
        v-for="(item, index) in blocks"
        :key="item.key"
        :value="item.key"
        :id="`${id}-tab-${index}`"
        :aria-controls="`${id}-panel-${index}`"
        :aria-label="item.block.label"
      >
        {{ item.block.label
        }}<span v-if="invalid(item)" class="ml-1">待完善</span>
      </VTab>
    </VTabs>
    <div
      v-for="(item, index) in blocks"
      :key="item.key"
      v-show="!multiple || selected === item.key"
      :id="`${id}-panel-${index}`"
      :role="multiple ? 'tabpanel' : undefined"
      :aria-labelledby="multiple ? `${id}-tab-${index}` : undefined"
      :class="{ 'zerp-form-panel': multiple }"
    >
      <DomainBlockHost :block="item.block" v-bind="item.props" />
    </div>
  </div>
</template>
